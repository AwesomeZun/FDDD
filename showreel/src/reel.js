'use strict';
// FDDD 모션 쇼릴 렌더 엔진입니다.
// 모든 장면은 시간 t의 순수 함수로 그립니다. 같은 t를 넣으면 언제나 같은 프레임이 나오므로
// 브라우저 재생과 프레임 단위 MP4 렌더가 똑같은 결과를 냅니다.
(() => {
// ─────────────────────────────────────────────────────────── §0 상수 · 유틸
const EDL = window.__EDL;
let W = EDL.width, H = EDL.height;
const FPS = EDL.fps, BPM = EDL.bpm, BEAT = 60 / BPM, BAR = BEAT * 4, STEP_RATE = EDL.stepRate;
const TAU = Math.PI * 2;
const KR = 'PretendardV', MONO = 'JBMono, PretendardV';
const C = {
  bg0: '#03060a', bg1: '#0a1622', ink: '#eef5f2', dim: '#a9bac8', mute: '#6c8194', line: '#1d2b3d', line2: '#2a3d52',
  mint: '#5ef2d0', cyan: '#00d9ff', amber: '#ffc63a', orange: '#ff8b35', violet: '#b76cff', lime: '#a8ef38',
  coral: '#ff6b4a', rose: '#ff5fa8', blue: '#4f7bff', cream: '#f3ead7',
};
const FLY_NAMES = ['ION', 'EMBER', 'ULTRA', 'LIME', 'COBALT', 'AMBER', 'VIOLA', 'MOSS', 'CORAL', 'SLATE', 'OCHRE', 'TEAL', 'ROSE', 'PINE', 'FLAX', 'INDIGO', 'RUST', 'SAGE', 'PEARL', 'ONYX'];
const FLY_ACCENTS = ['#00d9ff', '#ff8b35', '#b76cff', '#a8ef38', '#4f7bff', '#ffc63a', '#ff5fa8', '#3ddc97', '#ff6b4a', '#8fb7c9', '#d9a24a', '#2fc4c4', '#f28cb1', '#5fbf6a', '#e8d97a', '#6c63ff', '#c9673d', '#9ccc65', '#e0e0e0', '#ff9cee'];
const TARGET_STYLE = {
  'parp1-4r6e-chain-a': { short: 'PARP1', color: C.cyan },
  'cox2-3ln1': { short: 'COX-2', color: C.amber },
  'factor-xa-2p16': { short: 'Factor Xa', color: C.violet },
};
const DRUG_NAMES = { '15r': 'PARP1 inhibitor 15R', pamiparib: 'Pamiparib', niraparib: 'Niraparib', rucaparib: 'Rucaparib', celecoxib: 'Celecoxib', apixaban: 'Apixaban' };
// docs/brain-reward-loop.md: 로컬 20마리 약 9분 실행 후 1번 개체의 학습된 선호(%)
const LEARNED_FLY01 = { '15r@parp1-4r6e-chain-a': 99, 'celecoxib@cox2-3ln1': 71, 'pamiparib@parp1-4r6e-chain-a': 64, 'apixaban@factor-xa-2p16': 55,
  'niraparib@parp1-4r6e-chain-a': 55, 'rucaparib@parp1-4r6e-chain-a': 51, 'niraparib@factor-xa-2p16': 28, 'niraparib@cox2-3ln1': 10 };

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const rmap = (x, a, b) => clamp((x - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const E = {
  lin: (t) => t,
  inQuad: (t) => t * t, outQuad: (t) => 1 - (1 - t) * (1 - t), inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t, outCubic: (t) => 1 - (1 - t) ** 3, inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4, outQuart: (t) => 1 - (1 - t) ** 4, inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outQuint: (t) => 1 - (1 - t) ** 5, inQuint: (t) => t ** 5,
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)), inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
};
// 감쇠 스프링(초 단위). 0에서 시작해 1로 수렴하며 살짝 튀어 오릅니다.
const spring = (t, w = 22, z = 0.42) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
const hash2 = (a, b) => hash(a * 57.31 + b * 113.97);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pad = (n, k = 2) => String(Math.floor(n)).padStart(k, '0');
const decay = (dt, k) => (dt < 0 ? 0 : Math.exp(-dt * k));
const pulseAt = (lt, at, k = 10) => decay(lt - at, k);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hexRGB = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`; };

// 열 우선(column-major) 4x4 행렬
const M4 = {
  I: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o; },
  lookAt(e, c, up = [0, 1, 0]) {
    let z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1]);
  },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  T(x, y, z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); },
  S(x, y = x, z = x) { return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]); },
  chain(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); },
  apply(m, v) { const [x, y, z] = v; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]]; },
  basis(r, u, f, p, s = 1) { return new Float32Array([r[0] * s, r[1] * s, r[2] * s, 0, u[0] * s, u[1] * s, u[2] * s, 0, f[0] * s, f[1] * s, f[2] * s, 0, p[0], p[1], p[2], 1]); },
};
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};

// 카메라: 궤도 회전 + 렌즈 시프트(화면상 위치 이동)
function camera({ target = [0, 0, 0], yaw = 0, pitch = 0, dist = 3, fov = 0.6, eye = null, up = [0, 1, 0], shiftX = 0, shiftY = 0, near = 0.01, far = 100, aspect = W / H, roll = 0 }) {
  const e = eye || [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
  let view = M4.lookAt(e, target, up);
  if (roll) view = M4.mul(M4.rotZ(roll), view);
  const proj = M4.persp(fov, aspect, near, far);
  proj[8] -= shiftX; proj[9] -= shiftY;
  return { view, proj, eye: e, vp: M4.mul(proj, view), aspect };
}
// 3D 점을 화면 좌표로 투영합니다. 반환: [x, y, 깊이, 보임여부]
function project(cam, p, vw = W, vh = H) {
  const c = M4.apply(cam.vp, p);
  if (c[3] <= 1e-5) return [0, 0, -1, false];
  return [(c[0] / c[3] * 0.5 + 0.5) * vw, (1 - (c[1] / c[3] * 0.5 + 0.5)) * vh, c[3], true];
}

// ─────────────────────────────────────────────────────────── §1 데이터
const $ = (id) => document.getElementById(id);
function b64bytes(id) {
  const s = $(id).textContent.replace(/\s+/g, '');
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
async function gunzip(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// sim.mjs의 델타 varint 인코딩을 풉니다.
function decodeSteps(u8, off = 0) {
  const dv = new DataView(u8.buffer, u8.byteOffset + off);
  const S = dv.getUint32(0, true);
  const offs = new Uint32Array(S + 1);
  for (let i = 0; i <= S; i++) offs[i] = dv.getUint32(4 + 4 * i, true);
  const base = off + 4 * (S + 2);
  const steps = [];
  for (let s = 0; s < S; s++) {
    let p = base + offs[s]; const end = base + offs[s + 1];
    const out = []; let prev = -1;
    while (p < end) { let v = 0, sh = 0, b; do { b = u8[p++]; v += (b & 0x7f) * 2 ** sh; sh += 7; } while (b & 0x80); prev = prev + 1 + v; out.push(prev); }
    steps.push(Uint32Array.from(out));
  }
  return { steps, bytes: 4 * (S + 2) + offs[S] };
}

const D = {};
async function loadData() {
  const atlas = await gunzip(b64bytes('d-atlas'));
  const dv = new DataView(atlas.buffer);
  const A = dv.getUint32(0, true), TN = dv.getUint32(4, true);
  let o = 8;
  D.atlas = { n: A, tn: TN };
  D.atlas.pos = new Int16Array(atlas.buffer, o, A * 3); o += A * 6;
  D.atlas.region = new Uint8Array(atlas.buffer, o, A); o += A;
  D.atlas.group = new Uint8Array(atlas.buffer, o, A); o += A;
  D.atlas.tileSubset = new Uint32Array(atlas.buffer.slice(o, o + TN * 4));

  D.hero = decodeSteps(await gunzip(b64bytes('d-hero'))).steps;
  const tb = await gunzip(b64bytes('d-tiles'));
  D.tiles = [];
  for (let p = 0; p < tb.length;) { const len = new DataView(tb.buffer, p, 4).getUint32(0, true); D.tiles.push(decodeSteps(tb, p + 4).steps); p += 4 + len; }

  const eb = await gunzip(b64bytes('d-edges'));
  const en = new DataView(eb.buffer).getUint32(0, true);
  const pairs = new Uint32Array(eb.buffer.slice(4, 4 + en * 8));
  D.edges = { n: en, pairs, w: new Uint8Array(eb.buffer.slice(4 + en * 8, 4 + en * 9)) };

  D.fly = await gunzip(b64bytes('d-fly'));
  D.meta = JSON.parse($('d-meta').textContent);
  D.mol = JSON.parse($('d-mol').textContent);
  prepareDerived();
}

// 파생 데이터: 좌표 스케일, 뇌 중심, 선택 뉴런, 단백질 스플라인, 포켓, 보상값
function prepareDerived() {
  const { n, pos, group } = D.atlas;
  const f = 1 / 32767;
  let cx = 0, cy = 0, cz = 0, bx = 0, by = 0, bz = 0, bn = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] * f, y = -pos[i * 3 + 1] * f, z = -pos[i * 3 + 2] * f; // 모델 행렬(rotX π) 적용 후 좌표
    cx += x; cy += y; cz += z;
    if (group[i] <= 2) { bx += x; by += y; bz += z; bn++; }
  }
  D.cnsCenter = [cx / n, cy / n, cz / n];
  D.brainCenter = [bx / bn, by / bn, bz / bn];
  // 세포체는 뇌 표면(피질)에 몰려 있으므로, 앞쪽 표면의 정중선 근처 중앙 뇌 뉴런을 '뉴런 하나'로 씁니다.
  let best = -1, bd = -1e9;
  for (let i = 0; i < n; i++) {
    if (group[i] !== 1) continue;
    const x = pos[i * 3] * f, y = -pos[i * 3 + 1] * f, z = -pos[i * 3 + 2] * f;
    const sc = z - Math.abs(x - D.brainCenter[0]) * 1.3 - Math.abs(y - D.brainCenter[1] - 0.06) * 0.8;
    if (sc > bd) { bd = sc; best = i; }
  }
  // 콜아웃 기준점: 그룹별 중심(시엽은 왼쪽만)
  const acc = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const g = group[i]; if (g > 3) continue;
    const x = pos[i * 3] * f, y = -pos[i * 3 + 1] * f, z = -pos[i * 3 + 2] * f;
    if (g === 0 && x > 0) continue;
    acc[g][0] += x; acc[g][1] += y; acc[g][2] += z; acc[g][3]++;
  }
  D.groupAnchor = acc.map((a) => [a[0] / a[3], a[1] / a[3], a[2] / a[3]]);
  D.groupCount = [0, 1, 2, 3].map((g) => group.reduce((s, v) => s + (v === g ? 1 : 0), 0));
  D.chosen = best;
  D.chosenPos = [pos[best * 3] * f, -pos[best * 3 + 1] * f, -pos[best * 3 + 2] * f];
  D.chosenModel = [pos[best * 3] * f, pos[best * 3 + 1] * f, pos[best * 3 + 2] * f];

  // 도킹 조합 정렬 + 보상(선형 재조정, Best 1.0 · Worst 0.05)
  const combos = D.mol.combinations.slice().sort((a, b) => a.score - b.score);
  const best0 = combos[0].score, worst = combos[combos.length - 1].score;
  combos.forEach((c) => {
    c.reward = 0.05 + 0.95 * (worst - c.score) / (worst - best0);
    c.label = DRUG_NAMES[c.compoundId] || c.name;
    c.style = TARGET_STYLE[c.targetId];
    c.learned = LEARNED_FLY01[c.compoundId + '@' + c.targetId];
  });
  D.combos = combos;
  D.motorRange = [0, 1, 2].map((k) => { let lo = 1e9, hi = -1e9; for (const m of D.meta.hero.motor) { lo = Math.min(lo, m[k]); hi = Math.max(hi, m[k]); } return [lo, hi]; });

  // 단백질 Cα 스플라인(Catmull-Rom, 잔기당 5개 표본)
  D.prot = {};
  for (const [id, t] of Object.entries(D.mol.targets)) {
    const ca = t.ca, ss = t.ss, N = ca.length;
    let c0 = [0, 0, 0]; for (const p of ca) c0 = V3.add(c0, p); c0 = V3.scale(c0, 1 / N);
    const pts = [], sss = [], brk = [];
    const SUB = 5;
    for (let i = 0; i < N - 1; i++) {
      const gap = V3.len(V3.sub(ca[i + 1], ca[i])) > 4.3;
      const p0 = ca[Math.max(0, i - 1)], p1 = ca[i], p2 = ca[i + 1], p3 = ca[Math.min(N - 1, i + 2)];
      for (let k = 0; k < SUB; k++) {
        const u = k / SUB, u2 = u * u, u3 = u2 * u;
        const q = [0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3));
        pts.push(q); sss.push(ss[i]); brk.push(gap && k === SUB - 1);
      }
    }
    pts.push(ca[N - 1]); sss.push(ss[N - 1]); brk.push(false);
    let r = 0; for (const p of ca) r = Math.max(r, V3.len(V3.sub(p, c0)));
    D.prot[id] = { ...t, center: c0, radius: r, pts, sss, brk };
  }
  // 15R 포즈 기준 결합 포켓(리간드 원자 7 Å 이내 Cα)
  const lig = D.combos.find((c) => c.compoundId === '15r');
  const P = D.prot['parp1-4r6e-chain-a'];
  let lc = [0, 0, 0]; for (const a of lig.atoms) lc = V3.add(lc, a); lc = V3.scale(lc, 1 / lig.atoms.length);
  D.ligCenter = lc;
  P.pocket = [];
  P.ca.forEach((p, i) => { let m = 1e9; for (const a of lig.atoms) m = Math.min(m, V3.len(V3.sub(p, a))); if (m < 7) P.pocket.push(i); });
}

// ─────────────────────────────────────────────────────────── §2 WebGL 3D
let g3c, gl, P3 = {};
const POINT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in float aGroup; layout(location=2) in float aRand; layout(location=3) in vec3 aMorph;
uniform mat4 uModel, uView, uProj;
uniform float uStep, uTau, uSize, uSpikeSize, uBase, uSpikeGain, uMorph, uFocus, uDof, uSizeRef, uAlpha, uTime, uHighlight, uNear, uSwirl;
uniform vec4 uReveal; uniform sampler2D uLast; uniform int uIdxOffset, uChosen; uniform vec3 uColors[5];
uniform vec4 uScan; uniform float uScanAmt; uniform vec3 uScanCol;
out vec3 vCol;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  if (uMorph > 0.0) {
    float mt = clamp(uMorph * 1.7 - aRand * 0.7, 0.0, 1.0);
    float e = mt * mt * (3.0 - 2.0 * mt);
    vec3 mid = mix(wp.xyz, aMorph, 0.5) + vec3(sin(aRand * 91.0), cos(aRand * 57.0), sin(aRand * 23.0)) * 0.35 * uSwirl;
    vec3 a = mix(wp.xyz, mid, e), b = mix(mid, aMorph, e);
    wp.xyz = mix(a, b, e);
  }
  vec4 vp = uView * wp;
  gl_Position = uProj * vp;
  int idx = gl_VertexID + uIdxOffset;
  float last = texelFetch(uLast, ivec2(idx & 511, idx >> 9), 0).r;
  float age = uStep - last;
  float sp = age >= 0.0 ? exp(-age / uTau) : 0.0;
  float vis = 1.0;
  if (uReveal.w >= 0.0) { float r = length(aPos - uReveal.xyz); vis = 1.0 - smoothstep(uReveal.w * 0.7, uReveal.w, r); }
  float depth = -vp.z;
  float persp = clamp(uSizeRef / max(depth, 1e-3), 0.3, 40.0);
  float coc = abs(depth - uFocus) * uDof;
  float size = (uSize + sp * uSpikeSize) * persp + coc;
  gl_PointSize = clamp(size, 1.0, 120.0);
  float spread = 1.0 / (1.0 + coc * coc * 0.06);
  vec3 base = uColors[int(aGroup + 0.5)];
  vec3 col = base * uBase + mix(base, vec3(1.0), 0.5) * sp * uSpikeGain;
  float tw = 0.82 + 0.18 * sin(uTime * (1.5 + aRand * 4.0) + aRand * 60.0);
  if (uScanAmt > 0.0) { float dd = abs(dot(wp.xyz, uScan.xyz) - uScan.w); float band = exp(-dd * dd * 900.0); col += uScanCol * band * uScanAmt; size += band * uScanAmt * 1.5; gl_PointSize = clamp(size, 1.0, 120.0); }
  vCol = col * vis * spread * uAlpha * tw;
  if (gl_VertexID + uIdxOffset == uChosen && uHighlight > 0.0) { vCol = mix(vCol, vec3(1.0, 0.97, 0.9), uHighlight); gl_PointSize = max(gl_PointSize, 7.0 * persp * uHighlight); }
  if (depth < uNear) vCol = vec3(0.0);
}`;
const POINT_FS = `#version 300 es
precision highp float;
in vec3 vCol; out vec4 o;
void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0; if (r2 > 1.0) discard; float f = exp(-r2 * 3.2); vec3 c = vCol * f; o = vec4(c, max(c.r, max(c.g, c.b))); }`;
const EDGE_VS = `#version 300 es
precision highp float;
layout(location=0) in float aA; layout(location=1) in float aB; layout(location=2) in float aU; layout(location=3) in float aW;
uniform mat4 uModel, uView, uProj; uniform sampler2D uPosTex, uLast;
uniform float uStep, uTravel, uDraw, uAlpha, uPulse, uBulge; uniform vec3 uCenter, uColA, uColB;
out vec3 vCol;
vec3 P(float i){ int k = int(i + 0.5); return texelFetch(uPosTex, ivec2(k & 511, k >> 9), 0).xyz; }
void main(){
  vec3 A = P(aA), B = P(aB);
  vec3 mid = (A + B) * 0.5; vec3 n = mid - uCenter; n = length(n) > 1e-4 ? normalize(n) : vec3(0.0, 1.0, 0.0);
  float L = length(B - A);
  vec3 p = mix(A, B, aU) + n * sin(3.14159265 * aU) * L * uBulge;
  gl_Position = uProj * uView * uModel * vec4(p, 1.0);
  int ka = int(aA + 0.5);
  float last = texelFetch(uLast, ivec2(ka & 511, ka >> 9), 0).r;
  float age = uStep - last, pp = age / uTravel;
  float pulse = (age >= 0.0 && pp < 1.25) ? exp(-pow((aU - pp) * 6.0, 2.0)) * (1.0 - pp * 0.55) : 0.0;
  float h = fract(sin(aA * 12.9898 + aB * 78.233) * 43758.5453);
  float drawn = smoothstep(0.0, 0.06, uDraw * 1.3 - h * 0.3 - aU);
  vec3 col = mix(uColA, uColB, aU);
  vCol = col * uAlpha * (0.3 + 0.7 * aW) * drawn + vec3(1.0, 0.93, 0.8) * pulse * uPulse * drawn;
}`;
const EDGE_FS = `#version 300 es
precision highp float;
in vec3 vCol; out vec4 o; void main(){ o = vec4(vCol, max(vCol.r, max(vCol.g, vCol.b))); }`;
const MESH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in float aWing;
uniform mat4 uModel, uView, uProj; uniform float uWingAngle; uniform vec3 uHinge;
out vec3 vN; out vec3 vW;
void main(){
  vec3 p = aPos, n = aNor;
  if (abs(aWing) > 0.5) {
    float a = uWingAngle * aWing; vec3 h = vec3(uHinge.x * aWing, uHinge.y, uHinge.z);
    vec3 q = p - h; float c = cos(a), s = sin(a);
    p = h + vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z);
    n = vec3(c * n.x - s * n.y, s * n.x + c * n.y, n.z);
  }
  vec4 wp = uModel * vec4(p, 1.0);
  vW = wp.xyz; vN = mat3(uModel) * n;
  gl_Position = uProj * uView * wp;
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW;
uniform vec3 uColor, uKey, uRimCol, uAmb, uEye; uniform float uSpec, uAlpha, uWing, uRim, uGloss;
out vec4 o;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vW), L = normalize(uKey);
  float ndl = dot(N, L); float wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0);
  vec3 Hh = normalize(L + V); float sp = pow(max(dot(N, Hh), 0.0), uGloss) * uSpec;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  if (uWing > 0.5) {
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.3 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(vec3(0.8, 0.9, 1.0), irid, 0.2) * (0.35 + 0.7 * fres) + sp * 1.2;
    float a = uAlpha * (0.16 + 0.3 * fres);
    o = vec4(col * a, a); return;
  }
  vec3 col = uColor * (uAmb + wrap * 0.82) + vec3(sp) * 0.8 + uRimCol * fres * uRim * 0.6;
  o = vec4(col * uAlpha, uAlpha);
}`;

function compile(g, type, src) { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw Error(g.getShaderInfoLog(s) + '\n' + src.slice(0, 200)); return s; }
function program(g, vs, fs) {
  const p = g.createProgram(); g.attachShader(p, compile(g, g.VERTEX_SHADER, vs)); g.attachShader(p, compile(g, g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw Error(g.getProgramInfoLog(p));
  const u = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = g.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = g.getUniformLocation(p, info.name); }
  return { p, u };
}

function initGL() {
  g3c = document.createElement('canvas'); g3c.width = W; g3c.height = H;
  gl = g3c.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true, depth: true });
  if (!gl) throw Error('WebGL2 is not available.');
  gl.getExtension('EXT_color_buffer_float');
  P3.points = program(gl, POINT_VS, POINT_FS);
  P3.edges = program(gl, EDGE_VS, EDGE_FS);
  P3.mesh = program(gl, MESH_VS, MESH_FS);
  P3.resolve = program(gl, QUAD_VS, RESOLVE_FS);
  P3.quad = gl.createVertexArray(); gl.bindVertexArray(P3.quad);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);

  const { n, pos, group, tileSubset, tn } = D.atlas;
  const rnd = mulberry32(42);
  const rand = new Float32Array(n); for (let i = 0; i < n; i++) rand[i] = rnd();
  D.atlas.rand = rand;
  P3.hero = makeCloud(pos, group, rand, n);
  // 타일용 표본 (9,000개)
  const tp = new Int16Array(tn * 3), tg = new Uint8Array(tn), tr = new Float32Array(tn);
  for (let k = 0; k < tn; k++) { const i = tileSubset[k]; tp.set(pos.subarray(i * 3, i * 3 + 3), k * 3); tg[k] = group[i]; tr[k] = rand[i]; }
  P3.tile = makeCloud(tp, tg, tr, tn);

  P3.lastHero = makeFloatTex(512, Math.ceil(n / 512));
  P3.lastHeroBuf = new Float32Array(512 * Math.ceil(n / 512));
  P3.lastTiles = makeFloatTex(512, Math.ceil((tn * 20) / 512));
  P3.lastTilesBuf = new Float32Array(512 * Math.ceil((tn * 20) / 512));
  // 연결선용 위치 텍스처(모델 공간 정규화 좌표)
  const ph = Math.ceil(n / 512), pbuf = new Float32Array(512 * ph * 4);
  for (let i = 0; i < n; i++) { pbuf[i * 4] = pos[i * 3] / 32767; pbuf[i * 4 + 1] = pos[i * 3 + 1] / 32767; pbuf[i * 4 + 2] = pos[i * 3 + 2] / 32767; pbuf[i * 4 + 3] = 1; }
  P3.posTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, P3.posTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 512, ph, 0, gl.RGBA, gl.FLOAT, pbuf);
  texParams();
  // 연결선 정점: 연결 하나당 14개 선분
  const SEG = 14, en = D.edges.n, ev = new Float32Array(en * SEG * 2 * 4);
  let o = 0;
  for (let e = 0; e < en; e++) {
    const a = D.edges.pairs[e * 2], b = D.edges.pairs[e * 2 + 1], w = D.edges.w[e] / 255;
    for (let s = 0; s < SEG; s++) for (const u of [s / SEG, (s + 1) / SEG]) { ev[o++] = a; ev[o++] = b; ev[o++] = u; ev[o++] = Math.sqrt(w); }
  }
  P3.edgeVAO = gl.createVertexArray(); gl.bindVertexArray(P3.edgeVAO);
  const eb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, eb); gl.bufferData(gl.ARRAY_BUFFER, ev, gl.STATIC_DRAW);
  for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 1, gl.FLOAT, false, 16, k * 4); }
  P3.edgeCount = en * SEG * 2;
  gl.bindVertexArray(null);
  initFlyMesh();
}
function texParams() { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
function makeFloatTex(w, h) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, null); texParams(); return { t, w, h }; }
function makeCloud(pos, group, rand, n) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const b0 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b0); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, true, 0, 0);
  const b1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b1); gl.bufferData(gl.ARRAY_BUFFER, group, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.UNSIGNED_BYTE, false, 0, 0);
  const b2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b2); gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
  const b3 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b3); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n * 3), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, n, morphBuf: b3 };
}

// 발화 기록 → '마지막 발화 스텝' 텍스처. 스텝 번호는 루프 없이 계속 증가하므로 감쇠가 끊기지 않습니다.
function updateLastSpikes(steps, stepF, buf, offset, count, K = 10) {
  const S = steps.length, s = Math.floor(stepF);
  buf.fill(-1e4, offset, offset + count);
  for (let j = s - K + 1; j <= s; j++) {
    const list = steps[((j % S) + S) % S];
    for (let q = 0; q < list.length; q++) buf[offset + list[q]] = j;
  }
}
let lastHeroKey = null;
function uploadHero(stepF) {
  const key = Math.floor(stepF);
  if (key === lastHeroKey) return;
  lastHeroKey = key;
  updateLastSpikes(D.hero, stepF, P3.lastHeroBuf, 0, D.atlas.n);
  gl.bindTexture(gl.TEXTURE_2D, P3.lastHero.t);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, P3.lastHero.w, P3.lastHero.h, gl.RED, gl.FLOAT, P3.lastHeroBuf);
}
let lastTilesKey = null;
function uploadTiles(stepF) {
  const key = Math.floor(stepF);
  if (key === lastTilesKey) return;
  lastTilesKey = key;
  for (let f = 0; f < 20; f++) updateLastSpikes(D.tiles[f], stepF + f * 3, P3.lastTilesBuf, f * D.atlas.tn, D.atlas.tn, 8);
  gl.bindTexture(gl.TEXTURE_2D, P3.lastTiles.t);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, P3.lastTiles.w, P3.lastTiles.h, gl.RED, gl.FLOAT, P3.lastTilesBuf);
}
function tileStepOffset(f) { return f * 3; }

const GROUP_COLORS = [[0.16, 0.72, 0.9], [1.0, 0.8, 0.58], [1.0, 0.62, 0.18], [0.62, 0.42, 1.0], [0.45, 0.55, 0.6]];
const BRAIN_MODEL = M4.rotX(Math.PI);
// 점 구름은 RGBA16F 버퍼에 더한 뒤 톤매핑합니다. 밀집 영역도 흰색으로 날아가지 않고 색을 유지합니다.
const RESOLVE_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uExp; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float L = max(c.r, max(c.g, c.b));
  c *= (1.0 - exp(-L * uExp)) / max(L, 1e-4);
  float m = max(c.r, max(c.g, c.b));
  c = mix(c, vec3(m), smoothstep(0.72, 1.0, m) * 0.4);
  o = vec4(c, m);
}`;
function ensureHDR() {
  const w = g3c.width, h = g3c.height;
  if (P3.hdr && P3.hdr.w === w && P3.hdr.h === h) return;
  if (P3.hdr) { gl.deleteTexture(P3.hdr.tex); gl.deleteFramebuffer(P3.hdr.fb); }
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  P3.hdr = { tex, fb, w, h };
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function gl3Begin(clear = true, vp = null, hdr = false) {
  if (hdr) { ensureHDR(); gl.bindFramebuffer(gl.FRAMEBUFFER, P3.hdr.fb); } else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  P3.inHDR = hdr;
  gl.disable(gl.SCISSOR_TEST);
  gl.viewport(0, 0, g3c.width, g3c.height);
  if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
  if (vp) gl.viewport(vp[0], g3c.height - vp[1] - vp[3], vp[2], vp[3]);
}
function gl3Resolve(exposure = 1.2) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, g3c.width, g3c.height); gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  gl.useProgram(P3.resolve.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P3.hdr.tex); gl.uniform1i(P3.resolve.u.uTex, 0);
  gl.uniform1f(P3.resolve.u.uExp, exposure);
  gl.bindVertexArray(P3.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
  P3.inHDR = false;
}
function drawCloud(cloud, o) {
  const { p, u } = P3.points;
  gl.useProgram(p);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
  gl.uniformMatrix4fv(u.uModel, false, o.model || BRAIN_MODEL);
  gl.uniformMatrix4fv(u.uView, false, o.cam.view);
  gl.uniformMatrix4fv(u.uProj, false, o.cam.proj);
  gl.uniform1f(u.uStep, o.step); gl.uniform1f(u.uTau, o.tau ?? 1.4);
  gl.uniform1f(u.uSize, o.size ?? 1.6); gl.uniform1f(u.uSpikeSize, o.spikeSize ?? 2.4);
  gl.uniform1f(u.uBase, o.base ?? 0.1); gl.uniform1f(u.uSpikeGain, o.spikeGain ?? 1.0);
  gl.uniform1f(u.uMorph, o.morph ?? 0); gl.uniform1f(u.uSwirl, o.swirl ?? 1);
  gl.uniform1f(u.uFocus, o.focus ?? 3); gl.uniform1f(u.uDof, o.dof ?? 0);
  gl.uniform1f(u.uSizeRef, o.sizeRef ?? 3); gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uTime, o.time ?? 0);
  gl.uniform1f(u.uHighlight, o.highlight ?? 0); gl.uniform1i(u.uChosen, o.chosen ?? -1); gl.uniform1f(u.uNear, o.near ?? 0.005);
  gl.uniform4fv(u.uReveal, o.reveal || [0, 0, 0, -1]);
  gl.uniform4fv(u.uScan, o.scan || [0, 1, 0, 0]); gl.uniform1f(u.uScanAmt, o.scanAmt || 0); gl.uniform3fv(u.uScanCol, o.scanCol || [0.35, 1.0, 0.85]);
  gl.uniform1i(u.uIdxOffset, o.idxOffset || 0);
  gl.uniform3fv(u.uColors, new Float32Array((o.colors || GROUP_COLORS).flat()));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.lastTex.t); gl.uniform1i(u.uLast, 0);
  gl.bindVertexArray(cloud.vao);
  gl.drawArrays(gl.POINTS, 0, cloud.n);
  gl.bindVertexArray(null);
}
function drawEdges(o) {
  const { p, u } = P3.edges;
  gl.useProgram(p);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
  gl.uniformMatrix4fv(u.uModel, false, BRAIN_MODEL);
  gl.uniformMatrix4fv(u.uView, false, o.cam.view); gl.uniformMatrix4fv(u.uProj, false, o.cam.proj);
  gl.uniform1f(u.uStep, o.step); gl.uniform1f(u.uTravel, o.travel ?? 2.2); gl.uniform1f(u.uDraw, o.draw ?? 1);
  gl.uniform1f(u.uAlpha, o.alpha ?? 0.1); gl.uniform1f(u.uPulse, o.pulse ?? 0.8); gl.uniform1f(u.uBulge, o.bulge ?? 0.18);
  gl.uniform3fv(u.uCenter, [D.cnsCenter[0], -D.cnsCenter[1], -D.cnsCenter[2]]);
  gl.uniform3fv(u.uColA, o.colA || [0.2, 0.75, 0.85]); gl.uniform3fv(u.uColB, o.colB || [0.75, 0.55, 1.0]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P3.posTex); gl.uniform1i(u.uPosTex, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P3.lastHero.t); gl.uniform1i(u.uLast, 1);
  gl.bindVertexArray(P3.edgeVAO);
  gl.drawArrays(gl.LINES, 0, P3.edgeCount);
  gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE0);
}

