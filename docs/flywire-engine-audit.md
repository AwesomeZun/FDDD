# FlyBrain / FlyWire engine audit

Audit date: 2026-09-14. Scope: source, binary and Node-worker runtime feasibility only. No main integration performed; no edits to main `src/`, `public/`, or existing UI worker files. Upstream cloned into `upstream/flybrain` and left unmodified.

Pinned source: https://github.com/snedea/flybrain/tree/9191824d17871b7851645782d53d23f213ddb938

## Decision

**An 80-node ceiling is not technically justified by this engine on the tested desktop.** The actual worker allocates state for **139,255 cells** and stores **2,698,236 weighted directed neuron-pair edges**. Dense stimulation really traversed every edge in a measured tick. This is not just 139K visual points over a tiny compute graph.

However, **this is a full-sized, simplified LIF graph, not a validated full-fly behavior or drug-response model**. The behavior remains a hybrid of neural activity, invented functional grouping, virtual motor synthesis, drive rules and explicit world-coordinate steering. Do not inherit the README's claim that the fly is “not scripted.”

**Commercial FDDD use of these data is not cleared:** upstream code is MIT, but FlyWire public data are CC BY-NC 4.0. Code reuse and dataset reuse must be decided separately.

## 1. Binary evidence, not advertised counts

I decompressed and scanned every edge record, checked bounds, ordering, weights and metadata lengths, then independently rebuilt the weighted edge mapping in JavaScript from the included CSVs and compared every binary edge.

| Item | Exact value |
|---|---:|
| `data/connectome.bin.gz` | 12,443,952 bytes |
| Inflated binary | 32,796,605 bytes |
| Header neuron count | 139,255 |
| Header edge count | 2,698,236 |
| Positive edges | 2,077,818 |
| Negative edges | 620,418 |
| Zero / nonfinite / out-of-bounds edges | 0 |
| Pre-index ordering violations | 0 |
| Maximum absolute raw weight | 2,405 |
| `neuron_meta.json` | 7,486 bytes |
| Functional group slots / nonempty groups | 63 / 32 |

Gzip SHA-256: `fbf8d440ca1207c7573e1acdd2366f9d0beb9b533c1710f21681264f81b1cc49`.

Binary layout: little-endian `uint32 N`, `uint32 E`, then E records of `uint32 pre, uint32 post, float32 weight`, followed by N records of `uint8 region, uint16 group`. Exactly `8 + 12E + 3N` bytes; no cell IDs, positions, receptor profiles or synapse locations are embedded.

| Supplied input | Compressed bytes | Inflated bytes | Data rows |
|---|---:|---:|---:|
| neurons.csv.gz | 1,679,884 | 8,634,447 | 139,255 |
| classification.csv.gz | 934,402 | 9,989,744 | 139,255 |
| connections.csv.gz | 50,289,304 | 198,264,132 | 3,869,878 |
| coordinates.csv.gz | 5,314,546 | 14,573,481 | 238,909 |

Independent edge reconstruction: **0 unknown-root rows skipped, 0 mismatched binary edges, 0 missing edges, 0 remaining nonzero pairs**. CSV rows represent **34,153,566 synapses** before signed pair aggregation; smallest row count is 1. There are 17,067 connection rows with an unrecognized transmitter label, assigned positive sign by the builder.

The binary faithfully represents all nonzero pair sums from these supplied connection rows, not every synapse as an individual dynamic object. `build_connectome.py:401–425` sums across neuropils, uses connection-row transmitter labels (the passed neuron transmitter dictionary is unused), drops zero sums and sorts pairs. Only GABA is negative; ACH, GLUT, DA, OA and SER are positive. Unknown labels are positive. Neuropil distinctions are lost.

This is **not independent certification that these CSVs are a complete/current canonical v783 export**. The repository does not preserve a download URL per CSV, source checksums, retrieval date or release manifest. The current Codex public landing page reports 3,732,460 FAFB connections, different from this bundled pair count; the FAQ says exports can change as annotations/data are consolidated and multi-neuropil rows can repeat pairs. The discrepancy is not resolved by this audit. Do not call the bundle “all current FlyWire edges.”

## 2. What actually computes

