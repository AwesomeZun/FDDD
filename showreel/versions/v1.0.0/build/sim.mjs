// FDDD 쇼릴용 실제 스파이크 기록기입니다.
// FDDD 저장소의 MaleCNS LIF 엔진(public/engine/malecns/core.js)을 그대로 불러와 계산하고,
// 영상에 그릴 실측 세포체 위치(brain-atlas 140,024개)에 해당하는 발화만 골라 저장합니다.
// 입력 스케줄은 연출용으로 설정한 값이지만, 스파이크 자체는 커넥톰 위에서 실제로 계산한 결과입니다.
// 사용법: FDDD_DIR=/path/to/FDDD node build/sim.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const FDDD = process.env.FDDD_DIR;
if (!FDDD) throw Error('FDDD_DIR 환경 변수가 필요합니다.');
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data');
fs.mkdirSync(OUT, { recursive: true });

const core = await import(path.join(FDDD, 'public/engine/malecns/core.js'));
const read = (p) => fs.readFileSync(path.join(FDDD, p));
const json = (p) => JSON.parse(read(p).toString('utf8'));
const gz = read('public/data/malecns/connectome.bin.gz');
const ids = json('public/data/malecns/root-ids.json');
const manifest = json('public/data/malecns/manifest.json');
const gustatory = json('public/data/malecns/gustatory.json');
const ab = gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength);

console.time('init');
const info = await core.initEngine(ab, ids, manifest, { feedingIndices: gustatory.gustatoryIndices, seed: 2026 });
console.timeEnd('init');
const { originalToSorted } = core.identities();
const groupIdSorted = info.groupId; // 정렬된 엔진 인덱스 기준 superclass 번호

// 사이트(brainRegions.ts)와 같은 5개 영역 팔레트 분류입니다.
const REGIONS = [
  ['cb_sensory', 'cb_sensory_tbc', 'ol_sensory', 'vnc_sensory', 'vnc_sensory_tbc', 'sensory_ascending', 'sensory_ascending_tbc', 'sensory_descending'],
  ['cb_intrinsic', 'ol_intrinsic', 'visual_projection', 'visual_projection_tbc', 'visual_centrifugal', 'vnc_intrinsic'],
  ['descending_neuron', 'efferent_descending'],
  ['vnc_motor', 'cb_motor'],
];
const regionOfGroupName = (name) => { const k = REGIONS.findIndex((g) => g.includes(name)); return k < 0 ? 4 : k; };
const regionOfGroupIdx = manifest.groups.map(regionOfGroupName);

// 엔진 전체(167,122개)의 영역별 뉴런 수
const regionSizes = new Float64Array(5);
for (let i = 0; i < groupIdSorted.length; i++) regionSizes[regionOfGroupIdx[groupIdSorted[i]]]++;

// brain-atlas 실측 세포체 위치를 엔진 인덱스에 연결합니다.
const atlasIdsBuf = read('public/data/brain-atlas/ids.bin');
const atlasIds = new Uint32Array(atlasIdsBuf.buffer.slice(atlasIdsBuf.byteOffset, atlasIdsBuf.byteOffset + atlasIdsBuf.byteLength));
const rootIndex = new Map(ids.map((s, i) => [s, i]));
const A = atlasIds.length;
const atlasSorted = new Uint32Array(A);
const atlasRegion = new Uint8Array(A);
for (let k = 0; k < A; k++) {
  const o = rootIndex.get(String(atlasIds[k]));
  if (o === undefined) throw Error('atlas id가 엔진에 없습니다: ' + atlasIds[k]);
  atlasSorted[k] = originalToSorted[o];
  atlasRegion[k] = regionOfGroupIdx[groupIdSorted[atlasSorted[k]]];
}
console.log('atlas points', A, 'region counts', Array.from({ length: 5 }, (_, r) => atlasRegion.filter((x) => x === r).length));