// flybody 메시 (Apache-2.0) — 날개막과 시맥을 좌우 날개로 분류해 날갯짓을 줍니다.
const FLY_MAT = {
  body: { color: [0.74, 0.52, 0.3], spec: 0.22, gloss: 30 }, black: { color: [0.08, 0.065, 0.06], spec: 0.5, gloss: 60 },
  red: { color: [0.62, 0.1, 0.06], spec: 0.9, gloss: 90 }, ocelli: { color: [0.95, 0.75, 0.35], spec: 0.6, gloss: 60 },
  'bristle-brown': { color: [0.25, 0.17, 0.11], spec: 0.2, gloss: 20 }, lower: { color: [0.62, 0.43, 0.25], spec: 0.2, gloss: 24 },
  brown: { color: [0.32, 0.21, 0.12], spec: 0.3, gloss: 30 }, membrane: { wing: true, color: [0.8, 0.9, 1.0], spec: 0.8, gloss: 70 },
};
function initFlyMesh() {
  const u8 = D.fly, dv = new DataView(u8.buffer);
  const hl = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(4, 4 + hl)));
  const base = 4 + hl, half = header.half, ctr = header.center;
  P3.fly = { parts: [] };
  let hinge = [0.05, 0.01, -0.01], hx = 1e9;
  for (const part of header.parts) {
    const q = new Int16Array(u8.buffer.slice(base + part.offset, base + part.offset + part.verts * 6));
    const idx = new Uint16Array(u8.buffer.slice(base + part.offset + part.verts * 6, base + part.offset + part.verts * 6 + part.indices * 2));
    const pos = new Float32Array(part.verts * 3);
    for (let i = 0; i < part.verts * 3; i++) pos[i] = (q[i] / 32767) * half + ctr[i % 3];
    const nor = new Float32Array(part.verts * 3);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const nn = V3.cross(e1, e2);
      for (const v of [a, b, c]) { nor[v] += nn[0]; nor[v + 1] += nn[1]; nor[v + 2] += nn[2]; }
    }
    for (let i = 0; i < part.verts; i++) { const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1; nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l; }
    const wing = new Float32Array(part.verts);
    for (let i = 0; i < part.verts; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1];
      if (part.material === 'membrane' || (part.material === 'brown' && Math.abs(x) > 0.05 && y > -0.012)) wing[i] = Math.sign(x);
      if (part.material === 'membrane' && x > 0 && x < hx) { hx = x; hinge = [x, y, pos[i * 3 + 2]]; }
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    for (const [loc, arr, k] of [[0, pos, 3], [1, nor, 3], [2, wing, 1]]) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0);
    }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    P3.fly.parts.push({ vao, count: idx.length, mat: FLY_MAT[part.material] || FLY_MAT.body });
  }
  P3.fly.hinge = [hinge[0] - 0.004, hinge[1], hinge[2]];
}
// 초파리 한 마리를 그립니다. 날개는 셔터 시간 동안 여러 각도로 겹쳐 모션 블러를 냅니다.
function drawFlyGL(o) {
  const { p, u } = P3.mesh;
  gl.useProgram(p);
  gl.uniformMatrix4fv(u.uModel, false, o.model);
  gl.uniformMatrix4fv(u.uView, false, o.cam.view); gl.uniformMatrix4fv(u.uProj, false, o.cam.proj);
  gl.uniform3fv(u.uKey, o.key || [-0.4, 0.9, 0.6]); gl.uniform3fv(u.uRimCol, o.rimCol || [0.2, 0.85, 1.0]);
  gl.uniform3fv(u.uAmb, o.amb || [0.1, 0.13, 0.16]); gl.uniform3fv(u.uEye, o.cam.eye); gl.uniform1f(u.uRim, o.rim ?? 1.0);
  gl.uniform3fv(u.uHinge, P3.fly.hinge);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const alpha = o.alpha ?? 1;
  const WS = o.wingBlur ? 24 : 1;
  const wingAt = (k) => o.wing + (o.wingBlur || 0) * (k / (WS - 1) - 0.5);
  for (const part of P3.fly.parts) {
    if (part.mat.wing) continue;
    gl.uniform3fv(u.uColor, part.mat.color); gl.uniform1f(u.uSpec, part.mat.spec); gl.uniform1f(u.uGloss, part.mat.gloss);
    gl.uniform1f(u.uAlpha, alpha); gl.uniform1f(u.uWing, 0); gl.uniform1f(u.uWingAngle, o.wing);
    gl.bindVertexArray(part.vao); gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_SHORT, 0);
  }
  gl.depthMask(false);
  for (const part of P3.fly.parts) {
    if (!part.mat.wing) continue;
    gl.uniform3fv(u.uColor, part.mat.color); gl.uniform1f(u.uSpec, part.mat.spec); gl.uniform1f(u.uGloss, part.mat.gloss); gl.uniform1f(u.uWing, 1);
    for (let k = 0; k < WS; k++) {
      gl.uniform1f(u.uWingAngle, WS > 1 ? wingAt(k) : o.wing); gl.uniform1f(u.uAlpha, (alpha * 1.25) / Math.sqrt(WS));
      gl.bindVertexArray(part.vao); gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_SHORT, 0);
    }
  }
  gl.depthMask(true); gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
}

// ─────────────────────────────────────────────────────────── §3 후처리(블룸 · 색수차 · 그레인)
let out, pgl, PP = {};
const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh, uKnee; out vec4 o;
void main(){
  vec3 c = (texture(uTex, vUV + uTexel * vec2(-1,-1)).rgb + texture(uTex, vUV + uTexel * vec2(1,-1)).rgb + texture(uTex, vUV + uTexel * vec2(-1,1)).rgb + texture(uTex, vUV + uTexel * vec2(1,1)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  float k = max(soft, br - uThresh) / max(br, 1e-4);
  o = vec4(c * k, 1.0);
}`;
const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 h = uTexel * 0.5; vec3 s = texture(uTex, vUV).rgb * 4.0;
  s += texture(uTex, vUV - h).rgb; s += texture(uTex, vUV + h).rgb; s += texture(uTex, vUV + vec2(h.x, -h.y)).rgb; s += texture(uTex, vUV - vec2(h.x, -h.y)).rgb;
  o = vec4(s / 8.0, 1.0); }`;
const UP_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 h = uTexel * 0.5; vec3 s = vec3(0.0);
  s += texture(uTex, vUV + vec2(-h.x * 2.0, 0.0)).rgb; s += texture(uTex, vUV + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, h.y * 2.0)).rgb; s += texture(uTex, vUV + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(h.x * 2.0, 0.0)).rgb; s += texture(uTex, vUV + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, -h.y * 2.0)).rgb; s += texture(uTex, vUV + vec2(-h.x, -h.y)).rgb * 2.0;
  o = vec4(s / 12.0, 1.0); }`;
const STREAK_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec3 s = vec3(0.0); float ws = 0.0;
  for (int k = -28; k <= 28; k++) { float w = exp(-abs(float(k)) / 7.0); vec3 v = texture(uTex, vUV + vec2(float(k) * uTexel.x * 2.0, 0.0)).rgb; s += max(v - 0.32, 0.0) * w; ws += w; }
  o = vec4(s / ws, 1.0); }`;
