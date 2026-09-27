// Modified FDDD research engine. Upstream MIT notice: LICENSE-MIT.txt.
/* LIF neuron simulator Web Worker — T7.3 + T7.7 (neuropil-gated)
 *
 * Leaky integrate-and-fire simulation over the full Drosophila connectome.
 * Receives a binary connectome ArrayBuffer (optionally gzipped) on init.
 *
 * T7.7 optimizations:
 * - Neuropil-gated simulation: only tick neurons in active groups,
 *   lazy-activate groups when stimulation or synaptic input arrives.
 * - SIMD-friendly memory layout: neurons physically reordered by group
 *   so each group occupies a contiguous range in all typed arrays.
 *   CSR matrix remapped to match. (struct-of-arrays, group-sorted)
 * - Tick rate reduced to 10/sec; renderer interpolates brightness.
 *
 * Binary format (little-endian):
 *   Header:   2 x uint32  -- neuron_count, edge_count
 *   Edges:    edge_count x (uint32 pre, uint32 post, float32 weight), sorted by pre
 *   Metadata: neuron_count x (uint8 region_type, uint16 group_id)
 *
 * Message protocol:
 *   Main -> Worker: init, start, stop, stimulate, setStimulusState, setParams
 *   Worker -> Main: ready, tick, stats, error
 */

/* ---------- constants ---------- */
var DEFAULT_LEAK_RATE = 0.95;
var DEFAULT_THRESHOLD = 1.0;
var DEFAULT_REFRACTORY_PERIOD = 3;
var WEIGHT_SCALE = 0.15;
var TARGET_TICK_RATE = 10;
var MIN_TICK_RATE = 5;
var COOLDOWN_TICKS = 20;
var STATS_INTERVAL = 20;

/* ---------- module-level state ---------- */
var N = 0;
var edgeCount = 0;
var V = null;               // Float32Array[N] voltage (group-sorted)
var fired = null;            // Uint8Array[N] fire state (group-sorted)
var refractory = null;       // Uint8Array[N] refractory counter (group-sorted)
var rowPtr = null;           // Uint32Array[N+1] CSR row pointers (group-sorted)
var colIdx = null;           // Uint32Array[edgeCount] CSR col indices (group-sorted)
var values = null;           // Float32Array[edgeCount] CSR edge weights
var regionType = null;       // Uint8Array[N] region per neuron (group-sorted)
var groupId = null;          // Uint16Array[N] group per neuron (group-sorted)
var leakRate = DEFAULT_LEAK_RATE;
var threshold = DEFAULT_THRESHOLD;
var refractoryPeriod = DEFAULT_REFRACTORY_PERIOD;
var running = false;
var sustainedIndices = null;
var sustainedIntensities = null;
var tickCount = 0;
var targetTickRate = TARGET_TICK_RATE;
var tickTimeSum = 0;
var tickTimeSamples = 0;
var activeNeuronCount = 0;
var cumulativeFiredCount = 0;

/* neuropil-gated simulation structures (built by buildGroupStructures) */
var numGroups = 0;
var groupOffset = null;          // Uint32Array[numGroups+1] prefix sum
var groupActive = null;          // Uint8Array[numGroups]
var groupCooldown = null;        // Uint8Array[numGroups]
var groupRecvInput = null;       // Uint8Array[numGroups] per-tick scratch
var groupFiredThisTick = null;   // Uint8Array[numGroups] per-tick scratch
var groupStimulatedThisTick = null; // Uint8Array[numGroups] per-tick scratch

/* ---------- decompressGzip ---------- */

async function decompressGzip(buffer) {
	var ds = new DecompressionStream('gzip');
	var writer = ds.writable.getWriter();
	writer.write(new Uint8Array(buffer));
	writer.close();
	var reader = ds.readable.getReader();
	var chunks = [];
	while (true) {
		var result = await reader.read();
		if (result.done) break;
		chunks.push(result.value);
	}
	var totalLen = 0;
	for (var c = 0; c < chunks.length; c++) {
		totalLen += chunks[c].byteLength;
	}
	var out = new Uint8Array(totalLen);
	var offset = 0;
	for (var c = 0; c < chunks.length; c++) {
		out.set(chunks[c], offset);
		offset += chunks[c].byteLength;
	}
	return out.buffer;
}