// 타일용 부분 표본 (시드 고정, 영역 비율 유지)
let rs = 0x9e3779b9;
const rnd = () => { rs = (Math.imul(rs ^ (rs >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; rs ^= rs >>> 13; return rs / 4294967296; };
const TILE_N = 9000;
const perm = Array.from({ length: A }, (_, i) => i);
for (let i = A - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
const tileSubset = Uint32Array.from(perm.slice(0, TILE_N).sort((a, b) => a - b));

const clamp = (x) => Math.max(0, Math.min(1, x));
// 저장소 harness(scripts/brain-dynamics-harness.mjs)가 쓰는 화학 입력 벡터를 기본으로 합니다.
const CHEM = [0.62, 0.31, 0.48, 0.55, 0.27, 0.7, 0.44, 0.36];
function sensoryAt(s, total, phase, contact) {
  const p = (s / total) * Math.PI * 2 + phase;
  return [
    clamp(0.5 + 0.35 * Math.sin(p * 1.3)),
    clamp(0.5 + 0.35 * Math.cos(p * 0.9 + 0.4)),
    clamp(0.5 + 0.2 * Math.sin(p * 2.1)),
    clamp(0.62 - 0.45 * contact),
    CHEM[4], CHEM[5], clamp(0.44 + 0.25 * Math.sin(p * 1.7)), CHEM[7],
    contact,
  ];
}

// 발화 목록을 델타 varint로 압축합니다.
function encodeSteps(stepLists) {
  const bytes = [];
  const offsets = [0];
  for (const list of stepLists) {
    let prev = -1;
    for (const v of list) {
      let d = v - prev - 1; prev = v;
      while (d >= 0x80) { bytes.push((d & 0x7f) | 0x80); d >>>= 7; }
      bytes.push(d);
    }
    offsets.push(bytes.length);
  }
  const head = new Uint32Array([stepLists.length, ...offsets]);
  return Buffer.concat([Buffer.from(head.buffer), Buffer.from(Uint8Array.from(bytes))]);
}

function runFly({ seed, steps, warm, phase, contactFn, subset }) {
  core.resetEngine(seed);
  const lists = [], counts = [], regionRates = [], motor = [];
  for (let s = -warm; s < steps; s++) {
    const c = contactFn(Math.max(0, s));
    const f = core.stepEngine(sensoryAt(s + warm, steps + warm, phase, c), 'baseline');
    if (s < 0) continue;
    const fired = f.fireState;
    const list = [];
    for (let k = 0; k < subset.length; k++) if (fired[atlasSorted[subset[k]]]) list.push(k);
    lists.push(list);
    counts.push(f.spikeCount);
    const rsum = new Float64Array(5);
    for (let g = 0; g < f.groupSpikeCounts.length; g++) rsum[regionOfGroupIdx[g]] += f.groupSpikeCounts[g];
    regionRates.push(Array.from(rsum, (v, r) => +(v / regionSizes[r]).toFixed(4)));
    motor.push(f.output.map((x) => +x.toFixed(4)));
  }
  return { lists, counts, regionRates, motor };
}

const allAtlas = Uint32Array.from({ length: A }, (_, i) => i);
const HERO_STEPS = 192;
console.time('hero');
// 주인공 개체: 80~140 스텝 구간에 목표 복합체와 접촉해 보상 채널(sensory[8])이 켜집니다.
const hero = runFly({
  seed: 2026, steps: HERO_STEPS, warm: 24, phase: 0, subset: allAtlas,
  contactFn: (s) => (s < 80 ? 0 : s < 92 ? (s - 80) / 12 : s < 140 ? 1 : s < 150 ? 1 - (s - 140) / 10 : 0),
});
console.timeEnd('hero');
const heroBlob = encodeSteps(hero.lists);
fs.writeFileSync(path.join(OUT, 'spikes_hero.bin.gz'), zlib.gzipSync(heroBlob, { level: 9 }));
console.log('hero raw', heroBlob.length, 'gz', fs.statSync(path.join(OUT, 'spikes_hero.bin.gz')).size,
  'mean spikes/step', Math.round(hero.counts.reduce((a, b) => a + b, 0) / hero.counts.length),
  'mean atlas spikes/step', Math.round(hero.lists.reduce((a, l) => a + l.length, 0) / hero.lists.length));

const TILE_STEPS = 60, FLIES = 20;
console.time('tiles');
const tiles = [];
for (let i = 0; i < FLIES; i++) {
  const onset = 10 + ((i * 7) % 30);
  tiles.push(runFly({
    seed: 1000 + i * 97, steps: TILE_STEPS, warm: 16 + (i % 5) * 3, phase: i * 0.83, subset: tileSubset,
    contactFn: (s) => (i % 3 === 0 ? 0 : s > onset && s < onset + 25 ? 0.4 + 0.6 * ((i * 37) % 10) / 10 : 0),
  }));
}
console.timeEnd('tiles');
const tileBlob = Buffer.concat(tiles.map((t) => { const b = encodeSteps(t.lists); const len = Buffer.alloc(4); len.writeUInt32LE(b.length); return Buffer.concat([len, b]); }));
fs.writeFileSync(path.join(OUT, 'spikes_tiles.bin.gz'), zlib.gzipSync(tileBlob, { level: 9 }));
console.log('tiles raw', tileBlob.length, 'gz', fs.statSync(path.join(OUT, 'spikes_tiles.bin.gz')).size);

// 영상 좌표계용 atlas 위치: 중심 이동 + 등방 스케일 후 int16 양자화 (축 방향은 원본 유지)
const posBuf = read('public/data/brain-atlas/positions.bin');
const pos = new Float32Array(posBuf.buffer.slice(posBuf.byteOffset, posBuf.byteOffset + posBuf.byteLength));
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let k = 0; k < A; k++) for (let d = 0; d < 3; d++) { const v = pos[k * 3 + d]; if (v < min[d]) min[d] = v; if (v > max[d]) max[d] = v; }
const center = min.map((m, d) => (m + max[d]) / 2);
const half = Math.max(...max.map((m, d) => (m - min[d]) / 2));
const q = new Int16Array(A * 3);
for (let k = 0; k < A * 3; k++) q[k] = Math.round(((pos[k] - center[k % 3]) / half) * 32767);
const groupsBuf = read('public/data/brain-atlas/groups.bin');
const atlasBlob = Buffer.concat([Buffer.from(new Uint32Array([A, TILE_N]).buffer), Buffer.from(q.buffer), Buffer.from(atlasRegion), Buffer.from(groupsBuf), Buffer.from(tileSubset.buffer)]);
fs.writeFileSync(path.join(OUT, 'atlas.bin.gz'), zlib.gzipSync(atlasBlob, { level: 9 }));
console.log('atlas gz', fs.statSync(path.join(OUT, 'atlas.bin.gz')).size, 'half extent (8nm voxels)', half, 'center', center);

const meta = {
  source: 'FDDD public/engine/malecns/core.js (MaleCNS v1.0, 167,122 neurons, 6,241,236 edges >=5 synapses)',
  dynamicsLabel: info.dynamicsLabel,
  note: '입력 스케줄은 연출용 설정값이며, 스파이크는 커넥톰 LIF 계산 결과입니다. 표시는 brain-atlas 실측 세포체 위치입니다.',
  atlasCount: A, tileSubsetCount: TILE_N, heroSteps: HERO_STEPS, tileSteps: TILE_STEPS, flies: FLIES,
  atlasHalfExtentVoxels: half, atlasCenterVoxels: center,
  regionSizes: Array.from(regionSizes),
  hero: { counts: hero.counts, regionRates: hero.regionRates, motor: hero.motor },
  tiles: tiles.map((t) => ({ counts: t.counts })),
};
fs.writeFileSync(path.join(OUT, 'sim_meta.json'), JSON.stringify(meta));
console.log('done');