const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene, uBloom, uStreak; uniform float uStreakAmt;
uniform float uBloomAmt, uCA, uGrain, uVig, uTime, uFlash, uZoom, uGlitch, uExposure; uniform vec2 uShake, uRes; out vec4 o;
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = (vUV - 0.5) / uZoom + 0.5 + uShake;
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 36.0); float fr = floor(uTime * 30.0);
    if (h11(band * 7.1 + fr) < uGlitch * 0.55) uv.x += (h11(band * 3.3 + fr * 1.7) - 0.5) * 0.16 * uGlitch;
    float band2 = floor(uv.y * 9.0);
    if (h11(band2 * 1.9 + fr * 0.7) < uGlitch * 0.3) uv.y += (h11(band2 + fr) - 0.5) * 0.02 * uGlitch;
  }
  vec2 d = uv - 0.5; float ca = uCA * (0.35 + dot(d, d) * 2.2);
  vec3 col;
  col.r = texture(uScene, uv + d * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - d * ca).b;
  if (uGlitch > 0.0) { float fr = floor(uTime * 30.0); float band = floor(uv.y * 36.0); if (h11(band * 5.7 + fr * 2.3) < uGlitch * 0.25) col = col.bgr * 1.4; }
  col += texture(uBloom, uv).rgb * uBloomAmt;
  col += texture(uStreak, uv).rgb * vec3(0.45, 0.8, 1.0) * uStreakAmt;
  col *= uExposure;
  float fl = clamp(uFlash, 0.0, 1.0);
  col = mix(col * (1.0 + fl * 2.4) + vec3(fl * 0.16), vec3(1.0), smoothstep(0.62, 1.0, fl));
  float v = smoothstep(0.25, 1.05, length(d * vec2(1.0, 0.95)) * 1.3);
  col *= 1.0 - uVig * v;
  float g = h12(floor(gl_FragCoord.xy * 0.5) + fract(uTime * 13.37) * 1000.0) - 0.5;
  float g2 = h12(gl_FragCoord.xy + 17.0) - 0.5;
  col += g * uGrain * (0.5 + 0.5 * (1.0 - dot(col, vec3(0.333)))) + g2 * (1.0 / 255.0);
  col = clamp(col, 0.0, 1.0);
  o = vec4(col, 1.0);
}`;
function initPost() {
  out = $('out');
  pgl = out.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  pgl.getExtension('EXT_color_buffer_float');
  PP.bright = program(pgl, QUAD_VS, BRIGHT_FS); PP.down = program(pgl, QUAD_VS, DOWN_FS); PP.up = program(pgl, QUAD_VS, UP_FS); PP.final = program(pgl, QUAD_VS, FINAL_FS); PP.streak = program(pgl, QUAD_VS, STREAK_FS);
  PP.vao = pgl.createVertexArray(); pgl.bindVertexArray(PP.vao);
  const b = pgl.createBuffer(); pgl.bindBuffer(pgl.ARRAY_BUFFER, b); pgl.bufferData(pgl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), pgl.STATIC_DRAW);
  pgl.enableVertexAttribArray(0); pgl.vertexAttribPointer(0, 2, pgl.FLOAT, false, 0, 0);
  pgl.bindVertexArray(null);
  PP.scene = pgl.createTexture(); pgl.bindTexture(pgl.TEXTURE_2D, PP.scene);
  pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MIN_FILTER, pgl.LINEAR); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MAG_FILTER, pgl.LINEAR);
  pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_S, pgl.CLAMP_TO_EDGE); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_T, pgl.CLAMP_TO_EDGE);
  buildBloomChain();
}
function buildBloomChain() {
  if (PP.mips) for (const m of PP.mips) { pgl.deleteTexture(m.tex); pgl.deleteFramebuffer(m.fb); }
  if (PP.streakT) { pgl.deleteTexture(PP.streakT.tex); pgl.deleteFramebuffer(PP.streakT.fb); }
  PP.mips = [];
  let w = W >> 1, h = H >> 1;
  for (let i = 0; i < 6; i++) {
    const tex = pgl.createTexture(); pgl.bindTexture(pgl.TEXTURE_2D, tex);
    pgl.texImage2D(pgl.TEXTURE_2D, 0, pgl.RGBA16F, w, h, 0, pgl.RGBA, pgl.HALF_FLOAT, null);
    pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MIN_FILTER, pgl.LINEAR); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MAG_FILTER, pgl.LINEAR);
    pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_S, pgl.CLAMP_TO_EDGE); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_T, pgl.CLAMP_TO_EDGE);
    const fb = pgl.createFramebuffer(); pgl.bindFramebuffer(pgl.FRAMEBUFFER, fb); pgl.framebufferTexture2D(pgl.FRAMEBUFFER, pgl.COLOR_ATTACHMENT0, pgl.TEXTURE_2D, tex, 0);
    PP.mips.push({ tex, fb, w, h });
    w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
  }
  {
    const sw = W >> 2, sh = H >> 2, tex = pgl.createTexture(); pgl.bindTexture(pgl.TEXTURE_2D, tex);
    pgl.texImage2D(pgl.TEXTURE_2D, 0, pgl.RGBA16F, sw, sh, 0, pgl.RGBA, pgl.HALF_FLOAT, null);
    pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MIN_FILTER, pgl.LINEAR); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_MAG_FILTER, pgl.LINEAR);
    pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_S, pgl.CLAMP_TO_EDGE); pgl.texParameteri(pgl.TEXTURE_2D, pgl.TEXTURE_WRAP_T, pgl.CLAMP_TO_EDGE);
    const fb = pgl.createFramebuffer(); pgl.bindFramebuffer(pgl.FRAMEBUFFER, fb); pgl.framebufferTexture2D(pgl.FRAMEBUFFER, pgl.COLOR_ATTACHMENT0, pgl.TEXTURE_2D, tex, 0);
    PP.streakT = { tex, fb, w: sw, h: sh };
  }
  pgl.bindFramebuffer(pgl.FRAMEBUFFER, null);
}
function pass(prog, src, dst, texel, uni = {}) {
  pgl.useProgram(prog.p);
  pgl.bindFramebuffer(pgl.FRAMEBUFFER, dst ? dst.fb : null);
  pgl.viewport(0, 0, dst ? dst.w : out.width, dst ? dst.h : out.height);
  pgl.activeTexture(pgl.TEXTURE0); pgl.bindTexture(pgl.TEXTURE_2D, src); pgl.uniform1i(prog.u.uTex, 0);
  if (prog.u.uTexel) pgl.uniform2f(prog.u.uTexel, texel[0], texel[1]);
  for (const [k, v] of Object.entries(uni)) if (prog.u[k] != null) (Array.isArray(v) ? pgl['uniform' + v.length + 'fv'](prog.u[k], v) : pgl.uniform1f(prog.u[k], v));
  pgl.bindVertexArray(PP.vao); pgl.drawArrays(pgl.TRIANGLE_STRIP, 0, 4);
}
function postProcess(src, fx, t) {
  pgl.bindTexture(pgl.TEXTURE_2D, PP.scene);
  pgl.pixelStorei(pgl.UNPACK_FLIP_Y_WEBGL, true);
  pgl.texImage2D(pgl.TEXTURE_2D, 0, pgl.RGBA, pgl.RGBA, pgl.UNSIGNED_BYTE, src);
  pgl.pixelStorei(pgl.UNPACK_FLIP_Y_WEBGL, false);
  pgl.disable(pgl.BLEND);
  const m = PP.mips;
  pass(PP.bright, PP.scene, m[0], [1 / W, 1 / H], { uThresh: fx.thresh, uKnee: 0.25 });
  for (let i = 1; i < m.length; i++) pass(PP.down, m[i - 1].tex, m[i], [1 / m[i - 1].w, 1 / m[i - 1].h]);
  pass(PP.streak, m[1].tex, PP.streakT, [1 / PP.streakT.w, 1 / PP.streakT.h]);
  pgl.enable(pgl.BLEND); pgl.blendFunc(pgl.ONE, pgl.ONE);
  for (let i = m.length - 1; i > 0; i--) pass(PP.up, m[i].tex, m[i - 1], [1 / m[i].w, 1 / m[i].h]);
  pgl.disable(pgl.BLEND);
  const f = PP.final;
  pgl.useProgram(f.p); pgl.bindFramebuffer(pgl.FRAMEBUFFER, null); pgl.viewport(0, 0, out.width, out.height);
  pgl.activeTexture(pgl.TEXTURE0); pgl.bindTexture(pgl.TEXTURE_2D, PP.scene); pgl.uniform1i(f.u.uScene, 0);
  pgl.activeTexture(pgl.TEXTURE1); pgl.bindTexture(pgl.TEXTURE_2D, m[0].tex); pgl.uniform1i(f.u.uBloom, 1);
  pgl.activeTexture(pgl.TEXTURE2); pgl.bindTexture(pgl.TEXTURE_2D, PP.streakT.tex); pgl.uniform1i(f.u.uStreak, 2); pgl.uniform1f(f.u.uStreakAmt, fx.streak);
  pgl.uniform1f(f.u.uBloomAmt, fx.bloom); pgl.uniform1f(f.u.uCA, fx.ca); pgl.uniform1f(f.u.uGrain, fx.grain); pgl.uniform1f(f.u.uVig, fx.vig);
  pgl.uniform1f(f.u.uTime, t); pgl.uniform1f(f.u.uFlash, fx.flash); pgl.uniform1f(f.u.uZoom, fx.zoom); pgl.uniform1f(f.u.uGlitch, fx.glitch);
  pgl.uniform1f(f.u.uExposure, fx.exposure); pgl.uniform2f(f.u.uShake, fx.shakeX, fx.shakeY); pgl.uniform2f(f.u.uRes, W, H);
  pgl.bindVertexArray(PP.vao); pgl.drawArrays(pgl.TRIANGLE_STRIP, 0, 4);
  pgl.activeTexture(pgl.TEXTURE0);
}

// ─────────────────────────────────────────────────────────── §4 2D 도우미
let c2, ctx, L1, L2, SNAP;
function mkCanvas(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function setFont(c, w, px, fam = KR, ls = 0) { c.font = `${w} ${px}px ${fam}`; c.letterSpacing = `${ls}px`; }
function text(c, s, x, y, o = {}) {
  const { w = 700, px = 40, fam = KR, color = C.ink, align = 'left', base = 'alphabetic', alpha = 1, ls = 0 } = o;
  setFont(c, w, px, fam, ls); c.textAlign = align; c.textBaseline = base;
  c.globalAlpha = alpha; c.fillStyle = color; c.fillText(s, x, y); c.globalAlpha = 1;
}
function textWidth(c, s, w, px, fam = KR, ls = 0) { setFont(c, w, px, fam, ls); return c.measureText(s).width; }
// 글자 단위 등장: 아래에서 솟으며 선명해집니다. p는 0→1 진행도.
function riseText(c, s, x, y, p, o = {}) {
  const { w = 800, px = 80, fam = KR, color = C.ink, align = 'left', ls = 0, stagger = 0.06, dist = 0.9, blur = true, alpha = 1, colors = null, out: pOut = 0 } = o;
  setFont(c, w, px, fam, ls); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const chars = [...s];
  const xs = []; let acc = 0;
  for (let i = 0; i < chars.length; i++) { xs.push(c.measureText(chars.slice(0, i).join('')).width); }
  const total = c.measureText(s).width;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = chars.length, span = 1 + stagger * (n - 1);
  c.save();
  c.beginPath(); c.rect(x0 - px, y - px * 1.05, total + px * 2, px * 1.4); c.clip();
  for (let i = 0; i < n; i++) {
    const li = clamp(p * span - i * stagger);
    const lo = clamp(pOut * span - i * stagger);
    if (li <= 0 || lo >= 1) continue;
    const e = E.outExpo(li), eo = E.inExpo(lo);
    const dy = (1 - e) * px * dist - eo * px * dist;
    c.globalAlpha = alpha * Math.min(e * 1.2, 1) * (1 - eo);
    c.fillStyle = colors ? colors[i] || color : color;
    if (blur && e < 0.98) c.filter = `blur(${((1 - e) * px * 0.08).toFixed(2)}px)`;
    c.fillText(chars[i], x0 + xs[i], y + dy);
    c.filter = 'none';
  }
  c.restore(); c.globalAlpha = 1;
  return total;
}
// 색 막대가 지나가며 글자를 드러내는 타이틀. p 0→1, out 0→1.
function wipeText(c, s, x, y, p, o = {}) {
  const { w = 850, px = 88, fam = KR, color = C.ink, bar = C.mint, align = 'left', ls = 0, out: q = 0, alpha = 1 } = o;
  if (p <= 0 || q >= 1) return 0;
  setFont(c, w, px, fam, ls); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const tw = c.measureText(s).width;
  const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const top = y - px * 0.86, hh = px * 1.08;
  const a = E.inOutExpo(clamp(p / 0.5)), b = E.inOutExpo(clamp((p - 0.45) / 0.55));
  const qa = E.inOutExpo(clamp(q / 0.5)), qb = E.inOutExpo(clamp((q - 0.4) / 0.6));
  c.save(); c.globalAlpha = alpha;
  // 나가는 동작: 막대가 다시 덮은 뒤 오른쪽으로 빠집니다.
  const visL = x0 + tw * qb, visR = x0 + tw * b;
  if (visR - visL > 0) { c.save(); c.beginPath(); c.rect(visL, top - 20, visR - visL, hh + 40); c.clip(); c.fillStyle = color; c.fillText(s, x0, y); c.restore(); }
  let bl, br;
  if (q > 0) { bl = x0 + tw * qb; br = x0 + tw * qa; } else { bl = x0 + tw * b; br = x0 + tw * a; }
  if (br - bl > 0.5) { c.fillStyle = bar; c.fillRect(bl, top, br - bl, hh); }
  c.restore();
  return tw;
}
// 3D 기준점에 붙어 다니는 콜아웃
function callout(c, cam, anchor, o) {
  const p = project(cam, anchor); if (!p[3]) return;
  const { label, sub, prog, dx = 1, dy = -1, alpha = 1, color = C.mint, len = 150, seed = 1, t = 0 } = o;
  if (prog <= 0) return;
  const e1 = E.outCubic(rmap(prog, 0, 0.35)), e2 = E.outCubic(rmap(prog, 0.25, 0.65)), e3 = rmap(prog, 0.45, 1);
  const x1 = p[0] + dx * 56, y1 = p[1] + dy * 56, x2 = x1 + dx * len;
  c.save(); c.globalAlpha = alpha;
  c.strokeStyle = color; c.lineWidth = 1.4;
  c.beginPath(); c.arc(p[0], p[1], 5 + 5 * (1 - e1), 0, TAU); c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(p[0], p[1], 2, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(p[0] + dx * 5 * 0.7, p[1] + dy * 5 * 0.7); c.lineTo(lerp(p[0], x1, e1), lerp(p[1], y1, e1));
  if (e2 > 0) c.lineTo(lerp(x1, x2, e2), y1);
  c.stroke();
  if (e3 > 0) {
    const ax = dx > 0 ? x1 + 6 : x2 + 6;
    text(c, scramble(label, e3, seed, t), ax, y1 - 12, { w: 700, px: 21, color: C.ink, alpha });
    text(c, scramble(sub, e3, seed + 5, t), ax, y1 + 24, { fam: MONO, w: 500, px: 14, color, alpha: alpha * 0.9, ls: 1 });
  }
  c.restore();
}
const GLYPHS = '01<>/#%*+=-:ABCDEFXYZ';
function scramble(s, p, seed, t) {
  let o = ''; const n = s.length;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * 0.75;
    if (s[i] === ' ') { o += ' '; continue; }
    if (p >= th + 0.25) o += s[i];
    else if (p >= th) o += GLYPHS[Math.floor(hash2(seed + i * 13.1, Math.floor(t * 40)) * GLYPHS.length)];
  }
  return o;
}
// 자리마다 굴러가는 숫자(오도미터). 최종 문자열 폭에 맞춰 칸을 고정하고, 윗자리는 아랫자리가 넘어갈 때만 굴러갑니다.
function rollNumber(c, value, finalStr, x, y, o = {}) {
  const { w = 900, px = 200, fam = KR, color = C.ink, align = 'left', alpha = 1, ls = -2 } = o;
  setFont(c, w, px, fam, 0); c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  let dw = 0; for (let d = 0; d < 10; d++) dw = Math.max(dw, c.measureText(String(d)).width);
  const chars = [...finalStr];
  const isD = (ch) => ch >= '0' && ch <= '9';
  const widths = chars.map((ch) => (isD(ch) ? dw * 0.94 : c.measureText(ch).width * 0.92) + ls);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const nDig = chars.filter(isD).length;
  const decimals = finalStr.includes('.') ? finalStr.length - finalStr.indexOf('.') - 1 : 0;
  const v = Math.abs(value) * 10 ** decimals;
  c.save();
  c.beginPath(); c.rect(cx - 40, y - px * 0.92, total + 80, px * 1.0); c.clip();
  c.fillStyle = color;
  let place = nDig - 1;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], cw = widths[i];
    if (isD(ch)) {
      const pv = 10 ** place;
      let d0, roll;
      if (place === 0) { const dv = v % 10; d0 = Math.floor(dv); roll = dv - d0; }
      else { d0 = Math.floor(v / pv) % 10; const lower = (v % pv) / pv; roll = lower > 0.9 ? E.inOutQuad((lower - 0.9) / 0.1) : 0; }
      const lead = place > decimals && v < pv; // 아직 나타나지 않은 윗자리
      c.globalAlpha = alpha;
      if (!lead) c.fillText(String(d0), cx + cw / 2, y - roll * px);
      if (roll > 0.001) c.fillText(String((d0 + 1) % 10), cx + cw / 2, y + (1 - roll) * px);
      place--;
    } else {
      c.globalAlpha = alpha * (v >= 10 ** (place + 1) || place < decimals ? 1 : 0);
      c.fillText(ch, cx + cw / 2, y);
    }
    cx += cw;
  }
  c.restore(); c.globalAlpha = 1;
  return total;
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function chip(c, s, x, y, o = {}) {
  const { px = 16, fam = MONO, w = 600, color = C.mint, bg = 'rgba(94,242,208,0.08)', border = 'rgba(94,242,208,0.45)', alpha = 1, dot = true, ls = 2 } = o;
  const tw = textWidth(c, s, w, px, fam, ls);
  const h = px * 2, pw = tw + px * 1.6 + (dot ? px : 0);
  c.globalAlpha = alpha;
  roundRect(c, x, y - h / 2, pw, h, 4); c.fillStyle = bg; c.fill(); c.strokeStyle = border; c.lineWidth = 1; c.stroke();
  if (dot) { c.beginPath(); c.arc(x + px * 0.95, y, px * 0.24, 0, TAU); c.fillStyle = color; c.fill(); }
  text(c, s, x + px * 0.8 + (dot ? px * 0.85 : 0), y + px * 0.36, { px, fam, w, color, ls, alpha });
  c.globalAlpha = 1;
  return pw;
}
function brackets(c, x, y, w, h, len = 18, color = C.line2, lw = 1.5, alpha = 1) {
  c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
  c.moveTo(x, y + len); c.lineTo(x, y); c.lineTo(x + len, y);
  c.moveTo(x + w - len, y); c.lineTo(x + w, y); c.lineTo(x + w, y + len);
  c.moveTo(x + w, y + h - len); c.lineTo(x + w, y + h); c.lineTo(x + w - len, y + h);
  c.moveTo(x + len, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - len);
  c.stroke(); c.globalAlpha = 1;
}
function background(c, t, o = {}) {
  const { glow = [0.62, 0.48], glowColor = 'rgba(20,78,86,0.55)', grid = 0.5, base = C.bg0, floor = 0 } = o;
  c.fillStyle = base; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W * glow[0], H * glow[1], 0, W * glow[0], H * glow[1], W * 0.62);
  g.addColorStop(0, glowColor); g.addColorStop(0.55, 'rgba(10,30,40,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (grid > 0) {
    c.strokeStyle = `rgba(80,120,150,${0.06 * grid})`; c.lineWidth = 1; c.beginPath();
    const s = 96, ox = (W / 2) % s, oy = (H / 2) % s;
    for (let x = ox; x < W; x += s) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
    for (let y = oy; y < H; y += s) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
    c.stroke();
    c.fillStyle = `rgba(120,170,200,${0.16 * grid})`;
    for (let x = ox; x < W; x += s) for (let y = oy; y < H; y += s) c.fillRect(x - 1, y - 1, 2, 2);
  }
  if (floor > 0) floorGrid(c, t, floor);
}
function floorGrid(c, t, a) {
  // OG 이미지처럼 원근이 걸린 바닥 격자
  const hz = H * 0.56;
  c.save(); c.globalAlpha = a;
  const g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, 'rgba(60,110,130,0)'); g.addColorStop(1, 'rgba(60,110,130,0.22)');
  c.strokeStyle = g; c.lineWidth = 1; c.beginPath();
  for (let i = -24; i <= 24; i++) { const x = W / 2 + i * 150; c.moveTo(W / 2 + i * 12, hz); c.lineTo(x, H); }
  for (let k = 0; k < 14; k++) { const z = (k + (t * 0.6) % 1) / 14; const y = hz + (H - hz) * z * z; c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke(); c.restore();
}
function blitGL(c, alpha = 1, op = 'source-over', x = 0, y = 0, w = W, h = H) {
  c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = op; c.drawImage(g3c, 0, 0, g3c.width, g3c.height, x, y, w, h); c.restore();
}

// ─────────────────────────────────────────────────────────── §5 공용 비주얼
const heroStep = (t) => t * STEP_RATE + 30;
function heroFrame(t) { const s = Math.floor(heroStep(t)); const S = D.hero.length; return ((s % S) + S) % S; }
function brainCam(o) {
  const tg = o.target || D.cnsCenter;
  return camera({ target: tg, yaw: o.yaw ?? -0.5, pitch: o.pitch ?? 0.15, dist: o.dist ?? 3.1, fov: o.fov ?? 0.62, shiftX: o.shiftX || 0, shiftY: o.shiftY || 0, near: 0.002, aspect: o.aspect || W / H, roll: o.roll || 0 });
}
// 주인공 뇌(실측 세포체 140,024개 + 실제 스파이크)를 그려 2D 캔버스로 옮깁니다.
function drawHeroBrain(c, t, o = {}) {
  const cam = o.cam || brainCam(o);
  const st = heroStep(t);
  uploadHero(st);
  gl3Begin(true, o.viewport || null, true);
  if (o.edges) drawEdges({ cam, step: st, draw: o.edges.draw ?? 1, alpha: o.edges.alpha ?? 0.1, pulse: o.edges.pulse ?? 0.9, bulge: o.edges.bulge ?? 0.16 });
  drawCloud(P3.hero, {
    cam, step: st, lastTex: P3.lastHero, size: o.size ?? 1.5, spikeSize: o.spikeSize ?? 2.6, base: o.base ?? 0.1, spikeGain: o.spikeGain ?? 1.1,
    alpha: o.alpha ?? 1, time: t, reveal: o.reveal, sizeRef: o.sizeRef ?? (o.dist ?? 3.1), focus: o.focus ?? (o.dist ?? 3.1), dof: o.dof ?? 0,
    highlight: o.highlight ?? 0, chosen: D.chosen, morph: o.morph ?? 0, swirl: o.swirl ?? 1, tau: o.tau ?? 1.4,
    scan: o.scan, scanAmt: o.scanAmt, colors: o.colors,
  });
  gl3Resolve(o.exposure ?? 1.25);
  if (!o.noBlit) blitGL(c, o.blitAlpha ?? 1);
  return cam;
}

// 단백질 리본(2D, 깊이 정렬). 반환된 세그먼트 목록에 다른 물체를 끼워 그릴 수 있습니다.
function ribbonSegments(prot, cam, o = {}) {
  const { draw = 1, xform = null, scale = 1 } = o;
  const pts = prot.pts, n = pts.length, lim = Math.floor((n - 1) * clamp(draw));
  const proj = new Array(n);
  for (let i = 0; i <= Math.min(n - 1, lim + 1); i++) {
    let p = pts[i];
    if (xform) p = xform(p);
    proj[i] = project(cam, p);
  }
  const segs = [];
  for (let i = 0; i < lim; i++) {
    if (prot.brk[i]) continue;
    const a = proj[i], b = proj[i + 1];
    if (!a[3] || !b[3]) continue;
    segs.push({ i, a, b, z: (a[2] + b[2]) / 2, ss: prot.sss[i] });
  }
  return { segs, head: lim > 0 ? proj[Math.min(lim, n - 1)] : null, proj };
}
function drawRibbon(c, R, o = {}) {
  const { alpha = 1, width = 1, zNear = 60, zFar = 160, colors = { H: '#38d3c4', E: '#f7bb45', C: '#6f86a6' }, pocket = null, pocketGlow = 0, glow = true, sortSegs = true, insert = null } = o;
  const segs = sortSegs ? R.segs.slice().sort((a, b) => b.z - a.z) : R.segs;
  let inserted = false;
  c.lineCap = 'round';
  for (const s of segs) {
    if (insert && !inserted && s.z < insert.z) { insert.draw(); inserted = true; }
    const dn = clamp((s.z - zNear) / (zFar - zNear));
    const shade = 1 - dn * 0.72;
    const wBase = s.ss === 'H' ? 9 : s.ss === 'E' ? 10 : 3.2;
    const lw = Math.min(o.maxW ?? 14, wBase * width * (1.25 - dn * 0.6) * (zNear * 1.6 / Math.max(s.z, zNear * 0.4)) * 0.9);
    const nearFade = o.nearFade ? clamp((s.z - o.nearFade) / o.nearFade) : 1;
    if (nearFade <= 0.01) continue;
    let col = colors[s.ss] || colors.C;
    if (pocket && pocket.has(Math.floor(s.i / 5)) && pocketGlow > 0) col = mixHex(col, '#b9ffe9', 0.45 * pocketGlow);
    c.globalAlpha = alpha * shade * nearFade;
    c.strokeStyle = col; c.lineWidth = Math.max(0.8, lw);
    c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
    if (glow && s.ss !== 'C') { c.globalAlpha = alpha * shade * 0.16; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(0.6, lw * 0.25); c.beginPath(); c.moveTo(s.a[0], s.a[1] - lw * 0.18); c.lineTo(s.b[0], s.b[1] - lw * 0.18); c.stroke(); }
  }
  if (insert && !inserted) insert.draw();
  c.globalAlpha = 1;
}
function mixHex(a, b, t) { const x = hexRGB(a), y = hexRGB(b); return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], t) * 255)).join(',')})`; }
const ATOM_COL = { C: ['#7dffd6', '#0b7f62'], N: ['#8ec5ff', '#2f6fd6'], O: ['#ff8a80', '#c62f2a'], F: ['#b4ffb0', '#3aa956'], Cl: ['#b4ffb0', '#3aa956'], S: ['#fff09a', '#c9a227'] };
function drawLigand(c, atoms, bonds, cam, o = {}) {
  const { alpha = 1, scale = 1, glow = 0, vw = W, vh = H } = o;
  const P = atoms.map((a) => project(cam, a, vw, vh));
  c.lineCap = 'round';
  const order = bonds.map((b, k) => ({ k, z: (P[b[0]][2] + P[b[1]][2]) / 2 })).sort((a, b) => b.z - a.z);
  const zRef = P.reduce((s, p) => s + p[2], 0) / P.length;
  for (const { k } of order) {
    const [i, j] = bonds[k], a = P[i], b = P[j];
    const lw = 7 * scale * (zRef / Math.max(a[2], 1));
    c.globalAlpha = alpha * 0.95; c.strokeStyle = '#6fbfa8'; c.lineWidth = lw;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  const ord = P.map((p, i) => ({ i, z: p[2] })).sort((a, b) => b.z - a.z);
  for (const { i } of ord) {
    const p = P[i], el = atoms[i][3];
    const r = (el === 'C' ? 9.5 : 10.5) * scale * (zRef / Math.max(p[2], 1));
    const [c1, c0] = ATOM_COL[el] || ATOM_COL.C;
    const g = c.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.35, r * 0.1, p[0], p[1], r);
    g.addColorStop(0, mixHex(c1, '#ffffff', 0.45)); g.addColorStop(0.35, c1); g.addColorStop(1, c0);
    c.globalAlpha = alpha; c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.fill();
    if (glow > 0) { c.globalAlpha = alpha * glow * 0.14; c.fillStyle = c1; c.beginPath(); c.arc(p[0], p[1], r * 1.7, 0, TAU); c.fill(); }
  }
  c.globalAlpha = 1;
  return P;
}