/* ---------- parseBinary ---------- */

function parseBinary(buffer) {
	var view = new DataView(buffer);
	N = view.getUint32(0, true);
	edgeCount = view.getUint32(4, true);

	var edgeOffset = 8;
	var metaOffset = edgeOffset + edgeCount * 12;

	/* allocate CSR arrays (original index space, remapped later) */
	rowPtr = new Uint32Array(N + 1);
	colIdx = new Uint32Array(edgeCount);
	values = new Float32Array(edgeCount);

	/* first pass -- count outgoing edges per neuron */
	for (var e = 0; e < edgeCount; e++) {
		var pre = view.getUint32(edgeOffset + e * 12, true);
		rowPtr[pre + 1]++;
	}

	/* prefix sum -- convert counts to cumulative offsets */
	for (var i = 1; i <= N; i++) {
		rowPtr[i] += rowPtr[i - 1];
	}

	/* second pass -- fill colIdx, values, find maxAbsWeight */
	var maxAbsW = 0;
	for (var e = 0; e < edgeCount; e++) {
		var base = edgeOffset + e * 12;
		colIdx[e] = view.getUint32(base + 4, true);
		var rawW = view.getFloat32(base + 8, true);
		values[e] = rawW;
		var absW = rawW < 0 ? -rawW : rawW;
		if (absW > maxAbsW) maxAbsW = absW;
	}

	/* normalize weights */
	if (maxAbsW > 0) {
		for (var e = 0; e < edgeCount; e++) {
			values[e] = (values[e] / maxAbsW) * WEIGHT_SCALE;
		}
	}

	/* read per-neuron metadata (original order) */
	regionType = new Uint8Array(N);
	groupId = new Uint16Array(N);
	for (var i = 0; i < N; i++) {
		regionType[i] = view.getUint8(metaOffset + i * 3);
		groupId[i] = view.getUint16(metaOffset + i * 3 + 1, true);
	}

	/* allocate simulation state */
	V = new Float32Array(N);
	fired = new Uint8Array(N);
	refractory = new Uint8Array(N);
	tickCount = 0;
}

/* ---------- buildGroupStructures ---------- */
/* Reorders all per-neuron arrays and the CSR matrix so neurons within each
 * group occupy a contiguous range. Enables cache-friendly iteration over
 * only active groups (neuropil gating) and SIMD-friendly memory access. */

function buildGroupStructures() {
	/* determine number of groups */
	numGroups = 0;
	for (var i = 0; i < N; i++) {
		if (groupId[i] >= numGroups) numGroups = groupId[i] + 1;
	}

	/* count neurons per group */
	var counts = new Uint32Array(numGroups);
	for (var i = 0; i < N; i++) {
		counts[groupId[i]]++;
	}

	/* build prefix-sum offsets */
	groupOffset = new Uint32Array(numGroups + 1);
	for (var g = 0; g < numGroups; g++) {
		groupOffset[g + 1] = groupOffset[g] + counts[g];
	}

	/* build sortedByGroup: sortedByGroup[sorted_pos] = original_index */
	sortedByGroup = new Uint32Array(N);
	var writePos = new Uint32Array(numGroups);
	for (var g = 0; g < numGroups; g++) writePos[g] = groupOffset[g];
	for (var i = 0; i < N; i++) {
		var g = groupId[i];
		sortedByGroup[writePos[g]++] = i;
	}

	/* reverse mapping: originalToSorted[original_index] = sorted_pos */
	originalToSorted = new Uint32Array(N);
	for (var s = 0; s < N; s++) {
		originalToSorted[sortedByGroup[s]] = s;
	}

	/* remap CSR to sorted index space */
	var newRowPtr = new Uint32Array(N + 1);
	for (var s = 0; s < N; s++) {
		var o = sortedByGroup[s];
		newRowPtr[s + 1] = rowPtr[o + 1] - rowPtr[o];
	}
	for (var s = 1; s <= N; s++) {
		newRowPtr[s] += newRowPtr[s - 1];
	}
	var newColIdx = new Uint32Array(edgeCount);
	var newValues = new Float32Array(edgeCount);
	for (var s = 0; s < N; s++) {
		var o = sortedByGroup[s];
		var wp = newRowPtr[s];
		for (var j = rowPtr[o]; j < rowPtr[o + 1]; j++) {
			newColIdx[wp] = originalToSorted[colIdx[j]];
			newValues[wp] = values[j];
			wp++;
		}
	}
	rowPtr = newRowPtr;
	colIdx = newColIdx;
	values = newValues;

	/* remap per-neuron metadata to sorted order */
	var newGroupId = new Uint16Array(N);
	var newRegionType = new Uint8Array(N);
	for (var s = 0; s < N; s++) {
		newGroupId[s] = groupId[sortedByGroup[s]];
		newRegionType[s] = regionType[sortedByGroup[s]];
	}
	groupId = newGroupId;
	regionType = newRegionType;

	/* V, fired, refractory are zero-initialized -- no remap needed */

	/* allocate per-group activation state */
	groupActive = new Uint8Array(numGroups);
	groupCooldown = new Uint8Array(numGroups);
	groupRecvInput = new Uint8Array(numGroups);
	groupFiredThisTick = new Uint8Array(numGroups);
	groupStimulatedThisTick = new Uint8Array(numGroups);
}