Source: `js/sim-worker.js`, especially `parseBinary`, `buildGroupStructures`, `tick`, and message handler.

- Allocates voltage, fired and refractory state for every cell; builds full CSR outgoing adjacency.
- Reorders neurons physically by functional group and remaps every target index. All subsequent indices are **group-sorted**, not original CSV order.
- Rescales **all** weights as `rawWeight / 2405 * 0.15`. A one-synapse positive edge contributes only about 0.00006237 voltage units.
- Defaults: leak multiplier 0.95/tick, threshold 1, refractory 3 ticks, scheduler 10 ticks/sec. No physical membrane units or biological millisecond calibration.
- Decays and thresholds neurons only in active groups; propagates outgoing edges only from cells that fired on the preceding tick. Synaptic arrival activates target groups.
- Idle groups are deactivated after 20 quiet ticks and residual state is erased. This is an approximation, not mathematically identical lazy evaluation of a dense LIF network.
- “Neuropil gating” is a misleading name: grouping is the heuristic 63-group functional mapping, not preserved anatomical neuropils. VIS_ME alone has 82,318 cells.
- Tick messages include the **full 139,255-byte fire bitmap** plus group spike counts. This is a structured clone, not a transfer or shared buffer. Rendering is separate from computation.

Core persistent typed arrays measured: **23,396,760 bytes**, excluding sustained input, temporary spike counts, loaded binaries, decompression chunks, remapping copies, JS/worker infrastructure and renderer. CSR alone is 22,142,912 bytes. Initialization temporarily holds old and remapped CSR arrays concurrently.

## 3. Actual CPU benchmark

Environment: **Apple M4 Max, 16 logical CPUs, macOS arm64, Node v26.5.0**. Actual upstream `sim-worker.js` was executed unchanged with `vm.runInThisContext` inside a real Node `worker_threads.Worker`. A `self` shim forwards `postMessage` to `parentPort`, including genuine structured-clone messages. Gzipped `init` uses the worker's actual `DecompressionStream` path.

The harness calls the actual `tick()` synchronously with `running=false`, so it measures compute plus send serialization, not 100 ms scheduler sleeps. Each case resets state, warms 20 ticks, then measures 200 ticks. Edge-traversal accounting and spike inspection run **outside** the timed tick. There is no renderer, DOM, network fetch, or browser install; this is not a browser end-to-end frame-rate claim.

Compressed init through `ready`, including worker startup: **144.69 ms** in the final run.

| Case | Directly stimulated cells | Mean ms/tick | p50 | p95 | Max |
|---|---:|---:|---:|---:|---:|
| Idle | 0 | 0.00594 | 0.00446 | 0.01083 | 0.04388 |
| Light + food + CX tonic | 15,832 | 0.55349 | 0.50004 | 0.75729 | 1.99392 |
| Every cell, intensity 1.1 | 139,255 | 2.46299 | 1.10337 | 5.72254 | 5.97933 |

Sensory case applies 0.15 to VIS_R1R6 and OLF_ORN_FOOD and 0.08 to CX_FC, CX_EPG, CX_PFN each tick, matching upstream stimulus magnitudes, not the entire behavioral feedback loop.

| Case | Mean active cells | Mean fired cells/tick | Mean traversed edges/tick | Max traversed edges/tick |
|---|---:|---:|---:|---:|
| Idle | 0 | 0 | 0 | 0 |
| Sensory | 135,026.69 | 1,446.10 | 6,032.835 | 85,155 |
| Dense | 139,255 | 46,650.425 | 890,417.88 | **2,698,236** |

Thus all edges are available and the dense run genuinely traverses them, but **not every edge is multiplied on every tick**. Dense firing pulses are separated by refractory intervals, explaining mean versus peak cost.

Sensory run produced only **0.07 spikes/tick outside directly stimulated cells**: 14 over 200 measured ticks. Almost all spikes were directly induced. Group activation percentages are not firing percentages and do not establish healthy sensory-to-motor propagation. This test does not establish that other parameters/stimuli cannot propagate; it identifies a concrete weakness at the defaults.