// HUD: 모서리 괄호, 타임코드, 장면 번호
function drawHUD(c, t, info, alpha) {
  if (alpha <= 0) return;
  const m = 44;
  brackets(c, m, m, W - m * 2, H - m * 2, 22, 'rgba(160,200,220,0.5)', 1.5, alpha * 0.7);
  text(c, 'FDDD', m + 34, m + 40, { w: 850, px: 20, color: C.ink, alpha: alpha * 0.9, ls: 3 });
  text(c, 'Motion showreel · ' + info.cut + 's cut', m + 112, m + 39, { w: 500, px: 15, color: C.dim, alpha: alpha * 0.75 });
  const fr = Math.floor(t * FPS + 1e-6);
  const tc = `${pad(Math.floor(fr / FPS / 60))}:${pad(Math.floor(fr / FPS) % 60)}:${pad(fr % FPS)}`;
  text(c, 'TC ' + tc, W - m - 34, m + 39, { fam: MONO, w: 500, px: 15, color: C.dim, align: 'right', alpha: alpha * 0.8, ls: 1 });
  // 박자 표시(4칸)
  const beat = Math.floor(t / BEAT) % 4;
  for (let k = 0; k < 4; k++) { c.globalAlpha = alpha * (k === beat ? 0.95 : 0.25); c.fillStyle = k === beat ? C.mint : C.dim; c.fillRect(W - m - 34 - 190 + k * 14, m + 29, 8, 8); }
  c.globalAlpha = 1;
  const label = `${pad(info.index + 1)} / ${pad(info.total)}   ${info.label}`;
  const sp = rmap(info.lt, 0, 0.45);
  text(c, scramble(label, sp, info.index * 7.7, t), m + 34, H - m - 30, { w: 600, px: 16, color: C.ink, alpha: alpha * 0.85, ls: 1 });
  text(c, 'flybrain.kr', W - m - 34, H - m - 30, { fam: MONO, w: 500, px: 16, color: C.mint, align: 'right', alpha: alpha * 0.85, ls: 1 });
  // 진행 막대
  c.globalAlpha = alpha * 0.5; c.fillStyle = C.line2; c.fillRect(m + 34, H - m - 14, 240, 2);
  c.globalAlpha = alpha * 0.9; c.fillStyle = C.mint; c.fillRect(m + 34, H - m - 14, 240 * clamp(t / info.dur), 2);
  c.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────── §6 장면
// 각 장면: draw(c, lt, d, env), events(d, env) → 음향 동기화용 [{t, type, ...}]
const SCENES = {};
let FX;
function fxReset() { FX = { streak: 0.5, bloom: 0.85, thresh: 0.55, ca: 0.0015, grain: 0.022, vig: 0.42, flash: 0, zoom: 1, glitch: 0, shakeX: 0, shakeY: 0, exposure: 1, hud: 1 }; }
function kickPunch(lt, amount = 0.012, from = 0, to = 1e9) {
  if (lt < from || lt > to) return;
  const b = (lt - from) / BEAT; const dt = (b - Math.floor(b)) * BEAT;
  FX.zoom *= 1 + amount * Math.exp(-dt * 11);
}
function shake(amount, seed, t) { FX.shakeX += (hash2(seed, Math.floor(t * 60)) - 0.5) * amount; FX.shakeY += (hash2(seed + 3.1, Math.floor(t * 60)) - 0.5) * amount; }

// ── 포스터(0번 프레임 · 썸네일 공용)
function drawPoster(c, t, o = {}) {
  const w = c.canvas.width, h = c.canvas.height, s = h / 1080, sx = w / 1920;
  const variant = o.variant || 'frame';
  c.fillStyle = C.bg0; c.fillRect(0, 0, w, h);
  const g = c.createRadialGradient(w * 0.7, h * 0.52, 0, w * 0.7, h * 0.52, w * 0.55);
  g.addColorStop(0, 'rgba(28,96,104,0.6)'); g.addColorStop(0.5, 'rgba(12,40,52,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // 원근 바닥 격자
  c.save(); const hz = h * 0.6; c.globalAlpha = 0.9; c.strokeStyle = 'rgba(70,120,140,0.10)'; c.lineWidth = 1; c.beginPath();
  for (let i = -30; i <= 30; i++) { c.moveTo(w / 2 + i * 14 * s, hz); c.lineTo(w / 2 + i * 170 * s, h); }
  for (let k = 1; k < 12; k++) { const z = k / 12; const y = hz + (h - hz) * z * z; c.moveTo(0, y); c.lineTo(w, y); }
  c.stroke(); c.restore();
  // 뇌 (오른쪽)
  const aspect = w / h;
  const cam = brainCam({ yaw: -0.72 + t * 0.05, pitch: 0.3, dist: 2.75, fov: 0.62, shiftX: 0.4 * (1.777 / aspect), shiftY: -0.08, aspect });
  const st = 30 + 57 + t * STEP_RATE;
  uploadHero(st);
  gl3Begin(true, null, true);
  drawCloud(P3.hero, { cam, step: st, lastTex: P3.lastHero, size: 1.6 * s, spikeSize: 2.8 * s, base: 0.085, spikeGain: 1.9, time: t, sizeRef: 2.75, focus: 2.75, dof: 0.6 * s });
  gl3Resolve(1.2);
  c.drawImage(g3c, 0, 0, g3c.width, g3c.height, 0, 0, w, h);
  // 초파리 (오른쪽 위)
  const fcam = camera({ target: [0, 0, 0], yaw: 0, pitch: 0, dist: 3, fov: 0.5, aspect, shiftX: 0.72 * (1.777 / aspect), shiftY: 0.56 });
  const fm = M4.chain(M4.T(0, 0, 0), M4.rotY(-0.95), M4.rotX(0.42), M4.rotZ(0.22), M4.S(1.2));
  gl3Begin(true);
  drawFlyGL({ cam: fcam, model: fm, wing: 0.18, wingBlur: 0.55, rim: 1.2 });
  c.drawImage(g3c, 0, 0, g3c.width, g3c.height, 0, 0, w, h);
  // 텍스트 블록 (왼쪽)
  const X = 118 * s;
  chip(c, variant === 'frame' ? 'MOTION SHOWREEL' : `MOTION SHOWREEL · ${o.cut || 30}s`, X, 212 * s, { px: 17 * s, fam: KR, w: 600, ls: 1 });
  c.save();
  c.shadowColor = 'rgba(94,242,208,0.35)'; c.shadowBlur = 40 * s;
  const gradT = c.createLinearGradient(0, 290 * s, 0, 470 * s); gradT.addColorStop(0, '#ffffff'); gradT.addColorStop(1, '#bff7ea');
  setFont(c, 900, 236 * s, KR, -6 * s); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = gradT; c.fillText('FDDD', X - 10 * s, 468 * s);
  c.restore();
  // FLY-DRIVEN DRUG DEVELOPMENT (첫 글자 강조)
  const words = ['FLY', 'DRIVEN', 'DRUG', 'DEVELOPMENT'];
  let wx = X; setFont(c, 600, 21 * s, MONO, 7 * s);
  for (const word of words) {
    text(c, word[0], wx, 530 * s, { fam: MONO, w: 700, px: 21 * s, color: C.mint, ls: 7 * s });
    const w0 = textWidth(c, word[0], 700, 21 * s, MONO, 7 * s);
    text(c, word.slice(1), wx + w0, 530 * s, { fam: MONO, w: 500, px: 21 * s, color: C.dim, ls: 7 * s });
    wx += textWidth(c, word + ' ', 500, 21 * s, MONO, 7 * s) + 6 * s;
  }
  text(c, 'Fly brains drive', X, 648 * s, { w: 800, px: 66 * s, color: C.ink, ls: -1.5 * s });
  text(c, 'drug development', X, 730 * s, { w: 800, px: 66 * s, color: C.mint, ls: -1.5 * s });
  text(c, 'Real docking scores · Real spikes · Live in the browser', X, 800 * s, { w: 500, px: 25 * s, color: C.dim });
  // 하단 수치
  const stats = [['167,122', 'neurons / fly'], ['6,241,236', 'connections'], ['8', 'docking runs'], ['20', 'parallel brains']];
  let sxp = X;
  for (const [num, lab] of stats) {
    text(c, num, sxp, 968 * s, { fam: MONO, w: 700, px: 22 * s, color: C.ink });
    const nw = textWidth(c, num, 700, 22 * s, MONO);
    text(c, lab, sxp + nw + 10 * s, 968 * s, { w: 500, px: 19 * s, color: C.dim });
    sxp += nw + textWidth(c, lab, 500, 19 * s) + 48 * s;
  }
  // 오른쪽 아래 주소
  text(c, 'flybrain.kr', w - 118 * s, 968 * s, { fam: MONO, w: 600, px: 24 * s, color: C.mint, align: 'right', ls: 1 });
  if (variant === 'cover' || variant === 'og') {
    // 재생 표시 + 길이 배지
    const px = w * 0.69, py = h * 0.5, r = 74 * s;
    c.save(); c.globalAlpha = 0.92; c.fillStyle = 'rgba(4,10,14,0.55)'; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
    c.lineWidth = 3 * s; c.strokeStyle = 'rgba(238,245,242,0.9)'; c.stroke();
    c.fillStyle = '#eef5f2'; c.beginPath(); c.moveTo(px - r * 0.28, py - r * 0.42); c.lineTo(px + r * 0.46, py); c.lineTo(px - r * 0.28, py + r * 0.42); c.closePath(); c.fill(); c.restore();
    const dur = `0:${pad(o.cut || 30)}`;
    const dw = textWidth(c, dur, 700, 22 * s, MONO) + 24 * s;
    roundRect(c, w - 118 * s - dw, 1000 * s, dw, 38 * s, 6 * s); c.fillStyle = 'rgba(0,0,0,0.7)'; c.fill();
    text(c, dur, w - 118 * s - dw / 2, 1026 * s, { fam: MONO, w: 700, px: 22 * s, color: C.ink, align: 'center' });
  }
}

// ── 01 오프닝: 포스터 → 슬라이스 붕괴 → 뉴런 하나 → 줌아웃 + 카운터
SCENES.open = {
  times(d) {
    const short = d < BAR * 1.5;
    return short ? { hold: 0.3, shatter: 0.62, zoom: 0.94 } : { hold: 0.42, shatter: 0.94, zoom: BAR };
  },
  events(d) {
    const T = this.times(d);
    const ev = [{ t: 0, type: 'poster' }, { t: T.hold, type: 'shatter', dur: T.shatter - T.hold }, { t: T.shatter, type: 'heartbeat' }];
    if (d > BAR * 1.5) ev.push({ t: T.shatter + BEAT, type: 'heartbeat' }, { t: BAR - BEAT * 0.5, type: 'type' });
    ev.push({ t: T.zoom, type: 'riser', dur: d - T.zoom }, { t: d - BEAT, type: 'roll', dur: BEAT * 0.94 }, { t: d - BEAT * 0.125, type: 'suck' });
    return ev;
  },
  draw(c, lt, d, env) {
    const T = this.times(d);
    FX.hud = lt < T.shatter ? 0 : rmap(lt, T.shatter, T.shatter + 0.4);
    if (lt < T.hold) {
      drawPoster(c, lt, { variant: 'frame' });
      FX.bloom = 0.8;
      return;
    }
    if (lt < T.shatter) {
      const p = rmap(lt, T.hold, T.shatter);
      const snap = posterSnap(T.hold);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      const N = 22;
      for (let i = 0; i < N; i++) {
        const y0 = (i / N) * H, hh = H / N;
        const dir = i % 2 ? 1 : -1;
        const delay = hash(i * 3.7) * 0.35;
        const q = E.inExpo(clamp((p - delay) / (1 - delay)));
        const off = dir * q * W * (0.6 + hash(i * 1.3) * 0.9);
        const squash = lerp(1, 0.04, E.inQuart(clamp(p * 1.3 - 0.2)));
        const yc = lerp(y0 + hh / 2, H / 2, E.inCubic(clamp(p * 1.4 - 0.35)));
        c.globalAlpha = 1 - E.inQuad(clamp(p * 1.2 - 0.2));
        c.drawImage(snap, 0, y0, W, hh, off, yc - (hh * squash) / 2, W, hh * squash);
        // 색 분리 잔상
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * q;
        c.drawImage(snap, 0, y0, W, hh, off + dir * 40 * q, yc - (hh * squash) / 2, W, hh * squash);
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
      // 남는 수평선 → 점
      const lp = rmap(p, 0.55, 1);
      if (lp > 0) {
        const lw = lerp(W * 0.9, 4, E.inOutExpo(lp));
        const g = c.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.globalAlpha = lp; c.fillRect(W / 2 - lw / 2, H / 2 - 1.5, lw, 3); c.globalAlpha = 1;
      }
      FX.glitch = Math.sin(p * Math.PI) * 0.9; FX.ca = 0.004 + p * 0.02; FX.bloom = 1.1;
      return;
    }
    background(c, lt, { grid: 0.25, glowColor: 'rgba(14,50,60,0.35)', glow: [0.5, 0.5] });
    if (lt < T.zoom) {
      // 뉴런 하나: 박자마다 발화하는 점과 퍼지는 고리
      const lp = lt - T.shatter;
      const beats = [0, BEAT];
      let flash = 0;
      for (const b of beats) {
        const dt = lp - b; if (dt < 0) continue;
        flash = Math.max(flash, Math.exp(-dt * 7));
        for (let k = 0; k < 3; k++) {
          const rr = E.outCubic(clamp((dt - k * 0.07) / 0.9)) * (260 + k * 90);
          c.globalAlpha = (1 - clamp((dt - k * 0.07) / 0.9)) * (0.5 - k * 0.12);
          c.strokeStyle = k === 0 ? C.mint : C.cyan; c.lineWidth = 2 - k * 0.5;
          c.beginPath(); c.arc(W / 2, H / 2, rr, 0, TAU); c.stroke();
        }
      }
      c.globalAlpha = 1;
      const core = 5 + flash * 9;
      const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, core * 7);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(180,255,240,0.9)'); g.addColorStop(1, 'rgba(94,242,208,0)');
      c.fillStyle = g; c.beginPath(); c.arc(W / 2, H / 2, core * 7, 0, TAU); c.fill();
      riseText(c, 'One neuron.', W / 2, H / 2 + 150, rmap(lp, 0.05, 0.6), { w: 800, px: 76, align: 'center', ls: -1 });
      const cap = 'MaleCNS v1.0 · Male fruit-fly central nervous system';
      text(c, scramble(cap, rmap(lp, 0.25, 0.8), 3, lt), W / 2, H / 2 + 205, { w: 500, px: 22, color: C.dim, align: 'center', ls: 1 });
      FX.bloom = 1.0 + flash * 0.6;
      return;
    }
    // 줌아웃: 한 뉴런에서 뇌 전체로
    const zp = rmap(lt, T.zoom, d);
    const ez = E.inQuart(zp);
    const dist = 0.045 * Math.pow(3.1 / 0.045, E.inOutCubic(zp) * 0.62 + zp * 0.38);
    const tgt = V3.lerp(D.chosenPos, D.cnsCenter, E.inOutCubic(rmap(dist, 0.6, 2.9)));
    const cam = brainCam({ target: tgt, yaw: -0.05 - E.inCubic(zp) * 1.2, pitch: 0.04 + E.inCubic(zp) * 0.3, dist, fov: 0.72 - ez * 0.1 });
    drawHeroBrain(c, lt + env.t0, {
      cam, reveal: [D.chosenModel[0], D.chosenModel[1], D.chosenModel[2], 0.08 + zp * 0.7 + E.inCubic(zp) * 2.0], sizeRef: dist, focus: dist, dof: 2.2 * (1 - zp),
      size: lerp(2.6, 1.6, zp), spikeSize: 2.8, base: lerp(0.4, 0.085, E.outCubic(zp)), spikeGain: 1.6, highlight: 1 - clamp(zp * 1.3), dist, exposure: 1.3,
    });
    // 앞 구간의 빛나는 점이 그대로 이어집니다.
    const cp = project(cam, D.chosenPos);
    const coreA = 1 - E.inQuad(clamp(zp * 1.4));
    if (cp[3] && coreA > 0) {
      const beatFl = decay((lt - T.zoom) % BEAT, 7) * 0.6;
      const rr = (10 + beatFl * 10) * 7;
      const g = c.createRadialGradient(cp[0], cp[1], 0, cp[0], cp[1], rr);
      g.addColorStop(0, `rgba(255,255,255,${coreA})`); g.addColorStop(0.16, `rgba(180,255,240,${0.85 * coreA})`); g.addColorStop(1, 'rgba(94,242,208,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cp[0], cp[1], rr, 0, TAU); c.fill();
    }
    // 카운터가 1에서 167,122까지 달립니다(최종 폭 기준 오른쪽 정렬).
    const v = Math.min(167122, Math.max(1, Math.exp(Math.log(167122) * Math.pow(clamp(zp * 1.04), 1.5))));
    const cy = H / 2 + 200;
    const numF = '167,122';
    const nwF = textWidth(c, numF, 900, 124, KR, -3), labelW = textWidth(c, 'neurons', 700, 54);
    const tot = nwF + 24 + labelW, x0 = W / 2 - tot / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 30;
    text(c, fmt(v), x0 + nwF, cy, { w: 900, px: 124, ls: -3, align: 'right' });
    text(c, 'neurons', x0 + nwF + 24, cy, { w: 700, px: 54, color: C.dim });
    c.restore();
    text(c, scramble('MaleCNS v1.0 · Male fruit-fly central nervous system', 1, 3, lt), W / 2, cy + 52, { w: 500, px: 22, color: C.dim, align: 'center', ls: 1, alpha: 1 - zp });
    FX.ca = 0.002 + ez * 0.012; FX.bloom = 0.9 + ez * 0.5;
    FX.zoom *= 1 + ez * 0.03;
    const lastBeat = rmap(lt, d - BEAT, d);
    if (lastBeat > 0) shake(0.004 * lastBeat, 5, lt);
    FX.flash = E.inExpo(rmap(lt, d - BEAT * 0.4, d)) * 0.85;
  },
};
let posterCache = null;
function posterSnap(tp) {
  if (posterCache && posterCache.t === tp) return posterCache.c;
  const pc = mkCanvas(); const px = pc.getContext('2d');
  drawPoster(px, tp, { variant: 'frame' });
  posterCache = { t: tp, c: pc };
  return pc;
}

// ── 02 커넥톰: 167,122 → 6,241,236, 실제 연결선과 스파이크
SCENES.brain = {
  cam(lt, d) {
    const ep = clamp(lt / d), e = E.inOutCubic(ep);
    return { yaw: lerp(-1.25, -0.32, e), pitch: lerp(0.34, 0.14, e), dist: 3.05 - E.outCubic(clamp(lt / 0.5)) * 0.3 + ep * 0.14, fov: 0.62, shiftX: 0.4, shiftY: -0.02 };
  },
  events(d) {
    const short = d < BAR * 1.5;
    const ev = [{ t: 0, type: 'impact' }];
    if (!short) for (let k = 0; k < 3; k++) ev.push({ t: BEAT * (0.8 + k * 0.5), type: 'tick', pitch: k });
    ev.push({ t: d / 2, type: 'hit' }, { t: d / 2, type: 'sweep', dur: BEAT * 1.5 });
    return ev;
  },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const short = d < BAR * 1.5;
    background(c, t, { grid: 0.45, glow: [0.66, 0.5] });
    kickPunch(lt, 0.014);
    const half = d / 2;
    const cp = this.cam(lt, d), cam = brainCam(cp);
    const endFade = 1 - rmap(lt, d - BEAT * 0.7, d - 0.06);
    const edgeP = rmap(lt, half - 0.05, half + BEAT * (short ? 1.2 : 2));
    // 박자마다 스캔 평면이 뇌를 훑고 지나갑니다.
    const bp = (lt / BEAT) % 1;
    const scanY = lerp(0.55, -0.6, E.inOutQuad(clamp(bp * 1.4)));
    drawHeroBrain(c, t, { cam, dist: cp.dist, edges: edgeP > 0 ? { draw: E.outCubic(edgeP), alpha: 0.009 * endFade, pulse: 1.1 * endFade } : null,
      base: 0.09, spikeGain: 2.0, size: 1.6, exposure: 1.25, scan: [0, 1, 0, scanY], scanAmt: 0.55 * (1 - bp) * endFade });
    // 해부 구조 콜아웃(실측 세포체 수)
    if (!short) {
      const CALL = [
        { g: 1, label: 'Central brain', sub: `CENTRAL BRAIN · ${fmt(D.groupCount[1])}`, dx: 1, dy: -1.6, color: '#ffd9a8', len: 150 },
        { g: 0, label: 'Optic lobe', sub: `OPTIC LOBE · ${fmt(D.groupCount[0])}`, dx: -1, dy: 2.2, color: '#5fd4ec', len: 120 },
        { g: 3, label: 'Ventral nerve cord', sub: `VNC · ${fmt(D.groupCount[3])}`, dx: 1, dy: 2.0, color: '#b7a0ff', len: 130 },
      ];
      const fadeC = 1 - rmap(lt, half - 0.3, half);
      const bcp = project(cam, D.cnsCenter);
      CALL.forEach((k, i) => {
        const ap = project(cam, D.groupAnchor[k.g]);
        const dx = ap[0] >= bcp[0] ? 1 : -1, dy = (ap[1] >= bcp[1] ? 1 : -1) * 1.7;
        callout(c, cam, D.groupAnchor[k.g], { ...k, dx, dy, prog: rmap(lt, BEAT * (0.8 + i * 0.5), BEAT * (0.8 + i * 0.5) + 0.7), alpha: fadeC, seed: 70 + i, t });
      });
    }
    // 왼쪽 거대 숫자: 가변 굵기가 200 → 900으로 조여듭니다.
    const X = 150;
    const inP = clamp(lt / 0.42);
    const swap = E.inOutExpo(rmap(lt, half - 0.1, half + 0.22));
    const a1 = 1 - rmap(lt, half - 0.05, half + 0.1), a2 = rmap(lt, half - 0.05, half + 0.12);
    c.save(); c.globalAlpha = endFade;
    c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 40;
    // 라벨
    if (a1 > 0) text(c, scramble('NEURONS · ONE FLY', rmap(lt, 0.05, 0.5), 11, t), X, 400, { w: 600, px: 26, color: C.mint, alpha: a1 * endFade, ls: 1 });
    if (a2 > 0) text(c, scramble('CONNECTIONS · ≥5 SYNAPSES EACH', rmap(lt, half, half + 0.45), 12, t), X, 400, { w: 600, px: 26, color: C.violet, alpha: a2 * endFade, ls: 1 });
    // 숫자 슬롯
    c.save(); c.beginPath(); c.rect(X - 30, 585 - 184 * 0.9, 1100, 184 * 1.05); c.clip();
    if (swap < 1) {
      const sc = 1 + (1 - E.outExpo(inP)) * 0.22;
      c.save(); c.translate(X, 585 - swap * 210); c.scale(sc, sc);
      rollNumber(c, 167122, '167,122', 0, 0, { px: 184, alpha: endFade, w: Math.round(lerp(200, 900, E.outExpo(inP))), ls: -6 });
      c.restore();
    }
    if (swap > 0) {
      const vv = lerp(167122, 6241236, E.outExpo(rmap(lt, half, half + 0.55)));
      c.save(); c.translate(X, 585 + (1 - swap) * 210);
      rollNumber(c, vv, '6,241,236', 0, 0, { px: 164, alpha: endFade, w: Math.round(lerp(250, 900, E.outExpo(rmap(lt, half, half + 0.4)))), ls: -6 });
      c.restore();
    }
    c.restore();
    // 부제
    if (a1 > 0) {
      riseText(c, 'MaleCNS v1.0 · Brain + ventral nerve cord', X, 660, rmap(lt, 0.2, 0.9), { w: 600, px: 31, color: C.ink, alpha: a1 * endFade });
      text(c, '140,024 measured soma locations · All selected neurons computed', X, 712, { w: 500, px: 21, color: C.dim, alpha: a1 * endFade * rmap(lt, 0.5, 0.9) });
    }
    if (a2 > 0) {
      riseText(c, 'Directed connections in one fly', X, 660, rmap(lt, half + 0.1, half + 0.8), { w: 600, px: 34, color: C.ink, alpha: endFade });
      text(c, '7,000 sampled connections · Computed spikes, animated pulses', X, 712, { w: 500, px: 21, color: C.dim, alpha: rmap(lt, half + 0.4, half + 0.8) * endFade });
    }
    c.restore();
    const second = lt >= half;
    // 오른쪽 아래: 실제 계산 수치
    const fi = heroFrame(t);
    const cnt = D.meta.hero.counts[fi], rr = D.meta.hero.regionRates[fi];
    const px0 = W - 470, py0 = H - 330, pa = rmap(lt, 0.3, 0.8) * endFade;
    if (pa > 0) {
      c.globalAlpha = pa;
      roundRect(c, px0, py0, 390, 230, 10); c.fillStyle = 'rgba(6,14,20,0.72)'; c.fill(); c.strokeStyle = C.line2; c.lineWidth = 1; c.stroke();
      text(c, 'LIF COMPUTATION', px0 + 22, py0 + 36, { w: 600, px: 17, color: C.mint, ls: 1, alpha: pa });
      text(c, 'STEP ' + pad(Math.floor(heroStep(t)), 4), px0 + 368, py0 + 36, { fam: MONO, w: 500, px: 14, color: C.dim, align: 'right', alpha: pa });
      text(c, fmt(cnt), px0 + 22, py0 + 92, { fam: MONO, w: 700, px: 40, color: C.ink, alpha: pa });
      text(c, 'spikes / step', px0 + 30 + textWidth(c, fmt(cnt), 700, 40, MONO), py0 + 90, { w: 500, px: 17, color: C.dim, alpha: pa });
      const RN = ['Sensory', 'Central', 'Descending', 'Motor', 'Other'], RC = ['#4df2d9', '#8c9eff', '#ffb84d', '#ff616b', '#9ea8b3'];
      for (let k = 0; k < 5; k++) {
        const y = py0 + 122 + k * 21;
        text(c, RN[k], px0 + 22, y + 5, { w: 500, px: 14, color: C.dim, alpha: pa });
        const v = clamp(rr[k] / 0.3);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(px0 + 108, y - 4, 192, 6);
        c.fillStyle = RC[k]; c.fillRect(px0 + 108, y - 4, 192 * v, 6);
        text(c, (rr[k] * 100).toFixed(1) + '%', px0 + 368, y + 5, { fam: MONO, w: 500, px: 13, color: C.ink, align: 'right', alpha: pa });
      }
      c.globalAlpha = 1;
    }
    FX.bloom = 0.85; FX.thresh = 0.62;
    if (second) FX.flash = Math.max(FX.flash, 0.22 * decay(lt - half, 12));
    FX.flash = Math.max(FX.flash, 0.8 * decay(lt, 14));
    FX.streak = 0.5 + 2.0 * decay(lt, 4);
    FX.ca = 0.0015 + 0.02 * decay(lt, 8);
  },
};

// ── 03 20개의 뇌: 타일 월
function gridLayout() {
  const cols = 5, rows = 4, mx = 70, top = 110, bottom = 92, gap = 14;
  const tw = (W - mx * 2 - gap * (cols - 1)) / cols, th = (H - top - bottom - gap * (rows - 1)) / rows;
  const rects = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) rects.push([mx + q * (tw + gap), top + r * (th + gap), tw, th]);
  return rects;
}
SCENES.grid = {
  events(d) {
    const short = d < BAR * 1.5;
    const ev = [];
    const rects = gridLayout();
    rects.forEach((r, i) => { if (i === 0) return; const q = i % 5, row = Math.floor(i / 5); ev.push({ t: (short ? 0.12 : 0.22) + (q + row) * (short ? 0.028 : 0.045), type: 'blip', pitch: (q + row) % 8 }); });
    ev.push({ t: short ? BEAT : BEAT * 1, type: 'hit' });
    ev.push({ t: d - (short ? 0.16 : 0.2), type: 'whoosh', dur: 0.36 });
    return ev;
  },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const short = d < BAR * 1.5;
    background(c, t, { grid: 0.3, glow: [0.5, 0.5], glowColor: 'rgba(18,60,72,0.45)' });
    kickPunch(lt, 0.01);
    const rects = gridLayout();
    const intro = short ? 0.3 : 0.45;
    const zoom = 1 + E.inOutQuad(clamp(lt / d)) * 0.05;
    c.save(); c.translate(W / 2, H / 2); c.scale(zoom, zoom); c.translate(-W / 2, -H / 2);
    const st = t * STEP_RATE;
    uploadTiles(st); uploadHero(heroStep(t));
    gl3Begin(true, null, true);
    const tileRects = [];
    for (let i = 0; i < 20; i++) {
      let [x, y, w, h] = rects[i];
      let a = 1, sc = 1;
      if (i === 0) {
        const e = E.inOutExpo(clamp(lt / intro));
        x = lerp(0, x, e); y = lerp(0, y, e); w = lerp(W, w, e); h = lerp(H, h, e);
      } else {
        const q = i % 5, row = Math.floor(i / 5);
        const at = (short ? 0.12 : 0.22) + (q + row) * (short ? 0.028 : 0.045);
        const e = clamp((lt - at) / 0.35);
        a = E.outCubic(e); sc = 0.86 + 0.14 * E.outBack(e);
      }
      tileRects.push({ x, y, w, h, a, sc });
    }
    // 3D: 각 타일 뷰포트에 해당 개체의 뇌를 그립니다.
    const e0 = E.inOutExpo(clamp(lt / intro));
    const bd = short ? BAR : BAR * 2, bc = SCENES.brain.cam(bd, bd);
    for (let i = 0; i < 20; i++) {
      const R = tileRects[i]; if (R.a <= 0.01) continue;
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      const m = i === 0 ? e0 : 1;
      const vw = R.w * R.sc, vh = (R.h - 58 * m) * R.sc;
      const vx = cx - vw / 2, vy = cy - R.h * R.sc / 2 + 30 * m * R.sc;
      const vpr = [Math.round(vx), Math.round(vy), Math.max(2, Math.round(vw)), Math.max(2, Math.round(vh))];
      gl.enable(gl.SCISSOR_TEST); gl.scissor(vpr[0], g3c.height - vpr[1] - vpr[3], vpr[2], vpr[3]);
      gl.viewport(vpr[0], g3c.height - vpr[1] - vpr[3], vpr[2], vpr[3]);
      const ty = -0.55 + lt * 0.12;
      if (i === 0) {
        const cam = brainCam({ yaw: lerp(bc.yaw, ty, e0), pitch: lerp(bc.pitch, 0.18, e0), dist: lerp(bc.dist, 3.25, e0), fov: 0.62, shiftX: lerp(bc.shiftX, 0, e0), shiftY: lerp(bc.shiftY, 0, e0), aspect: vpr[2] / vpr[3] });
        drawCloud(P3.hero, { cam, step: heroStep(t), lastTex: P3.lastHero, size: lerp(1.6, 1.0, e0), spikeSize: 2.4, base: lerp(0.09, 0.016, e0), spikeGain: lerp(2.0, 1.4, e0), time: t, sizeRef: lerp(bc.dist, 3.25, e0), alpha: R.a });
      } else {
        const cam = brainCam({ yaw: ty, pitch: 0.18, dist: 3.25, fov: 0.62, aspect: vpr[2] / vpr[3] });
        drawCloud(P3.tile, { cam, step: st + tileStepOffset(i), lastTex: P3.lastTiles, idxOffset: i * D.atlas.tn, size: 1.5, spikeSize: 2.4, base: 0.13, spikeGain: 1.9, time: t, sizeRef: 3.25, alpha: R.a });
      }
      gl.disable(gl.SCISSOR_TEST);
    }
    gl3Resolve(1.25);
    // 패널 → 3D → 라벨 순서로 겹칩니다.
    for (let i = 0; i < 20; i++) {
      const R = tileRects[i]; if (R.a <= 0.01) continue;
      c.save(); c.globalAlpha = R.a * (i === 0 ? e0 : 1); const cx = R.x + R.w / 2, cy = R.y + R.h / 2; c.translate(cx, cy); c.scale(R.sc, R.sc); c.translate(-cx, -cy);
      roundRect(c, R.x, R.y, R.w, R.h, 8); c.fillStyle = 'rgba(7,15,22,0.82)'; c.fill();
      c.restore();
    }
    blitGL(c, 1);
    for (let i = 0; i < 20; i++) {
      const R = tileRects[i]; if (R.a <= 0.01) continue;
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      c.save(); c.globalAlpha = R.a * (i === 0 ? e0 : 1); c.translate(cx, cy); c.scale(R.sc, R.sc); c.translate(-cx, -cy);
      const acc = FLY_ACCENTS[i];
      const counts = i === 0 ? D.meta.hero.counts : D.meta.tiles[i].counts;
      const fi = i === 0 ? heroFrame(t) : ((Math.floor(st + tileStepOffset(i)) % counts.length) + counts.length) % counts.length;
      const cnt = counts[fi];
      const act = clamp((cnt - 9000) / 5000);
      roundRect(c, R.x, R.y, R.w, R.h, 8); c.strokeStyle = i === 0 ? rgba(acc, 0.9) : rgba(acc, 0.18 + act * 0.35); c.lineWidth = i === 0 ? 2 : 1; c.stroke();
      c.beginPath(); c.arc(R.x + 18, R.y + 22, 4.5, 0, TAU); c.fillStyle = acc; c.fill();
      text(c, FLY_NAMES[i], R.x + 30, R.y + 27, { fam: MONO, w: 700, px: 14, color: acc, ls: 1.5 });
      text(c, pad(i + 1), R.x + 38 + textWidth(c, FLY_NAMES[i], 700, 14, MONO, 1.5), R.y + 27, { fam: MONO, w: 500, px: 13, color: C.mute });
      text(c, 'STEP ' + pad(Math.floor(st + tileStepOffset(i)) + 100, 4), R.x + R.w - 14, R.y + 27, { fam: MONO, w: 500, px: 11, color: C.mute, align: 'right' });
      text(c, fmt(cnt), R.x + 16, R.y + R.h - 16, { fam: MONO, w: 700, px: 20, color: C.ink });
      text(c, 'spikes/step', R.x + 24 + textWidth(c, fmt(cnt), 700, 20, MONO), R.y + R.h - 17, { w: 500, px: 12, color: C.mute });
      // 스파크라인(실제 스파이크 수)
      c.beginPath();
      for (let k = 0; k < 24; k++) { const v = counts[((fi - 23 + k) % counts.length + counts.length) % counts.length]; const xx = R.x + R.w - 110 + k * 4, yy = R.y + R.h - 16 - clamp((v - 8000) / 7000) * 18; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.strokeStyle = rgba(acc, 0.8); c.lineWidth = 1.3; c.stroke();
      c.restore();
    }
    c.restore();
    // 헤드라인
    const h1 = rmap(lt, short ? BEAT * 0.9 : BEAT * 1.0, (short ? BEAT * 0.9 : BEAT) + 0.5);
    const h2 = rmap(lt, short ? BEAT * 1.6 : BEAT * 2.2, (short ? BEAT * 1.6 : BEAT * 2.2) + 0.6);
    const outP = rmap(lt, d - (short ? 0.3 : 0.45), d - 0.1);
    if (h1 > 0) {
      const bandA = E.outCubic(h1) * (1 - outP);
      const g = c.createLinearGradient(0, H / 2 - 190, 0, H / 2 + 170);
      g.addColorStop(0, 'rgba(3,6,10,0)'); g.addColorStop(0.3, 'rgba(3,6,10,0.86)'); g.addColorStop(0.7, 'rgba(3,6,10,0.86)'); g.addColorStop(1, 'rgba(3,6,10,0)');
      c.globalAlpha = bandA; c.fillStyle = g; c.fillRect(0, H / 2 - 190, W, 360); c.globalAlpha = 1;
      riseText(c, '20 brains.', W / 2, H / 2 - 10, h1, { w: 900, px: 124, align: 'center', ls: -3, out: outP });
      riseText(c, short ? 'Computed live, together, in your browser.' : 'Computed together in your browser.', W / 2, H / 2 + 82, h2, { w: 600, px: 50, align: 'center', color: C.dim, out: outP });
      if (!short) {
        const h3 = rmap(lt, BEAT * 3.4, BEAT * 3.4 + 0.5);
        text(c, scramble('20 × 167,122 = 3,342,440 neurons · EVERY STEP', h3, 21, t), W / 2, H / 2 + 136, { fam: MONO, w: 600, px: 22, color: C.mint, align: 'center', ls: 1, alpha: 1 - outP });
      }
    }
    FX.bloom = 0.8;
  },
};

// ── 04 실제 도킹: PARP1 리본이 그려지고 15R 리간드가 실제 포즈로 결합합니다.
function dockCam(lt, d, o = {}) {
  const P = D.prot['parp1-4r6e-chain-a'];
  const tg = V3.lerp(P.center, D.ligCenter, o.focus ?? 0.35);
  return camera({ target: tg, yaw: (o.yaw ?? 0.6) + lt * (o.spin ?? 0.16), pitch: o.pitch ?? 0.25, dist: o.dist ?? 118, fov: 0.62, shiftX: o.shiftX ?? 0.3, shiftY: o.shiftY ?? -0.02, near: 1, far: 1000 });
}
function ligandAtoms(prog, cam) {
  // prog 0→1: 화면 오른쪽 위에서 나선을 그리며 들어와 실제 Vina 포즈에 멈춥니다.
  const lig = D.combos.find((c) => c.compoundId === '15r');
  const lc = D.ligCenter, e = prog, k = 1 - e;
  const v = cam.view, R = [v[0], v[4], v[8]], U = [v[1], v[5], v[9]], F = [-v[2], -v[6], -v[10]];
  const sp = Math.sin(e * 7) * 10 * k;
  const off = V3.add(V3.add(V3.scale(R, 75 * k + sp), V3.scale(U, 42 * k)), V3.scale(F, -30 * k + Math.cos(e * 7) * 8 * k));
  const ang = (1 - e) * 4.2, ax = V3.norm([0.3, 1, 0.2]);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return lig.atoms.map((a) => {
    const v = V3.sub(a, lc);
    const r = V3.add(V3.add(V3.scale(v, ca), V3.scale(V3.cross(ax, v), sa)), V3.scale(ax, V3.dot(ax, v) * (1 - ca)));
    return [lc[0] + r[0] + off[0], lc[1] + r[1] + off[1], lc[2] + r[2] + off[2], a[3]];
  });
}
function drawDockBox(c, cam, a) {
  if (a <= 0) return;
  const cx = -39, cy = 5, cz = -8, sx = 7.5, sy = 10, sz = 7;
  const v = [];
  for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) v.push(project(cam, [cx + i * sx, cy + j * sy, cz + k * sz]));
  const E2 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  c.save(); c.globalAlpha = a; c.strokeStyle = C.amber; c.lineWidth = 1.2; c.setLineDash([6, 6]);
  c.beginPath(); for (const [i, j] of E2) { c.moveTo(v[i][0], v[i][1]); c.lineTo(v[j][0], v[j][1]); } c.stroke();
  c.setLineDash([]);
  for (const p of v) { c.fillStyle = C.amber; c.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
  const top = v.reduce((m, p) => (p[1] < m[1] ? p : m), v[0]);
  text(c, 'Search box 15 × 20 × 14 Å', top[0] + 12, top[1] - 12, { w: 600, px: 16, color: C.amber, alpha: a });
  c.restore();
}
SCENES.dock = {
  events(d) {
    const short = d < BAR * 1.5;
    return [{ t: 0, type: 'whooshIn' }, { t: 0.05, type: 'drawon', dur: short ? 0.6 : BEAT * 3 }, { t: short ? 0.3 : BEAT * 2, type: 'riser', dur: d - (short ? 0.3 : BEAT * 2) },
      { t: short ? BEAT : BEAT * 4, type: 'type' }, { t: d - BEAT, type: 'roll', dur: BEAT * 0.95 }];
  },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const short = d < BAR * 1.5;
    background(c, t, { grid: 0.2, glow: [0.6, 0.5], glowColor: 'rgba(40,40,90,0.35)' });
    const P = D.prot['parp1-4r6e-chain-a'];
    const cam = dockCam(lt, d, { dist: lerp(135, 104, E.inOutCubic(clamp(lt / d))) });
    const drawP = lerp(0.22, 1, E.outCubic(rmap(lt, 0.0, short ? 0.7 : BEAT * 3.2)));
    const R = ribbonSegments(P, cam, { draw: drawP });
    const lp = rmap(lt, short ? 0.35 : BEAT * 1.5, d);
    const lig = D.combos.find((cc) => cc.compoundId === '15r');
    const atoms = ligandAtoms(E.outCubic(clamp(lp * 1.02)), cam);
    const near = E.inQuad(lp);
    const pocket = new Set(P.pocket);
    const ligZ = project(cam, D.ligCenter)[2];
    drawRibbon(c, R, { alpha: 1, width: 1.0, zNear: 70, zFar: 170, pocket, pocketGlow: near, insert: { z: ligZ - 4, draw: () => drawLigand(c, atoms, lig.bonds, cam, { alpha: clamp(lp * 4), scale: 1, glow: near }) } });
    // 그리는 펜 끝
    if (R.head && drawP < 1) {
      const g = c.createRadialGradient(R.head[0], R.head[1], 0, R.head[0], R.head[1], 26);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(94,242,208,0)');
      c.fillStyle = g; c.beginPath(); c.arc(R.head[0], R.head[1], 26, 0, TAU); c.fill();
    }
    drawDockBox(c, cam, rmap(lt, short ? 0.5 : BEAT * 2.5, short ? 0.8 : BEAT * 3.2) * (1 - rmap(lt, d - 0.2, d)));
    // 결합 직전 포켓으로 수렴하는 고리
    const lcp = project(cam, D.ligCenter);
    const conv = rmap(lt, d - BEAT * 1.5, d);
    for (let k = 0; k < 3; k++) {
      const q = (conv * 2 + k / 3) % 1;
      c.globalAlpha = conv * (1 - q) * 0.6; c.strokeStyle = C.mint; c.lineWidth = 1.5;
      c.beginPath(); c.arc(lcp[0], lcp[1], 20 + (1 - q) * 220, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    // 텍스트
    const X = 150;
    wipeText(c, 'Protein × molecule', X, 330, rmap(lt, short ? 0.02 : BEAT * 0.5, (short ? 0.02 : BEAT * 0.5) + 0.55), { w: 850, px: short ? 68 : 78, ls: -2, bar: C.cyan });
    text(c, scramble('PDB 4R6E · Human PARP1 catalytic domain · 350 Cα atoms', rmap(lt, short ? 0.2 : BEAT * 1.2, short ? 0.6 : BEAT * 2.2), 31, t), X, 385, { w: 500, px: 22, color: C.cyan, ls: 0.5 });
    const t2 = short ? BEAT * 1.4 : BEAT * 4;
    riseText(c, 'Docked with AutoDock Vina.', X, 470, rmap(lt, t2, t2 + 0.6), { w: 600, px: 40, color: C.ink });
    text(c, scramble('Ligand: PARP1 inhibitor 15R · 43 heavy atoms', rmap(lt, t2 + 0.2, t2 + 0.8), 33, t), X, 512, { w: 500, px: 20, color: C.dim });
    text(c, scramble('exhaustiveness 8 · 5 output poses', rmap(lt, t2 + 0.4, t2 + 1), 34, t), X, 544, { fam: MONO, w: 500, px: 17, color: C.mute, ls: 0.5 });
    FX.bloom = 0.9 + near * 0.5;
    FX.ca = 0.0015 + conv * 0.006;
    if (conv > 0) shake(0.0025 * conv, 9, lt);
    // whip 진입
    FX.zoom *= 1 + 0.04 * decay(lt, 6);
  },
};

// ── 05 점수와 보상: −13.09 → 리더보드 → 보상 변환
function drawBoard(c, lt, d, t, o) {
  const { rows, x0 = 640, y0 = 250, rowH = 74, barMax = 560, phaseReward = 0, appear = 0, short = false } = o;
  rows.forEach((r, i) => {
    const at = appear + i * (short ? 0.05 : 0.07);
    const e = clamp((lt - at) / 0.4); if (e <= 0) return;
    const y = y0 + i * rowH;
    const ex = E.outExpo(e);
    const xoff = (1 - ex) * 260;
    c.globalAlpha = ex;
    text(c, pad(i + 1), x0 + xoff, y + 12, { fam: MONO, w: 500, px: 20, color: C.mute });
    text(c, r.label, x0 + 56 + xoff, y + 12, { w: 700, px: 27, color: i === 0 ? C.ink : C.dim });
    const tw = textWidth(c, r.label, 700, 27);
    chip(c, r.style.short, x0 + 70 + tw + xoff, y + 2, { px: 13, fam: KR, color: r.style.color, bg: rgba(r.style.color, 0.08), border: rgba(r.style.color, 0.45), w: 600, ls: 0.5, alpha: ex });
    const scoreLen = (Math.abs(r.score) / 13.093) * barMax, rewLen = r.reward * barMax;
    const bl = lerp(scoreLen, rewLen, E.inOutCubic(phaseReward)) * E.outExpo(clamp((lt - at - 0.08) / 0.6));
    const bx = x0 + 470, by = y - 2;
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(bx, by, barMax, 8);
    const g = c.createLinearGradient(bx, 0, bx + barMax, 0); g.addColorStop(0, rgba(r.style.color, 0.35)); g.addColorStop(1, r.style.color);
    c.fillStyle = g; c.fillRect(bx, by, bl, 8);
    if (i === 0) { c.fillStyle = '#fff'; c.fillRect(bx + bl - 3, by - 3, 3, 14); }
    const valS = phaseReward < 0.5 ? r.score.toFixed(2).replace('-', '−') : r.reward.toFixed(2);
    const vA = phaseReward > 0 && phaseReward < 1 ? Math.abs(phaseReward - 0.5) * 2 : 1;
    text(c, valS, bx + barMax + 130, y + 12, { fam: MONO, w: 700, px: 26, color: phaseReward < 0.5 ? C.ink : C.mint, align: 'right', alpha: ex * vA });
  });
  c.globalAlpha = 1;
}
SCENES.score = {
  events(d) {
    const short = d < BAR * 1.5;
    const ev = [{ t: 0, type: 'impact', big: true }];
    const ap = short ? BEAT * 1 : BEAT * 2;
    for (let i = 0; i < 8; i++) ev.push({ t: ap + i * (short ? 0.05 : 0.07), type: 'blip', pitch: 7 - i });
    if (!short) { ev.push({ t: BEAT * 4, type: 'hit' }, { t: BEAT * 4, type: 'sweep', dur: BEAT * 2 }); }
    ev.push({ t: d - 0.22, type: 'whoosh', dur: 0.4 });
    return ev;
  },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const short = d < BAR * 1.5;
    background(c, t, { grid: 0.3, glow: [0.3, 0.45], glowColor: 'rgba(20,70,80,0.4)' });
    kickPunch(lt, 0.012);
    // 배경: 결합한 복합체(흐리게)
    const P = D.prot['parp1-4r6e-chain-a'];
    const cam = dockCam(lt + 3, d, { dist: 96, shiftX: 0.36, yaw: 0.9, spin: 0.08, focus: 0.7 });
    const R = ribbonSegments(P, cam, { draw: 1 });
    const lig = D.combos.find((cc) => cc.compoundId === '15r');
    c.save(); c.globalAlpha = 0.2;
    drawRibbon(c, R, { alpha: 0.3, width: 0.9, zNear: 60, zFar: 150, glow: false, insert: { z: project(cam, D.ligCenter)[2] - 4, draw: () => drawLigand(c, lig.atoms, lig.bonds, cam, { alpha: 0.9, scale: 1.1, glow: 0.6 }) } });
    c.restore();
    const ap = short ? BEAT * 1 : BEAT * 2;
    // 거대 점수
    const hp = clamp(lt / 0.28);
    const toBoard = E.inOutExpo(rmap(lt, ap - 0.25, ap + 0.1));
    const X = lerp(150, 1450, toBoard), Y = lerp(610, 262, toBoard);
    const sc = lerp(1 + (1 - E.outExpo(hp)) * 0.6, 0.14, toBoard);
    if (toBoard < 1) {
      c.save(); c.translate(X, Y); c.scale(sc, sc);
      c.shadowColor = 'rgba(94,242,208,0.5)'; c.shadowBlur = 60;
      text(c, '−13.09', 0, 0, { w: 900, px: 260, color: C.ink, ls: -8, alpha: 1 - toBoard * 0.6 });
      c.restore();
      const la = (1 - toBoard) * rmap(lt, 0.1, 0.4);
      text(c, 'kcal/mol', 160, 690, { fam: MONO, w: 600, px: 34, color: C.mint, alpha: la, ls: 2 });
      text(c, 'PARP1 inhibitor 15R · Top-ranked Vina pose', 160, 380, { w: 700, px: 30, color: C.ink, alpha: la });
      text(c, scramble('Best score among 8 executed combinations', rmap(lt, 0.2, 0.7), 41, t), 160, 425, { w: 500, px: 22, color: C.dim, alpha: la });
    }
    // 리더보드
    if (lt > ap - 0.2) {
      const phaseReward = short ? 0 : E.inOutCubic(rmap(lt, BEAT * 4.2, BEAT * 5.4));
      const head = phaseReward < 0.5 ? 'Docking score · kcal/mol' : 'Score → reward';
      const ha = rmap(lt, ap - 0.1, ap + 0.3);
      text(c, scramble('3 proteins · 8 combinations · Executed docking', ha, 51, t), 640, 150, { w: 600, px: 20, color: C.mint, ls: 1, alpha: ha });
      c.save(); c.globalAlpha = ha;
      if (phaseReward > 0 && phaseReward < 1) {
        const q = Math.abs(phaseReward - 0.5) * 2;
        text(c, head, 640, 205, { w: 800, px: 44, color: C.ink, alpha: q });
      } else text(c, head, 640, 205, { w: 800, px: 44, color: C.ink, alpha: ha });
      c.restore();
      drawBoard(c, lt, d, t, { rows: D.combos, appear: ap, phaseReward, short });
      if (!short && phaseReward > 0) text(c, 'Reward = 0.05 + 0.95 × (worst − score) / (worst − best)', 640, 870, { fam: KR, w: 500, px: 20, color: C.dim, alpha: phaseReward });
      if (!short && phaseReward > 0) text(c, 'External learning reward, not calibrated binding affinity.', 640, 902, { w: 500, px: 18, color: C.mute, alpha: phaseReward });
    }
    FX.flash = Math.max(FX.flash, 0.8 * decay(lt, 22));
    FX.streak = 0.5 + 2.5 * decay(lt, 5);
    if (lt < 0.3) shake(0.02 * (1 - lt / 0.3), 13, lt);
    FX.ca = 0.0015 + 0.03 * decay(lt, 10);
    FX.bloom = 0.9;
  },
};

// ── 06 선택: 초파리가 분자 서식지를 날며 머물지, 떠날지를 정합니다.
const HAB = { 'parp1-4r6e-chain-a': [-1.35, 0.0, -1.7], 'factor-xa-2p16': [1.7, 0.3, -3.9], 'cox2-3ln1': [-0.5, -0.2, -6.6] };
const HAB_SCALE = 0.03; // 사이트와 같은 1 Å = 0.03 월드 단위(초파리는 분자 축척이 아닙니다)
function habPoint(id, p) { const P = D.prot[id], o = HAB[id]; return [o[0] + (p[0] - P.center[0]) * HAB_SCALE, o[1] + (p[1] - P.center[1]) * HAB_SCALE, o[2] + (p[2] - P.center[2]) * HAB_SCALE]; }
const FLY_PATH = [[1.1, 0.55, 2.6], [0.55, 0.45, 1.3], [-0.05, 0.4, 0.2], [-0.35, 0.48, -0.75], [-0.15, 0.58, -1.75], [0.45, 0.52, -2.6], [0.95, 0.62, -3.3], [0.85, 0.72, -4.5], [0.2, 0.78, -5.6], [-0.2, 0.8, -6.4]];
function catmull(pts, u) {
  const n = pts.length - 1, x = clamp(u) * n, i = Math.min(Math.floor(x), n - 1), f = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  return [0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * f3));
}
function flyState(u) {
  const p = catmull(FLY_PATH, u), q = catmull(FLY_PATH, Math.min(1, u + 0.004)), r = catmull(FLY_PATH, Math.max(0, u - 0.004));
  const f = V3.norm(V3.sub(q, r));
  const acc = V3.sub(V3.add(q, r), V3.scale(p, 2));
  return { p, f, bank: clamp(-V3.dot(acc, V3.cross(f, [0, 1, 0])) * 2500, -0.75, 0.75) };
}
function flyModel(st, scale) {
  const f = st.f, up0 = [0, 1, 0];
  let L = V3.norm(V3.cross(up0, f)), U = V3.cross(f, L);
  const cb = Math.cos(st.bank), sb = Math.sin(st.bank);
  const L2 = V3.add(V3.scale(L, cb), V3.scale(U, sb)), U2 = V3.add(V3.scale(U, cb), V3.scale(L, -sb));
  return M4.basis(L2, U2, f, st.p, scale);
}
function chaseCam(u, o = {}) {
  const st = flyState(u);
  const lag = o.lag ?? 0.035;
  const pL = catmull(FLY_PATH, Math.max(0, u - lag));
  const fL = V3.norm(V3.sub(catmull(FLY_PATH, Math.max(0, u - lag + 0.01)), catmull(FLY_PATH, Math.max(0, u - lag - 0.01))));
  const side = V3.norm(V3.cross(fL, [0, 1, 0]));
  const eye = V3.add(V3.add(V3.add(pL, V3.scale(fL, -(o.back ?? 0.9))), [0, o.up ?? 0.24, 0]), V3.scale(side, o.side ?? 0.46));
  return { st, cam: camera({ eye, target: V3.add(st.p, V3.scale(st.f, 0.3)), fov: o.fov ?? 0.78, near: 0.01, far: 60 }) };
}
let MOTES = null;
function drawMotes(c, cam, t) {
  if (!MOTES) { const r = mulberry32(99); MOTES = Array.from({ length: 260 }, () => [(r() - 0.5) * 7, (r() - 0.3) * 3, 2.5 - r() * 10, r()]); }
  for (const m of MOTES) {
    const p = project(cam, [m[0] + Math.sin(t * 0.3 + m[3] * 9) * 0.05, m[1] + Math.sin(t * 0.4 + m[3] * 5) * 0.04, m[2]]);
    if (!p[3] || p[2] < 0.15) continue;
    const sz = clamp(2.4 / p[2], 0.6, 9), a = clamp(0.5 / (1 + Math.abs(p[2] - 2.2) * 0.8)) * (0.5 + 0.5 * m[3]);
    c.globalAlpha = a * (sz > 5 ? 0.35 : 1); c.fillStyle = '#9fe9ff';
    c.beginPath(); c.arc(p[0], p[1], sz, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}
SCENES.fly = {
  events(d) {
    const short = d < BAR * 1.5;
    const ev = [{ t: 0, type: 'whooshIn' }, { t: 0, type: 'buzz', dur: d }];
    ev.push({ t: short ? BEAT * 0.5 : BEAT * 1, type: 'hit' }, { t: short ? BEAT * 1.5 : BEAT * 2, type: 'hit' });
    if (!short) ev.push({ t: BEAT * 4.2, type: 'type' });
    ev.push({ t: d - 0.06, type: 'glitch' });
    return ev;
  },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const short = d < BAR * 1.5;
    background(c, t, { grid: 0.12, glow: [0.5, 0.4], glowColor: 'rgba(18,62,76,0.5)', floor: 0.8 });
    kickPunch(lt, 0.01);
    const u = lerp(0.03, short ? 0.5 : 0.86, E.inOutQuad(clamp(lt / d)) * 0.35 + clamp(lt / d) * 0.65);
    const { st, cam } = chaseCam(u);
    drawMotes(c, cam, t);
    // 서식지 단백질(실제 Cα 좌표, 같은 Å 축척)
    const items = Object.keys(HAB).map((id) => ({ id, R: ribbonSegments(D.prot[id], cam, { xform: (p) => habPoint(id, p) }), z: project(cam, HAB[id])[2] }));
    const flyDepth = project(cam, st.p)[2];
    gl3Begin(true);
    const wing = Math.sin(t * TAU * 11.7);
    drawFlyGL({ cam, model: flyModel(st, 0.95), wing: 0.12 + wing * 0.18, wingBlur: 1.15, rim: 1.2 });
    const drawFlyNow = () => { drawTrail(c, cam, u); blitGL(c, 1); };
    let flyDrawn = false;
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (!flyDrawn && it.z < flyDepth) { drawFlyNow(); flyDrawn = true; }
      const col = TARGET_STYLE[it.id].color;
      drawRibbon(c, it.R, { alpha: 0.95, width: 0.62, zNear: 1.4, zFar: 8, glow: false, maxW: 6, nearFade: 0.7, colors: { H: col, E: mixHex(col, '#ffffff', 0.35), C: mixHex(col, '#34495e', 0.45) } });
      const lp = project(cam, V3.add(HAB[it.id], [0, 1.3, 0]));
      if (lp[3] && lp[2] > 0.5) {
        const la = clamp(1.6 - lp[2] * 0.12);
        text(c, TARGET_STYLE[it.id].short, lp[0], lp[1], { w: 700, px: 20, color: col, align: 'center', alpha: la });
        text(c, 'PDB ' + D.prot[it.id].pdbId, lp[0], lp[1] + 21, { fam: MONO, w: 500, px: 13, color: C.dim, align: 'center', alpha: la });
      }
    }
    if (!flyDrawn) drawFlyNow();
    // 타이포: Stay, / or leave?
    const b1 = short ? BEAT * 0.5 : BEAT * 1, b2 = short ? BEAT * 1.5 : BEAT * 2;
    const outQ = rmap(lt, short ? BEAT * 3.3 : BEAT * 3.6, short ? BEAT * 3.8 : BEAT * 4.1);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 40;
    const wq1 = Math.round(lerp(250, 900, E.outExpo(rmap(lt, b1, b1 + 0.3)))), wq2 = Math.round(lerp(250, 900, E.outExpo(rmap(lt, b2, b2 + 0.3))));
    riseText(c, 'Stay,', 150, 330, rmap(lt, b1, b1 + 0.45), { w: wq1, px: 124, ls: -3, out: outQ });
    riseText(c, 'or leave?', W - 150, 480, rmap(lt, b2, b2 + 0.45), { w: wq2, px: 124, ls: -3, align: 'right', color: C.mint, out: outQ });
    if (!short) {
      riseText(c, 'Motor-neuron output guides the choice.', 150, 330, rmap(lt, BEAT * 4.2, BEAT * 4.2 + 0.6), { w: 800, px: 56, ls: -1 });
      text(c, scramble('Motor-neuron spikes → turn · climb · thrust', rmap(lt, BEAT * 4.6, BEAT * 5.4), 61, t), 150, 385, { w: 500, px: 24, color: C.dim });
    }
    c.restore();
    // 왼쪽 아래: 학습된 선호(실측)
    const pa = rmap(lt, short ? 0.2 : BEAT * 2.6, (short ? 0.2 : BEAT * 2.6) + 0.4);
    const px0 = 110, py0 = H - 420;
    if (pa > 0) {
      c.globalAlpha = pa;
      roundRect(c, px0, py0, 460, 330, 10); c.fillStyle = 'rgba(6,14,20,0.82)'; c.fill(); c.strokeStyle = C.line2; c.stroke();
      c.beginPath(); c.arc(px0 + 24, py0 + 30, 5, 0, TAU); c.fillStyle = C.cyan; c.fill();
      text(c, 'ION 01 · LEARNED PREFERENCE', px0 + 38, py0 + 36, { w: 700, px: 18, color: C.cyan, alpha: pa });
      const grow = E.outCubic(rmap(lt, (short ? 0.3 : BEAT * 2.8), d - 0.2));
      D.combos.forEach((r, i) => {
        const y = py0 + 72 + i * 29;
        const v = lerp(50, r.learned, grow);
        text(c, r.label.replace('PARP1 inhibitor ', ''), px0 + 22, y + 5, { w: 500, px: 15, color: i === 0 ? C.ink : C.dim, alpha: pa });
        text(c, r.style.short, px0 + 150, y + 5, { w: 500, px: 12, color: r.style.color, alpha: pa });
        c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(px0 + 215, y - 3, 170, 6);
        c.fillStyle = r.style.color; c.fillRect(px0 + 215, y - 3, 170 * v / 100, 6);
        text(c, Math.round(v) + '%', px0 + 440, y + 5, { fam: MONO, w: 600, px: 14, color: C.ink, align: 'right', alpha: pa });
      });
      text(c, 'Fly 01 · 20-fly local run · After ~9 minutes', px0 + 22, py0 + 316, { w: 500, px: 13, color: C.mute, alpha: pa });
      c.globalAlpha = 1;
    }
    // 오른쪽 아래: 해독된 운동 출력(실제 계산, 채널별 범위로 정규화해 표시)
    const ma = rmap(lt, short ? 0.4 : BEAT * 3, (short ? 0.4 : BEAT * 3) + 0.4);
    if (ma > 0) {
      const bx = W - 570, by = H - 300;
      c.globalAlpha = ma;
      roundRect(c, bx, by, 460, 210, 10); c.fillStyle = 'rgba(6,14,20,0.82)'; c.fill(); c.strokeStyle = C.line2; c.stroke();
      text(c, 'DECODED MOTOR OUTPUT · COMPUTED', bx + 22, by + 34, { w: 700, px: 17, color: C.mint, alpha: ma });
      const M = D.meta.hero.motor, fi = heroFrame(t), names = ['Turn', 'Climb', 'Thrust'], cols = [C.cyan, C.amber, C.rose];
      for (let k = 0; k < 3; k++) {
        const y = by + 80 + k * 44, [lo, hi] = D.motorRange[k];
        text(c, names[k], bx + 22, y + 5, { w: 500, px: 14, color: C.dim, alpha: ma });
        c.beginPath();
        for (let s = 0; s < 60; s++) { const idx = ((fi - 59 + s) % M.length + M.length) % M.length; const v = (M[idx][k] - lo) / (hi - lo || 1); const xx = bx + 70 + s * 5.6, yy = y + 12 - v * 26; s ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
        c.strokeStyle = cols[k]; c.lineWidth = 1.6; c.stroke();
        text(c, M[fi][k].toFixed(3), bx + 440, y + 5, { fam: MONO, w: 600, px: 13, color: C.ink, align: 'right', alpha: ma });
      }
      c.globalAlpha = 1;
    }
    FX.bloom = 0.8; FX.thresh = 0.62;
    FX.zoom *= 1 + 0.05 * decay(lt, 7);
  },
};
function drawTrail(c, cam, u) {
  const N = 80; let prev = null;
  c.lineCap = 'round';
  for (let k = 0; k < N; k++) {
    const uu = u - 0.01 - k * 0.003; if (uu < 0) break;
    const p = project(cam, V3.add(catmull(FLY_PATH, uu), [0, -0.01, 0]));
    if (prev && p[3] && prev[3]) {
      const a = 1 - k / N;
      c.globalAlpha = a * 0.8; c.strokeStyle = C.cyan; c.lineWidth = Math.max(0.6, (0.5 + a * 3) * clamp(2.2 / p[2], 0.3, 2.5));
      c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(p[0], p[1]); c.stroke();
    }
    prev = p;
  }
  c.globalAlpha = 1;
}

// ── 07 learning loop(30초 편집본): 카드마다 실제 데이터로 움직이는 미니 비주얼
const PIPE = [
  { n: '01', t: 'Real docking', s: '3 proteins → 8 Vina scores', tag: 'computed', col: C.mint, vis: 'dock' },
  { n: '02', t: 'Score → reward', s: 'Best 1.0 · Worst 0.05', tag: 'authored', col: C.amber, vis: 'reward' },
  { n: '03', t: 'Whole-brain compute', s: '167,122 neurons · Every step', tag: 'computed', col: C.mint, vis: 'brain' },
  { n: '04', t: 'Stay or leave', s: 'Guided by motor output', tag: 'computed + authored', col: C.violet, vis: 'fork' },
  { n: '05', t: 'Preference → spread', s: 'Spread in proportion to reward', tag: 'computed', col: C.mint, vis: 'dist' },
];
const CARD = { w: 300, h: 340, ax: 24, ay: 96, aw: 252, ah: 112 };
function cardVisual(c, kind, t, col, area) {
  const { aw, ah } = area;
  c.save();
  c.beginPath(); c.rect(0, 0, aw, ah); c.clip();
  if (kind === 'dock') {
    const lig = D.combos.find((cc) => cc.compoundId === '15r');
    const cam = camera({ target: D.ligCenter, yaw: t * 1.1, pitch: 0.3, dist: 34, fov: 0.62, aspect: aw / ah, near: 1, far: 200 });
    drawLigand(c, lig.atoms, lig.bonds, cam, { vw: aw, vh: ah, scale: 0.45, alpha: 1 });
  } else if (kind === 'reward') {
    const ph = 0.5 - 0.5 * Math.cos(t * 2.4);
    D.combos.forEach((r, i) => {
      const len = lerp(Math.abs(r.score) / 13.093, r.reward, E.inOutCubic(ph));
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 6 + i * 13, aw, 7);
      c.fillStyle = r.style.color; c.fillRect(0, 6 + i * 13, aw * len, 7);
    });
  } else if (kind === 'fork') {
    const cx = 36, cy = ah / 2;
    c.strokeStyle = rgba(col, 0.8); c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(8, cy); c.lineTo(cx + 40, cy); c.bezierCurveTo(cx + 90, cy, cx + 100, 18, aw - 20, 18); c.moveTo(cx + 40, cy); c.bezierCurveTo(cx + 90, cy, cx + 100, ah - 18, aw - 20, ah - 18); c.stroke();
    text(c, 'Stay', aw - 20, 12, { w: 700, px: 13, color: C.ink, align: 'right' });
    text(c, 'Leave', aw - 20, ah - 2, { w: 700, px: 13, color: C.ink, align: 'right' });
    const cyc = (t * 0.9) % 2, branch = cyc < 1 ? 0 : 1, q = cyc % 1;
    let px, py;
    if (q < 0.4) { px = lerp(8, cx + 40, q / 0.4); py = cy; } else { const u = (q - 0.4) / 0.6; const ty = branch ? ah - 18 : 18; px = lerp(cx + 40, aw - 20, u); py = lerp(cy, ty, E.inOutCubic(u)); }
    const g = c.createRadialGradient(px, py, 0, px, py, 14); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(px, py, 14, 0, TAU); c.fill();
  } else if (kind === 'dist') {
    const bw = aw / 8;
    D.combos.forEach((r, i) => {
      const hgt = (r.learned / 100) * (ah - 16);
      c.fillStyle = r.style.color; c.globalAlpha = 0.9;
      c.fillRect(i * bw + 3, ah - hgt, bw - 6, hgt);
      c.globalAlpha = 1;
    });
  }
  c.restore();
}
SCENES.pipeline = {
  events(d) { const ev = [{ t: 0, type: 'glitch' }]; for (let k = 0; k < 5; k++) ev.push({ t: k * BEAT, type: 'slam', pitch: k }); ev.push({ t: BEAT * 5, type: 'sweep', dur: BEAT * 2 }, { t: BEAT * 4, type: 'riser', dur: BEAT * 4 }, { t: d - BEAT, type: 'roll', dur: BEAT * 0.95 }); return ev; },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    background(c, t, { grid: 0.4, glow: [0.5, 0.52], glowColor: 'rgba(16,52,64,0.45)' });
    kickPunch(lt, 0.016, 0, BEAT * 5);
    const ring = E.inOutCubic(rmap(lt, BEAT * 5, BEAT * 6.3));
    const { w: cw, h: ch } = CARD;
    const cx0 = W / 2, cy0 = H / 2 + 20;
    // 링 단계: 뒤에 실제 뇌가 희미하게 돕니다.
    if (ring > 0) {
      const cam = brainCam({ yaw: -0.6 + lt * 0.25, pitch: 0.2, dist: 3.3, shiftY: -0.02 });
      drawHeroBrain(c, t, { cam, dist: 3.3, base: 0.06, spikeGain: 1.6, blitAlpha: 0.45 * ring });
    }
    const pos = PIPE.map((_, k) => {
      const lx = 160 + k * ((W - 320 - cw) / 4) + cw / 2, ly = cy0;
      const ang = -Math.PI / 2 + (k / 5) * TAU;
      const rx = cx0 + Math.cos(ang) * 400, ry = cy0 + Math.sin(ang) * 330;
      return [lerp(lx, rx, ring), lerp(ly, ry, ring)];
    });
    const scl = lerp(1, 0.6, ring);
    // 카드 안 미니 뇌: GL로 먼저 그려 둡니다.
    const k3 = 2, e3 = clamp((lt - k3 * BEAT) / 0.32);
    let brainRect = null;
    if (e3 > 0) {
      const [x, y] = pos[k3], dir = 1, yy = y + dir * (1 - E.outBack(e3, 2.2)) * 220;
      brainRect = [x + (CARD.ax - cw / 2) * scl, yy + (CARD.ay - ch / 2) * scl, CARD.aw * scl, CARD.ah * scl];
      const st = t * STEP_RATE;
      uploadTiles(st);
      gl3Begin(true, brainRect.map(Math.round), true);
      const cam = brainCam({ yaw: -0.5 + lt * 0.6, pitch: 0.2, dist: 2.9, aspect: brainRect[2] / brainRect[3] });
      drawCloud(P3.tile, { cam, step: st + 7, lastTex: P3.lastTiles, idxOffset: 7 * D.atlas.tn, size: 1.6, spikeSize: 2.4, base: 0.42, spikeGain: 2.4, time: t, sizeRef: 2.9 });
      gl3Resolve(1.5);
    }
    // 연결 화살표
    for (let k = 0; k < 4; k++) {
      const a = rmap(lt, (k + 1) * BEAT - 0.05, (k + 1) * BEAT + 0.25);
      if (a <= 0) continue;
      const [x1, y1] = pos[k], [x2, y2] = pos[k + 1];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const sx = x1 + ux * cw * scl * 0.52, sy = y1 + uy * ch * scl * 0.3, ex = x2 - ux * cw * scl * 0.52, ey = y2 - uy * ch * scl * 0.3;
      c.strokeStyle = rgba(C.mint, 0.6); c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(lerp(sx, ex, E.outCubic(a)), lerp(sy, ey, E.outCubic(a))); c.stroke();
      for (let j = 0; j < 2; j++) { const q = (t * 1.4 + k * 0.2 + j * 0.5) % 1; c.fillStyle = C.mint; c.beginPath(); c.arc(lerp(sx, ex, q), lerp(sy, ey, q), 3, 0, TAU); c.fill(); }
    }
    // 루프 복귀 화살표 05 → 03
    if (ring > 0.6) {
      const a = rmap(ring, 0.6, 1);
      c.save(); c.strokeStyle = rgba(C.amber, 0.85 * a); c.lineWidth = 2.5; c.setLineDash([10, 8]); c.lineDashOffset = -t * 60;
      c.beginPath(); c.arc(cx0, cy0, 470, -Math.PI / 2 + (4 / 5) * TAU + 0.25, -Math.PI / 2 + (2 / 5) * TAU + TAU - 0.25, false); c.stroke(); c.restore();
      const ang = -Math.PI / 2 + (2 / 5) * TAU + TAU - 0.25, ax = cx0 + Math.cos(ang) * 470, ay = cy0 + Math.sin(ang) * 470;
      c.save(); c.translate(ax, ay); c.rotate(ang + Math.PI / 2); c.fillStyle = rgba(C.amber, a); c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -14); c.lineTo(9, -14); c.closePath(); c.fill(); c.restore();
    }
    PIPE.forEach((p, k) => {
      const at = k * BEAT;
      const e = clamp((lt - at) / 0.32); if (e <= 0) return;
      const [x, y] = pos[k];
      const dir = k % 2 ? 1 : -1;
      const yy = y + (k === k3 ? 1 : dir) * (1 - E.outBack(e, 2.2)) * 220;
      const fresh = decay(lt - at, 4);
      c.save(); c.translate(x, yy); c.scale(scl, scl); c.globalAlpha = E.outCubic(e);
      c.translate(-cw / 2, -ch / 2);
      roundRect(c, 0, 0, cw, ch, 14); c.fillStyle = 'rgba(8,17,25,0.92)'; c.fill();
      c.strokeStyle = rgba(p.col, 0.3 + 0.7 * fresh); c.lineWidth = 1.5; c.stroke();
      if (fresh > 0.05) { c.save(); c.globalAlpha = fresh * 0.5; c.shadowColor = p.col; c.shadowBlur = 30; c.stroke(); c.restore(); }
      text(c, p.n, 24, 66, { fam: MONO, w: 700, px: 50, color: p.col });
      const tagW = textWidth(c, p.tag, 600, 14, KR, 0.5) + 14 * 2.45;
      chip(c, p.tag, cw - 24 - tagW, 46, { px: 14, fam: KR, color: p.col, bg: rgba(p.col, 0.08), border: rgba(p.col, 0.45), w: 600, ls: 0.5, alpha: E.outCubic(e) });
      // 미니 비주얼 영역
      c.save(); c.translate(CARD.ax, CARD.ay);
      c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, 0, CARD.aw, CARD.ah);
      if (p.vis === 'brain' && brainRect) { c.restore(); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = E.outCubic(e); c.drawImage(g3c, brainRect[0], brainRect[1], brainRect[2], brainRect[3], brainRect[0], brainRect[1], brainRect[2], brainRect[3]); }
      else cardVisual(c, p.vis, t, p.col, CARD);
      c.restore();
      const tpx = Math.min(34, 34 * (cw - 48) / textWidth(c, p.t, 800, 34, KR, -0.5));
      text(c, p.t, 24, 262, { w: 800, px: tpx, color: C.ink, ls: -0.5 });
      text(c, p.s, 24, 300, { w: 500, px: 16, color: C.dim });
      c.restore();
    });
    c.globalAlpha = 1;
    // 중앙 문구
    const ca = rmap(lt, BEAT * 5.8, BEAT * 6.4);
    if (ca > 0) {
      c.save(); c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 30;
      wipeText(c, 'Continuous', cx0, cy0 - 18, ca, { w: 900, px: 68, align: 'center', ls: -2, bar: rgba(C.amber, 0.85) });
      wipeText(c, 'learning loop', cx0, cy0 + 62, rmap(lt, BEAT * 6.1, BEAT * 6.7), { w: 900, px: 68, align: 'center', color: C.mint, ls: -2, bar: C.mint });
      text(c, 'Computation continues beyond each batch.', cx0, cy0 + 112, { w: 500, px: 21, color: C.dim, align: 'center', alpha: rmap(lt, BEAT * 6.5, BEAT * 7) });
      c.restore();
    }
    for (let k = 0; k < 5; k++) FX.flash = Math.max(FX.flash, 0.08 * decay(lt - k * BEAT, 22));
    const lastB = rmap(lt, d - BEAT, d);
    if (lastB > 0) { FX.flash = Math.max(FX.flash, (Math.floor(lastB * 8) % 2) * 0.06 * lastB); shake(0.004 * lastB, 17, lt); FX.ca = 0.002 + lastB * 0.01; }
    FX.bloom = 0.85;
  },
};

