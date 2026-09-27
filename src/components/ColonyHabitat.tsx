import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { HabitatPair, ColonyFly } from '../lib/colonyPolicy';
import { makePrismVariant } from '../design-studio/prism-models';
import { FLY_ACCENTS } from '../lib/flyAccents';
import { disposeMolecularObject, makeProteinComplex } from './ProteinRibbon';
import {WORLD_UNITS_PER_ANGSTROM, type MolecularGeometry} from '../lib/molecularScale.ts';

export type ColonyHabitatProps = { pairs: HabitatPair[]; flies: ColonyFly[]; paused: boolean; selected: number; onSelect: (i: number) => void; /** Camera tracks the selected fly (orbit offset preserved, zoom raised while following). */ follow?: boolean };
const accents = FLY_ACCENTS.map(c => new T.Color(c).getHex());
const proteins = [0x608997, 0x95827c, 0x7b83a5, 0x7e9686, 0x9b9077, 0x7b8b9d];

function label(text: string, color = '#adc0cb', width = 2.5) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '500 30px system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.fillText(text.length > 47 ? text.slice(0, 44) + '…' : text, 384, 55);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .9 }));
  sprite.scale.set(width, width / 8, 1); return sprite;
}

/** Authored insect anatomy only. Position and trails come from the colony policy. */
// Four flies use the PRISM LOW-3 avatar (3 draw calls each: one vertex-colored body mesh + two single-pass wings),
// chosen from the actual 100-fly benchmark in docs/prism-simplification.md. Per-fly accent is baked into the
// thorax/abdomen/head vertex colors so eyes stay reddish-brown and no extra material or draw call is added.
const BODY_TINT_PARTS = new Set(['thorax', 'abdomen', 'head']);
function makeFly(index: number) {
  const root = new T.Group(); const accent = accents[index % accents.length], accentColor = new T.Color(accent);
  const model = makePrismVariant(3); const anatomy = model.root; anatomy.userData = { ...anatomy.userData, flyIndex: index }; root.add(anatomy);
  // LOW-3 body spans about 1.65 units nose to tail; at .084 the avatar is ~.14 world units (user asked for ~1/5 of the previous .42).
  root.scale.setScalar(.084);
  const body = anatomy.getObjectByName('body-vertex-color-batch') as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  if (!body) throw new Error('PRISM LOW-3 body mesh missing');
  const colors = body.geometry.getAttribute('color') as T.BufferAttribute;
  const parts = body.userData.sourceParts as { name: string; vertexStart: number; vertexCount: number; color: number }[];
  for (const part of parts) {
    if (!BODY_TINT_PARTS.has(part.name)) continue;
    const base = new T.Color(part.color).lerp(accentColor, part.name === 'abdomen' ? .62 : .48);
    for (let i = part.vertexStart; i < part.vertexStart + part.vertexCount; i++) colors.setXYZ(i, base.r, base.g, base.b);
  }
  colors.needsUpdate = true;
  const trim = body.material; trim.emissive = accentColor.clone(); trim.emissiveIntensity = .18;
  const wings = model.wings;
  wings.forEach(w => { const m = (w.children[0] as T.Mesh).material as T.MeshPhysicalMaterial; m.color = new T.Color(0xd9ecf1).lerp(accentColor, .25); });
  const name = label(String(index + 1).padStart(2, "0"), '#' + accentColor.getHexString(), 1.9); name.position.set(0, 2.4, 0); root.add(name);
  const hit = new T.Mesh(new T.SphereGeometry(3.2, 8, 6), new T.MeshBasicMaterial({ visible: false })); root.add(hit); hit.userData.flyIndex = index;
  return { root, anatomy, wings, trim, hit };
}

type FlyVisual = ReturnType<typeof makeFly> & { trail: T.Line; trailVersion: string };
type Runtime = { scene: T.Scene; stations: T.Group; camera: T.OrthographicCamera; controls: OrbitControls; fitted: boolean; aspect: number };

function fitMolecularScene(live:Runtime) {
  const bounds=new T.Box3().setFromObject(live.stations);
  if(bounds.isEmpty())return;
  const center=bounds.getCenter(new T.Vector3());
  live.controls.target.copy(center);
  live.camera.position.copy(center).add(new T.Vector3(.18,.72,1).normalize().multiplyScalar(30));
  live.camera.lookAt(center);live.camera.updateMatrixWorld(true);
  let halfX=0,halfY=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const v=new T.Vector3(x,y,z).applyMatrix4(live.camera.matrixWorldInverse);halfX=Math.max(halfX,Math.abs(v.x));halfY=Math.max(halfY,Math.abs(v.y));
  }
  const halfHeight=Math.max(halfY,halfX/live.aspect)*1.12;
  live.camera.left=-halfHeight*live.aspect;live.camera.right=halfHeight*live.aspect;live.camera.top=halfHeight;live.camera.bottom=-halfHeight;
  live.camera.zoom=1;live.camera.updateProjectionMatrix();live.controls.update();live.fitted=true;
}