Measured whole-process RSS was 296,828,928 to 356,253,696 bytes across cases. This includes parent-side decompressed audit data, worker and messages and is **not isolated engine RAM**. No mobile, older CPU or sustained browser benchmark was performed. Upstream Node tests also ran: **99 passed / 0 failed**, but their small fixtures do not certify biological validity.

Reproduce locally (scratch files; may be cleaned later):

```sh
node /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/tmp/flybrain-bench.cjs
node /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/tmp/flybrain-verify.cjs
node upstream/flybrain/tests/run-node.js
```

Detailed outputs are adjacent `flybrain-bench.json`, `flybrain-verify.json`, and `flybrain-tests.txt` in that scratch directory.

## 4. Sensory, motor and scripted movement

`brain-worker-bridge.js:425–546` translates broad named inputs to **all cells in each group**. Light drives photoreceptors; food drives OLF_ORN_FOOD; contact drives sweet taste; touch drives MECH_BRISTLE; wind drives MECH_JO; temperature drives THERMO_WARM/COOL. CX tonic drive is always injected. Empty groups silently receive nothing.

Classification is heuristic (`build_connectome.py:146–345`): all MBONs become appetitive, all DANs become reward, lateral-horn locals become approach. Ascending neurons and descending neurons can both be assigned GNG_DESC. `side` is passed but never used. The mapping is not validated cell-specific sensor or motor identity.

Critical empty groups include NOCI, VIS_R7R8, MECH_CHORD, MB_APL, MB_MBON_AV, MB_DAN_PUN, LH_AV, DRIVE_FEAR/CURIOSITY/GROOM, DN_WALK/FLIGHT/TURN/BACKUP/STARTLE, and every leg and wing MN group. **31 of 63 groups are empty.** GNG_DESC contains 3,581 cells, VNC_CPG 4, MN_PROBOSCIS 24, MN_HEAD 40 and MN_ABDOMEN 8.

`brain-worker-bridge.js:551–580` computes each group activation as `100 * spikes / (group size * received ticks)`, then takes the maximum with previous activation times 0.75. This is smoothed aggregate readout, not cell-level motor decoding.

`brain-worker-bridge.js:252–357,388–398` explicitly implements a **virtual VNC motor layer**:

- Fear, curiosity and grooming drives bypass neurons and are written directly into group activation.
- Hand-set sums of CX/approach/avoidance/drive activity define walk, flight, grooming and feeding “intent.”
- `descProxy = max(walkIntent*.45, flightIntent*.35, groomIntent*.3, feedIntent*.25)` can replace actual descending readout.
- Six leg outputs are synthesized symmetrically with random jitter; wing outputs are synthesized from avoidance/fear thresholds.
- Its own comment says steering is behavioral target direction, not leg asymmetry.

`fly-logic.js:54–91` selects behaviors by fixed priorities and thresholds. Feeding can trigger from hunger plus nearby food without the neural feeding threshold. `main.js:1030–1115` explicitly points at nearest food via `atan2`, steers phototaxis toward canvas center, injects random wandering, imposes minimum speeds, gives feeding approach speed 0.25, and orients bracing into wind. `main.js:1862+` adds edge avoidance. Therefore neural activity modulates behavior, but behavioral success cannot be interpreted as evidence that the connectome learned/computed food direction or escape navigation.

## 5. Concrete integration API (proposal only, not implemented)

Use the worker engine separately; **do not import `main.js` or silently reuse its behavior rules as neural results**.

```js
const worker = new Worker('/engine/flybrain/sim-worker.js');
const buffer = await fetch('/data/flywire/connectome.bin.gz').then(r => r.arrayBuffer());
worker.postMessage({ type: 'init', buffer }, [buffer]);
// Await ready {neuronCount, edgeCount, groupId: Uint16Array, regionType: Uint8Array}.
// Build group -> sorted neuron index lists from the returned arrays and neuron_meta.json.
worker.postMessage({ type: 'setParams', leakRate: .95, threshold: 1, refractoryPeriod: 3 });
worker.postMessage({ type: 'setStimulusState', indices: new Uint32Array([sortedIndex]),
                     intensities: new Float32Array([.15]) });
worker.postMessage({ type: 'start' });
// tick: {fireState: Uint8Array, firedNeurons, groupSpikeCounts: Uint16Array, tickCount}
// stats: {avgTickMs, firedNeurons, activeNeurons, totalNeurons, activeGroups,
//         totalGroups, tickRate}
// error: {message}
worker.postMessage({ type: 'stop' });
worker.postMessage({ type: 'reset' });
```