// ── 08 원칙: 진짜 도킹 점수. / 진짜 스파이크. / 가짜는 없습니다.
SCENES.slogan = {
  events(d) { return [{ t: 0, type: 'slam', big: true }, { t: BEAT, type: 'slam', big: true }, { t: BEAT * 2, type: 'slam', big: true, last: true }, { t: BEAT * 3, type: 'swell', dur: BEAT }]; },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    const b = Math.floor(lt / BEAT), bl = lt - b * BEAT;
    c.fillStyle = '#020407'; c.fillRect(0, 0, W, H);
    const pop = 1 + 0.14 * decay(bl, 16);
    const wt = Math.round(lerp(300, 900, E.outExpo(clamp(bl / 0.2))));
    const slam = (s1, s2, col1) => {
      c.save(); c.translate(W / 2, H / 2 + 60); c.scale(pop, pop);
      const size = Math.min(190, 190 * (W - 220) / (textWidth(c, s1 + s2, wt, 190, KR, -6) * pop));
      setFont(c, wt, size, KR, -6); const w1 = c.measureText(s1).width, w2 = c.measureText(s2).width, tw = w1 + w2;
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.fillStyle = col1; c.fillText(s1, -tw / 2, 0);
      c.fillStyle = C.ink; c.fillText(s2, -tw / 2 + w1, 0);
      c.restore();
    };
    if (b === 0) {
      // 뒤: 실제 점수 목록
      c.globalAlpha = 0.16;
      D.combos.forEach((r, i) => text(c, `${r.score.toFixed(3).replace('-', '−')}  ${r.label} · ${r.style.short}`, 160, 170 + i * 95 - bl * 60, { fam: MONO, w: 600, px: 30, color: C.mint }));
      c.globalAlpha = 1;
      slam('Real ', 'docking scores.', C.mint);
    } else if (b === 1) {
      const cam = brainCam({ yaw: -0.3 + lt * 0.2, pitch: 0.15, dist: 2.4 });
      drawHeroBrain(c, t, { cam, dist: 2.4, blitAlpha: 0.55, spikeGain: 1.6, base: 0.07 });
      slam('Real ', 'spikes.', C.mint);
    } else {
      const imp = rmap(lt, BEAT * 3.5, d);
      c.save(); c.translate(W / 2, H / 2 + 60); const s = pop * (1 - E.inExpo(imp) * 0.9); c.scale(s, s);
      setFont(c, Math.round(lerp(300, 900, E.outExpo(clamp((lt - BEAT * 2) / 0.2)))), 210, KR, -7); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = C.ink; c.globalAlpha = 1 - E.inExpo(imp);
      c.fillText('Nothing faked.', 0, 0);
      c.restore(); c.globalAlpha = 1;
      FX.glitch = 0.5 * decay(lt - BEAT * 2, 6) + E.inExpo(imp) * 0.4;
      FX.flash = Math.max(FX.flash, E.inExpo(imp) * 0.9);
    }
    FX.hud = 0.4;
    FX.streak = 0.5 + 2.0 * decay(bl, 6);
    FX.flash = Math.max(FX.flash, 0.18 * decay(bl, 24));
    FX.ca = 0.003 + 0.02 * decay(bl, 10);
    shake(0.012 * decay(bl, 12), 21 + b, lt);
    FX.bloom = 1.0;
  },
};