var originalToSorted, sortedByGroup;
// Dense state update, sparse applicable-edge propagation. No timer, no hidden motor controller.
// Explicit demo calibration: original normalized weights x80; threshold .35; leak .90.
// Sensory drive per step = SENSORY_BIAS + SENSORY_GAIN * channel value. Before 2026-09-14 this was .10 + .40*value; the
// constant .10 alone made every sensory cell fire every ~5 steps regardless of input, producing an input-independent
// population rhythm. Lowered so activity is input-driven. These parameters are engineered, not fitted physiology.
const DEMO_GAIN=80, DEMO_THRESHOLD=.35, DEMO_LEAK=.90, SENSORY_BIAS=.02, SENSORY_GAIN=.55, INITIAL_STATE_SPREAD=.30;
// Channel 8 (reward/feeding taste) drives ONLY the annotated feeding gustatory neurons (MaleCNS class=gustatory,
// subclass pharyngeal sensillum / labellar bristle / taste peg). Those cells are removed from the generic channels.
let rootIds=[], sensoryCells=[], motorCells=[], feedingCells=[], smoothMotor=new Float32Array(6), initialized=false, previousMode='baseline', stateSeed=0;
export async function initEngine(buffer, ids, config, options={}) {
 if(new Uint8Array(buffer)[0]===31) buffer=await decompressGzip(buffer);
 const dv=new DataView(buffer),n=dv.getUint32(0,true),e=dv.getUint32(4,true);
 if(n!==config.neuronCount||e!==config.edgeCount||buffer.byteLength!==8+12*e+3*n||ids.length!==n)throw Error('MaleCNS v1.0 graph/identity mismatch');
 let prev=-1;for(let k=0;k<e;k++){const off=8+12*k,a=dv.getUint32(off,true),b=dv.getUint32(off+4,true);if(a<prev||a>=n||b>=n||!Number.isFinite(dv.getFloat32(off+8,true)))throw Error('Invalid graph edge');prev=a;}
 parseBinary(buffer);buildGroupStructures();for(let j=0;j<edgeCount;j++)values[j]*=DEMO_GAIN;
 rootIds=ids;sensoryCells=[];motorCells=[];feedingCells=[];stateSeed=(options.seed>>>0)||0;
 const feedingOriginal=Array.isArray(options.feedingIndices)?options.feedingIndices:[];const isFeeding=new Uint8Array(N);for(const o of feedingOriginal){if(!(o>=0&&o<N))throw Error('Feeding gustatory index out of range');isFeeding[originalToSorted[o]]=1;}
 // Same mapped sensory superclass groups for channels 0-7; feeding gustatory cells take channel 8 only. Descending readout only.
 for(let i=0;i<N;i++){if(isFeeding[i])feedingCells.push(i);else if(config.sensoryGroups.includes(groupId[i]))sensoryCells.push(i);if(config.motorGroups.includes(groupId[i]))motorCells.push(i);}
 if(feedingOriginal.length&&feedingCells.length!==feedingOriginal.length)throw Error('Feeding gustatory mapping mismatch');
 initialized=true;resetEngine();return {neuronCount:N,edgeCount,groupId,regionType,originalToSorted,sortedToOriginal:sortedByGroup,sensoryCount:sensoryCells.length,motorCount:motorCells.length,feedingCount:feedingCells.length,dynamicsLabel:'LIF demo: upstream weight ×80, threshold 0.35, leak 0.90, sensory drive .02+.55·input; MaleCNS sensory encoder (8 ch) + feeding-GRN reward channel ('+feedingCells.length+' cells) / annotated CNS motor decoder; seeded initial membrane state'};
}
// Seeded small initial membrane spread (uniform 0..INITIAL_STATE_SPREAD × threshold) so brains started together are not phase-locked. Seed 0 keeps the old all-zero start.
export function resetEngine(seed){if(!initialized)return;if(seed!==undefined)stateSeed=(Number(seed)>>>0)||0;V.fill(0);fired.fill(0);refractory.fill(0);smoothMotor.fill(0);tickCount=0;previousMode='baseline';if(stateSeed){let x=stateSeed;for(let i=0;i<N;i++){x=(Math.imul(1664525,x)+1013904223)>>>0;V[i]=(x/4294967296)*INITIAL_STATE_SPREAD*DEMO_THRESHOLD;}}}
export function stepEngine(sensory,mode='baseline') {
 if(!initialized)throw Error('Engine not ready');
 const t0=performance.now();let traversedEdges=0;
 if(!['baseline','disconnected','silenced'].includes(mode))throw Error('Invalid control mode');
 // Intervention onset clears stored electrical state, not an output/movement bypass.
 if(mode!==previousMode&&mode!=='baseline'){V.fill(0);fired.fill(0);refractory.fill(0);smoothMotor.fill(0);}
 previousMode=mode;
 // Every cell state computed each step, without group gating.
 for(let i=0;i<N;i++){if(refractory[i]>0){refractory[i]--;V[i]=0;}else V[i]*=DEMO_LEAK;}
 if(mode==='baseline')for(let i=0;i<N;i++)if(fired[i])for(let j=rowPtr[i];j<rowPtr[i+1];j++){V[colIdx[j]]+=values[j];traversedEdges++;}
 // Silencing removes ALL drive, including recurrent transmission, as an acute electrical control.
 if(mode!=='silenced'){for(const i of sensoryCells){const channel=sortedByGroup[i]%8;const value=Math.max(0,Math.min(1,Number(sensory[channel])||0));if(!refractory[i])V[i]+=SENSORY_BIAS+SENSORY_GAIN*value;}
  const reward=Math.max(0,Math.min(1,Number(sensory[8])||0));for(const i of feedingCells)if(!refractory[i])V[i]+=SENSORY_BIAS+SENSORY_GAIN*reward;}
 let spikeCount=0;const groupSpikeCounts=new Uint32Array(numGroups),bins=new Float32Array(6),sizes=new Uint32Array(6);
 for(let i=0;i<N;i++){fired[i]=0;if(!refractory[i]&&V[i]>=DEMO_THRESHOLD){fired[i]=1;V[i]=0;refractory[i]=3;spikeCount++;groupSpikeCounts[groupId[i]]++;}}
 for(const i of motorCells){const b=sortedByGroup[i]%6;bins[b]+=fired[i];sizes[b]++;}
 for(let b=0;b<6;b++)smoothMotor[b]=smoothMotor[b]*.72+(bins[b]/Math.max(1,sizes[b]))*.28;
 // Transparent downstream-only decoder. Forward thrust comes from actual descending spikes.
 const mean=smoothMotor.reduce((a,b)=>a+b,0)/6;
 const output=[Math.tanh((smoothMotor[0]-smoothMotor[1])*12),Math.tanh((smoothMotor[2]-smoothMotor[3])*8),Math.tanh(mean*6)];
 const activity=new Float32Array(N);for(let i=0;i<N;i++)activity[i]=fired[i]?1:Math.max(0,Math.min(.8,V[i]/DEMO_THRESHOLD*.8));
 return {tick:++tickCount,neuronCount:N,edgeCount,activeNeuronCount:N,spikeCount,traversedEdges,computeMs:performance.now()-t0,fireState:fired.slice(),activity,groupSpikeCounts,output,motorRates:Array.from(smoothMotor)};
}
export function identities(){return {rootIds,originalToSorted,sortedToOriginal:sortedByGroup};}