Additional existing input: `stimulate {indices,intensities}` for one-shot voltage addition. Sustained input replaces the previous list; clear with null indices/intensities. No public step, voltage-readback, weight-update, per-cell parameter, target lesion, pharmacology or seed API exists. `setParams` only adjusts three global values; it is **not a drug model**.

Before scientific integration:

1. Export original-to-sorted and sorted-to-original maps and string root IDs. The current worker discards those maps; reconstructing the stable group sort from binary metadata plus neuron CSV order is possible, but should be explicit and versioned.
2. Add deterministic `step(n)` and reset semantics, state readback and a clearly specified time unit. Keep rendering frequency independent.
3. Add per-cell/per-edge intervention controls only against a separately justified biological model; distinguish numerical ablation from drug action.
4. Report raw neural outputs and controller contributions separately, including no-neural-input/disconnected control runs. Never silently fall back to the 59-group legacy engine in experiments.
5. Preserve graph/source hashes and named dataset choice. Existing FDDD MaleCNS data and this female FAFB brain-only dataset are different specimens and cannot be silently interchanged or cell-index joined.

### Correctness hazards found in source

- `groupSpikeCounts` is **Uint16Array** but VIS_ME has **82,318 neurons**. Synchronous dense firing can overflow a group's count beyond 65,535. Use Uint32 before trusting aggregate readouts.
- `start` is not idempotent and does not track/clear timeout IDs. Repeated starts can create multiple loops. `stop` can allow one already-scheduled tick; quick stop/start can duplicate loops.
- `reset` does not reset tickCount or parameters. Define reproducible experiment boundaries explicitly.
- Indices are only checked with `idx < N`, without negative/integer validation; paired lengths and parameter domains are not validated. Refractory storage is uint8.
- Binary parser assumes valid sorted input and lengths. Bounds were valid for this pinned file, but ingestion should enforce a schema and hash before allocation.
- Source defines MIN_TICK_RATE but no actual adaptive-rate adjustment; 10 Hz is fixed. “SIMD-friendly” layout does not mean explicit SIMD/WASM acceleration.

## 6. License and provenance verdict

Repository `license.md`: **MIT**, carrying `Copyright (c) [2017] [Seth Miller]`. Preserve that full notice when copying substantial code. It appears inherited from worm-sim; do not rewrite the copyright or assume it licenses all included data.

Current project `LICENSE` is the **Cobanov Template Attribution License 1.0**, expressly excluding separately licensed third-party materials. MIT engine code can be included while retaining both notice sets and the existing template attribution. This is not a blanket relicensing of FDDD to MIT.

Official FlyWire guidelines state **CC BY-NC 4.0**, with v783 an October 2023 snapshot and newer annotations also publicly released. Official community principles independently state that published data are CC BY-NC 4.0. Thus the included CSVs and derived binary must not be treated as MIT assets. Noncommercial research use requires applicable attribution/license/change notices. Commercial drug-development use or a commercial service needs separate rights clearance; merely keeping the application private does not remove the noncommercial restriction. The existing MaleCNS CC BY 4.0 notices do not apply to FAFB.

Sources inspected:

- https://flywire.ai/guidelines
- https://edit.flywire.ai/principles.html
- https://codex.flywire.ai/faq
- https://codex.flywire.ai/api/download
- Canonical connectivity archive identified: https://zenodo.org/records/10676866 (not downloaded or checksum-matched in this bounded audit).
- Publication identified by upstream: Dorkenwald et al., *Neuronal wiring diagram of an adult brain*, Nature 634, 124–138 (2024), https://doi.org/10.1038/s41586-024-07558-y .

The bundled CSV-to-binary transformation is verified exhaustively. Canonical upstream release identity and commercial dataset permission remain **[blocked: missing source manifest/checksum match and separate commercial permission]**. The source and benchmark support a full-size CPU feasibility prototype, not a claim of biologically grounded drug-response prediction.