// ── 09 엔드 카드: 실제 뉴런들이 FDDD 글자로 모입니다(스파이크는 계속됩니다).
let morphReady = false;
function buildMorphTargets() {
  // 'FDDD' 글자를 래스터화해 표본점을 얻고, 좌표 순서대로 뉴런에 배정합니다.
  const cw = 1400, chh = 420, cv = mkCanvas(cw, chh), x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, cw, chh);
  setFont(x, 900, 360, KR, -12); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('FDDD', cw / 2, chh / 2 + 10);
  const img = x.getImageData(0, 0, cw, chh).data;
  const pts = [];
  for (let yy = 0; yy < chh; yy += 2) for (let xx = 0; xx < cw; xx += 2) if (img[(yy * cw + xx) * 4] > 128) pts.push([xx, yy]);
  const { n, pos } = D.atlas;
  const rnd = mulberry32(7);
  const S = 1.9 / cw; // 월드 폭 1.9
  const targets = new Float32Array(n * 3);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => pos[a * 3] - pos[b * 3]);
  const tOrder = pts.map((p, i) => i).sort((a, b) => pts[a][0] - pts[b][0]);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const pp = pts[tOrder[Math.floor((k / n) * pts.length)]];
    const jx = (rnd() - 0.5) * 2.2, jy = (rnd() - 0.5) * 2.2;
    targets[i * 3] = (pp[0] + jx - cw / 2) * S;
    targets[i * 3 + 1] = -(pp[1] + jy - chh / 2) * S + 0.12;
    targets[i * 3 + 2] = (rnd() - 0.5) * 0.03;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, P3.hero.morphBuf); gl.bufferData(gl.ARRAY_BUFFER, targets, gl.STATIC_DRAW);
  morphReady = true;
}
SCENES.end = {
  events(d) { return [{ t: 0, type: 'sting' }, { t: BEAT * 1.2, type: 'type' }, { t: BEAT * 2, type: 'blip', pitch: 7 }]; },
  draw(c, lt, d, env) {
    const t = env.t0 + lt;
    if (!morphReady) buildMorphTargets();
    background(c, t, { grid: 0.2, glow: [0.5, 0.42], glowColor: 'rgba(22,80,90,0.5)' });
    const mp = E.inOutCubic(rmap(lt, 0.0, BEAT * 2.2));
    const cam = camera({ target: [0, 0.05, 0], yaw: lerp(-0.7, 0, E.outCubic(rmap(lt, 0, BEAT * 2.4))), pitch: lerp(0.2, 0, mp), dist: 2.35, fov: 0.62, shiftY: -0.03 });
    const st = heroStep(t);
    uploadHero(st);
    gl3Begin(true, null, true);
    // 모핑 전: 모델 좌표를 뇌 중심에 맞춥니다.
    const model = M4.chain(M4.T(-D.cnsCenter[0], -D.cnsCenter[1] + 0.05, -D.cnsCenter[2]), BRAIN_MODEL);
    const LOGO = [[0.3, 1.0, 0.86], [0.78, 1.0, 0.95], [1.0, 0.86, 0.5], [0.55, 0.86, 1.0], [0.6, 0.9, 0.86]];
    const cols = GROUP_COLORS.map((g, i) => g.map((v, k) => lerp(v, LOGO[i][k], mp)));
    drawCloud(P3.hero, { cam, model, step: st, lastTex: P3.lastHero, size: lerp(1.6, 1.9, mp), spikeSize: 2.8, base: lerp(0.09, 0.2, mp), spikeGain: 1.8, time: t, sizeRef: 2.35, morph: mp, swirl: 1.2, colors: cols });
    gl3Resolve(lerp(1.25, 1.5, mp));
    blitGL(c, 1);
    const a1 = rmap(lt, BEAT * 1.4, BEAT * 2.2);
    text(c, 'FLY-DRIVEN DRUG DEVELOPMENT', W / 2, 700, { fam: MONO, w: 600, px: 22, color: C.dim, align: 'center', ls: 9, alpha: a1 });
    riseText(c, 'Fly-Driven Drug Development', W / 2, 772, rmap(lt, BEAT * 1.6, BEAT * 2.4), { w: 700, px: 46, align: 'center', ls: -0.5 });
    const a2 = rmap(lt, BEAT * 2, BEAT * 2.6);
    text(c, 'flybrain.kr', W / 2, 850, { fam: MONO, w: 700, px: 34, color: C.mint, align: 'center', alpha: a2, ls: 1 });
    const uw = textWidth(c, 'flybrain.kr', 700, 34, MONO, 1);
    c.fillStyle = C.mint; c.globalAlpha = a2; c.fillRect(W / 2 - uw / 2, 862, uw * E.outExpo(rmap(lt, BEAT * 2.1, BEAT * 3)), 2); c.globalAlpha = 1;
    text(c, 'github.com/AwesomeZun/FDDD', W / 2, 898, { fam: MONO, w: 500, px: 18, color: C.dim, align: 'center', alpha: a2 });
    const a3 = rmap(lt, BEAT * 2.4, BEAT * 3.2);
    text(c, 'Data: MaleCNS v1.0 (CC BY 4.0) · Fly: flybody (Apache-2.0) · Structures: RCSB PDB 4R6E · 2P16 · 3LN1 · Docking: AutoDock Vina', W / 2, H - 92, { w: 500, px: 14, color: C.mute, align: 'center', alpha: a3 });
    text(c, 'Spikes: FDDD MaleCNS LIF engine (based on fly-connectome-template by Mert Cobanov) · Motion design: Claude', W / 2, H - 68, { w: 500, px: 14, color: C.mute, align: 'center', alpha: a3 });
    FX.hud = 0;
    FX.flash = Math.max(FX.flash, 0.85 * decay(lt, 12));
    FX.streak = 0.5 + 2.0 * decay(lt, 3);
    FX.bloom = 0.9 + 0.5 * decay(lt - BEAT * 2.2, 3);
    FX.vig = 0.5;
  },
};