export function ColonyHabitat(props: ColonyHabitatProps) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props), runtime = useRef<Runtime | null>(null);
  const [error, setError] = useState(''), [loaded, setLoaded] = useState(0);
  const scaleLine=useRef<HTMLDivElement>(null),scaleText=useRef<HTMLSpanElement>(null);
  latest.current = props;
  useEffect(() => {
    const el = host.current!; let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setError('This shared 3D habitat requires WebGL. Molecular detail remains available outside this view.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7)); renderer.setClearColor(0x080f18);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    renderer.domElement.setAttribute('aria-label', 'Shared molecular habitat. Drag to orbit, scroll to zoom, right-drag to pan. Select a fly by clicking it.');
    el.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.fog = new T.FogExp2(0x080f18, .018);
    scene.add(new T.HemisphereLight(0xc8e8ff, 0x23303d, 2.1));
    const key = new T.DirectionalLight(0xe1f0ff, 3.4); key.position.set(7, 12, 9); scene.add(key);
    const rim = new T.DirectionalLight(0x7d97c0, 2.4); rim.position.set(-9, 4, -7); scene.add(rim);
    const warm = new T.DirectionalLight(0xc1a4a0, 1.2); warm.position.set(2, -3, 6); scene.add(warm);
    const camera = new T.OrthographicCamera(-9,9,9,-9,.05,180); camera.position.set(11,8,15);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = 2; controls.maxDistance = 65; controls.minZoom=.25;controls.maxZoom=12; controls.maxPolarAngle = Math.PI * .92;
    const stations = new T.Group(); scene.add(stations);
    runtime.current = { scene, stations, camera, controls, fitted: false, aspect:1 };
    const visuals: FlyVisual[] = [];
    const ray = new T.Raycaster(), pointer = new T.Vector2(); let down = [0, 0];
    const pointerDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(visuals.map(v => v.hit))[0];
      if (hit) latest.current.onSelect(hit.object.userData.flyIndex as number);
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
    const resize = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); const live=runtime.current;if(live){live.aspect=w/h;if(live.fitted)fitMolecularScene(live);else{camera.left=-9*w/h;camera.right=9*w/h;camera.updateProjectionMatrix();}} };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    let raf = 0, last = performance.now(), wingTime = 0;
    const direction = new T.Vector3(), rotation = new T.Quaternion(), forward = new T.Vector3(0, 0, 1);
    let wasFollowing = false;
    const render = (now: number) => {
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      const current = latest.current; if (!current.paused) wingTime += dt;
      while (visuals.length > current.flies.length) { const v = visuals.pop()!; scene.remove(v.root, v.trail); disposeMolecularObject(v.root); disposeMolecularObject(v.trail); }
      current.flies.forEach((fly, index) => {
        if (!visuals[index]) {
          const made = makeFly(index); made.root.position.fromArray(fly.position);
          const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(240 * 3), 3)); geometry.setDrawRange(0, 0);
          const trail = new T.Line(geometry, new T.LineBasicMaterial({ color: accents[index % accents.length], transparent: true, opacity: .38, depthWrite: false })); trail.frustumCulled = false;
          visuals[index] = { ...made, trail, trailVersion: '' }; scene.add(made.root, trail);
        }
        const visual = visuals[index];
        if (current.paused) visual.root.position.fromArray(fly.position);
        else visual.root.position.lerp(new T.Vector3(...fly.position), 1 - Math.exp(-dt * 13));
        direction.fromArray(fly.velocity);
        if (direction.lengthSq() > .00001) { rotation.setFromUnitVectors(forward, direction.normalize()); visual.anatomy.quaternion.slerp(rotation, 1 - Math.exp(-dt * 8)); }
        visual.wings.forEach((wing, side) => { wing.rotation.z = (side === 0 ? -1 : 1) * (.07 + Math.sin(wingTime * 48 + index * 1.8) * .55); });
        // Feeding is shown as an emissive pulse; the LOW-3 mouthparts are merged into the body mesh, so no separate mouth object exists.
        visual.trim.emissiveIntensity = (index === current.selected ? .55 : .18) + fly.feeding * .35;
        const points = fly.trail.slice(-240), version = `${points.length}:${points[0]?.join(',')}:${points.at(-1)?.join(',')}`;
        if (version !== visual.trailVersion) {
          const attr = visual.trail.geometry.getAttribute('position') as T.BufferAttribute;
          points.forEach((p, i) => attr.setXYZ(i, p[0], p[1], p[2])); attr.needsUpdate = true; visual.trail.geometry.setDrawRange(0, points.length); visual.trailVersion = version;
        }
      });
      // Follow mode: move the orbit target with the selected avatar while keeping the user's current orbit offset.
      const target = current.follow ? visuals[current.selected] : undefined;
      if (target) { const offset = camera.position.clone().sub(controls.target); controls.target.lerp(target.root.position, 1 - Math.exp(-dt * 6)); camera.position.copy(controls.target).add(offset); if (!wasFollowing) { camera.zoom = Math.max(camera.zoom, 6); camera.updateProjectionMatrix(); } wasFollowing = true; }
      else if (wasFollowing) { wasFollowing = false; }
      controls.update();
      if(scaleLine.current&&scaleText.current){
        const pixelsPerAngstrom=el.clientWidth/((camera.right-camera.left)/camera.zoom)*WORLD_UNITS_PER_ANGSTROM;
        const desired=105/Math.max(pixelsPerAngstrom,.0001),decade=10**Math.floor(Math.log10(desired));
        const units=[1,2,5,10].map(v=>v*decade).reduce((a,b)=>Math.abs(a-desired)<Math.abs(b-desired)?a:b);
        scaleLine.current.style.width=(units*pixelsPerAngstrom)+'px';scaleText.current.textContent=units+' Å ('+(units/10)+' nm)';
      }
      renderer.render(scene, camera); raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); runtime.current = null; disposeMolecularObject(scene); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  // Independent from initialization: late-arriving pair data always populates the live world.
  const pairKey = JSON.stringify(props.pairs.map(p => [p.id, p.targetId, p.receptorUrl, p.poseUrl, p.position, p.name, p.targetName]));
  useEffect(() => {
    const live = runtime.current; if (!live) return;
    const abort = new AbortController(); let stopped = false;
    setLoaded(0); setError('');
    for (const child of [...live.stations.children]) { live.stations.remove(child); disposeMolecularObject(child); }
    const pairs = latest.current.pairs;
    const cache = new Map<string, Promise<string>>();
    const text = (url: string) => {
      if (!cache.has(url)) cache.set(url, fetch(url, { signal: abort.signal }).then(r => { if (!r.ok) throw new Error(`Structure unavailable (${r.status})`); return r.text(); }));
      return cache.get(url)!;
    };
    let completed=0;
    pairs.forEach((pair, index) => {
      void Promise.all([text(pair.receptorUrl), text(pair.poseUrl)]).then(([receptor, ligand]) => {
        if (stopped) return;
        const complex = makeProteinComplex(receptor, ligand, proteins[index % proteins.length], accents[index % accents.length]);
        complex.position.fromArray(pair.position); complex.userData.pairId = pair.id;
        const geometry=complex.userData.molecularGeometry as MolecularGeometry;
        const labelY=geometry.minYWorld-.24;
        const title = label(`${String(index + 1).padStart(2, '0')}  ${pair.targetName}`, '#b2c3ce', 3.1); title.position.set(0,labelY,0); complex.add(title);
        const subtitle = label(pair.name, '#6e8899', 2.7); subtitle.position.set(0,labelY-.22,0); complex.add(subtitle);
        live.stations.add(complex); setLoaded(n => n + 1);completed++;if(completed===pairs.length)fitMolecularScene(live);
      }).catch(e => { if (!stopped && e.name !== 'AbortError') setError(`${pair.targetName}: ${e.message}. No substitute geometry shown.`); });
    });
    return () => { stopped = true; abort.abort(); };
  }, [pairKey]);

  return <div className="colony-habitat" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 560, overflow: 'hidden', background: '#080f18', borderRadius: 18 }}>
    <div ref={host} style={{ position: 'absolute', inset: 0 }} />
    <div style={{ position: 'absolute', top: 44, left: 16, pointerEvents: 'none', color: '#9bafbf', fontSize: 10, letterSpacing: '.17em', textTransform: 'uppercase' }}>Shared molecular habitat <span style={{ color: '#577081', marginLeft: 12 }}>{loaded}/{props.pairs.length} complexes</span></div>
    <div style={{position:'absolute',left:16,bottom:40,pointerEvents:'none',color:'#8daeb4',font:'9px monospace',background:'#081018b8',padding:'7px 9px',borderRadius:4}}><div>ORTHOGRAPHIC 3D · SHARED Å SCALE</div><div ref={scaleLine} style={{height:5,borderLeft:'1px solid #9cc9c9',borderRight:'1px solid #9cc9c9',borderBottom:'1px solid #9cc9c9',margin:'6px 0 4px',width:100}}/><span ref={scaleText}>50 Å (5 nm)</span><div style={{marginTop:5,color:'#68878e'}}>Fly avatars are not to molecular scale.</div></div>
    <button onClick={()=>{if(runtime.current)fitMolecularScene(runtime.current);}} style={{position:'absolute',top:39,right:16,zIndex:3,padding:'5px 8px',fontSize:9,color:'#9bafbf',background:'#0a1720',border:'1px solid #29404a'}}>Reset view</button>
    {error && <p role="status" style={{ position: 'absolute', top: 50, left: 24, right: 24, color: '#e5b3a6', fontSize: 12 }}>{error}</p>}
  </div>;
}