// ─────────────────────────────────────────────────────────── §7 타임라인 · 렌더
function cutPlan(cut) {
  const spec = EDL.cuts[String(cut)];
  return { dur: spec.bars * BAR, scenes: spec.scenes.map((s, i) => ({ ...s, i, t0: s.from * BAR, t1: s.to * BAR, d: (s.to - s.from) * BAR })), music: spec.music, total: spec.scenes.length, cut };
}
const TRANS = { whip: [0.16, 0.14], zoom: [0.2, 0.12] };
function transitionAt(plan, t) {
  for (let i = 1; i < plan.scenes.length; i++) {
    const s = plan.scenes[i], tr = TRANS[s.in];
    if (!tr) continue;
    if (t >= s.t0 - tr[0] && t < s.t0 + tr[1]) return { from: plan.scenes[i - 1], to: s, p: (t - (s.t0 - tr[0])) / (tr[0] + tr[1]), type: s.in };
  }
  return null;
}
function drawScene(c, s, t) {
  SCENES[s.id].draw(c, t - s.t0, s.d, { t0: s.t0, plan: null });
}
function renderFrame(t, cut) {
  const plan = cutPlan(cut);
  t = clamp(t, 0, plan.dur - 1 / FPS / 2);
  fxReset();
  const tr = transitionAt(plan, t);
  let cur = plan.scenes.find((s) => t >= s.t0 && t < s.t1) || plan.scenes[plan.scenes.length - 1];
  ctx.save();
  if (!tr) {
    drawScene(ctx, cur, t);
  } else {
    // 두 장면을 각각 레이어에 그리고 전환 효과로 합성합니다.
    const lc1 = L1.getContext('2d'), lc2 = L2.getContext('2d');
    const saveFX = { ...FX };
    drawScene(lc1, tr.from, t); const fx1 = { ...FX };
    Object.assign(FX, saveFX);
    drawScene(lc2, tr.to, t);
    FX.zoom = lerp(fx1.zoom, FX.zoom, tr.p); FX.bloom = Math.max(fx1.bloom, FX.bloom);
    const p = tr.p;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (tr.type === 'whip') {
      // 셔터 시간 동안의 이동을 여러 번 나눠 더해 방향성 모션 블러를 만듭니다.
      const [a0, a1] = TRANS.whip, start = tr.to.t0 - a0, dur = a0 + a1, N = 12;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < N; k++) {
        const pp = clamp((t - (k / N) * (1 / FPS) - start) / dur), off = -E.inOutExpo(pp) * W;
        ctx.globalAlpha = 1 / N;
        ctx.drawImage(L1, off, 0); ctx.drawImage(L2, off + W, 0);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      FX.ca = Math.max(FX.ca, 0.025 * Math.sin(p * Math.PI));
    } else if (tr.type === 'zoom') {
      // 나가는 장면은 빨려 들어가듯 커지고, 들어오는 장면은 크게 시작해 제자리를 찾습니다.
      const s1 = 1 + E.inCubic(clamp(p / 0.62)) * 1.5, a1 = 1 - E.inQuad(clamp((p - 0.2) / 0.4));
      const s2 = 1 + (1 - E.outCubic(clamp((p - 0.38) / 0.62))) * 0.45, a2 = E.outQuad(clamp((p - 0.36) / 0.26));
      const blur1 = 0.12 * Math.sin(clamp(p / 0.62) * Math.PI), blur2 = 0.08 * (1 - clamp((p - 0.38) / 0.62));
      const zoomed = (img, s, a, b) => {
        if (a <= 0) return;
        const N = 7;
        for (let k = 0; k < N; k++) {
          const sk = s * (1 + b * (k / N));
          ctx.globalAlpha = a / N;
          ctx.setTransform(sk, 0, 0, sk, (W / 2) * (1 - sk), (H / 2) * (1 - sk)); ctx.drawImage(img, 0, 0);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      };
      ctx.globalCompositeOperation = 'lighter';
      zoomed(L1, s1, a1, blur1); zoomed(L2, s2, a2, blur2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      FX.ca = Math.max(FX.ca, 0.03 * Math.sin(p * Math.PI));
      FX.flash = Math.max(FX.flash, 0.12 * Math.exp(-Math.pow((p - 0.45) * 7, 2)));
    }
    cur = p < 0.5 ? tr.from : tr.to;
  }
  // 경계 효과(하드 컷)
  for (const s of plan.scenes) {
    const dt = t - s.t0;
    if (dt < 0 || dt > 0.5) continue;
    if (s.in === 'glitch') { FX.glitch = Math.max(FX.glitch, 0.8 * decay(dt, 9)); FX.ca = Math.max(FX.ca, 0.03 * decay(dt, 10)); }
    if (s.in === 'strobe') FX.flash = Math.max(FX.flash, dt < 0.034 || (dt > 0.1 && dt < 0.134) ? 0.45 : 0);
  }
  ctx.restore();
  drawHUD(ctx, t, { cut, index: cur.i, total: plan.total, label: cur.label, lt: t - cur.t0, dur: plan.dur }, FX.hud);
  postProcess(c2, FX, t);
}

function allEvents(cut) {
  const plan = cutPlan(cut), ev = [];
  for (const s of plan.scenes) for (const e of SCENES[s.id].events(s.d)) ev.push({ ...e, t: +(s.t0 + e.t).toFixed(5), scene: s.id });
  ev.sort((a, b) => a.t - b.t);
  return { dur: plan.dur, bpm: BPM, beat: BEAT, bar: BAR, music: plan.music.map((m) => ({ ...m, t0: m.from * BAR, t1: m.to * BAR })), scenes: plan.scenes.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, in: s.in || null })), events: ev };
}

// 크기 변경(썸네일 렌더용)
function resizeAll(w, h) {
  W = w; H = h;
  c2.width = w; c2.height = h; L1.width = w; L1.height = h; L2.width = w; L2.height = h;
  g3c.width = w; g3c.height = h; out.width = w; out.height = h;
  out.style.width = w + 'px'; out.style.height = h + 'px';
  buildBloomChain(); lastHeroKey = null; lastTilesKey = null; posterCache = null;
}
function renderPoster(o) {
  const { w = 1920, h = 1080, variant = 'cover', cut = 30, t = 0 } = o;
  resizeAll(w, h);
  fxReset();
  drawPoster(ctx, t, { variant, cut });
  FX.bloom = 0.8; FX.grain = 0.035;
  postProcess(c2, FX, t);
}

// ─────────────────────────────────────────────────────────── §8 재생기 · 외부 API
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
if (RENDER) document.body.classList.add('render');
let state = { cut: Number(params.get('cut') || 30), t: 0, playing: false, t0: 0, p0: 0 };
const audio = {};
function setupAudio() {
  for (const k of ['15', '30']) { const el = $('a' + k); if (el) { audio[k] = el; el.preload = 'auto'; } }
}
function cur() { return audio[String(state.cut)]; }
function play() {
  state.playing = true; $('play').textContent = '❚❚ Pause'; $('play').setAttribute('aria-label', 'Pause');
  const a = cur(); const dur = cutPlan(state.cut).dur;
  if (state.t >= dur - 0.05) state.t = 0;
  if (a) { a.currentTime = state.t; a.play().catch(() => {}); }
  state.p0 = performance.now(); state.t0 = state.t;
}
function pause() { state.playing = false; $('play').textContent = '▶ Play'; $('play').setAttribute('aria-label', 'Play'); const a = cur(); if (a) a.pause(); }
function setCut(k) {
  pause(); state.cut = k; state.t = 0; $('scrub').value = 0;
  $('cut15').classList.toggle('on', k === 15); $('cut30').classList.toggle('on', k === 30);
  renderFrame(0, k);
}
function tick() {
  if (state.playing) {
    const a = cur(); const dur = cutPlan(state.cut).dur;
    state.t = a && !a.paused ? a.currentTime : state.t0 + (performance.now() - state.p0) / 1000;
    if (state.t >= dur) { state.t = dur - 1e-3; pause(); }
    renderFrame(state.t, state.cut);
  }
  $('scrub').value = state.t / cutPlan(state.cut).dur;
  const s = state.t; $('tc').textContent = `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}.${pad(Math.floor((s % 1) * 100))}`;
  requestAnimationFrame(tick);
}
function setupUI() {
  $('play').onclick = () => (state.playing ? pause() : play());
  $('cut15').onclick = () => setCut(15); $('cut30').onclick = () => setCut(30);
  $('scrub').oninput = (e) => { const dur = cutPlan(state.cut).dur; state.t = Number(e.target.value) * dur; if (state.playing) play(); else renderFrame(state.t, state.cut); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { pause(); state.t = clamp(state.t + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 1 / FPS), 0, cutPlan(state.cut).dur - 1e-3); renderFrame(state.t, state.cut); }
    if (e.key === '1') setCut(15); if (e.key === '2') setCut(30);
  });
  let idleT = 0; const ui = $('ui');
  const wake = () => { ui.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => state.playing && ui.classList.add('idle'), 2200); };
  addEventListener('mousemove', wake); addEventListener('touchstart', wake);
}

async function boot() {
  await Promise.all([document.fonts.load(`900 100px ${KR}`), document.fonts.load(`400 100px ${KR}`), document.fonts.load(`700 20px ${MONO}`), document.fonts.load(`500 20px ${MONO}`)]);
  await loadData();
  c2 = mkCanvas(); ctx = c2.getContext('2d'); L1 = mkCanvas(); L2 = mkCanvas();
  initGL(); initPost();
  buildMorphTargets();
  setupAudio(); setupUI();
  $('loading').style.display = 'none';
  $('cut15').classList.toggle('on', state.cut === 15); $('cut30').classList.toggle('on', state.cut === 30);
  renderFrame(0, state.cut);
  if (!RENDER) requestAnimationFrame(tick);
  window.__ready = true;
}
window.REEL = {
  render: (t, cut) => { renderFrame(t, cut); return true; },
  poster: (o) => { renderPoster(o); return true; },
  events: (cut) => allEvents(cut),
  duration: (cut) => cutPlan(cut).dur,
  fps: FPS,
  dbg: { brain: (o) => { fxReset(); background(ctx, 0, { grid: 0 }); drawHeroBrain(ctx, o.t || 0, o); FX.hud = 0; postProcess(c2, FX, 0); return true; } },
  meta: () => ({ chosen: D.chosen, cns: D.cnsCenter, brain: D.brainCenter, combos: D.combos.map((c) => [c.label, c.score, +c.reward.toFixed(3), c.learned]) }),
};
boot().catch((e) => { console.error(e); $('loading').textContent = 'Error: ' + e.message; window.__error = String(e && e.stack || e); });
})();
