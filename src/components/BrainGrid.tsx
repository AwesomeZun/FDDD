import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {CNS} from '../lib/cnsDataset.ts';
import type {ColonyFly,HabitatPair} from '../lib/colonyPolicy';
import {REGIONS,REGION_CSS,regionOfGroup,regionRates} from './brainRegions';

type Manifest={groups:string[];classes:Record<string,number>};
const DRAW_INTERVAL_MS=250; // 4 paints/s for all views; every computed step is still consumed (flash on tick change), only the paint cadence is capped.
// A cell is repainted only when its fly has a new computed step or its flash glow is still decaying, so idle cells cost nothing.

/**
 * Twenty live brain views drawn by ONE WebGL renderer (browsers cap WebGL contexts near 16).
 * Each cell is a DOM viewport; the shared canvas is scissored to that rectangle and draws the
 * cell's own fly frame: real fireState / membrane activity of that fly's CNS computation.
 */
export function BrainGrid({flies,pairs,selected,onSelect,names,count}:{flies:ColonyFly[];pairs:HabitatPair[];selected:number;onSelect:(i:number)=>void;names:string[];count:number}){
 const wrap=useRef<HTMLDivElement>(null),views=useRef<(HTMLDivElement|null)[]>([]),latest=useRef(flies);latest.current=flies;
 const [manifest,setManifest]=useState<Manifest|null>(null),[status,setStatus]=useState('Loading MaleCNS soma coordinates');
 useEffect(()=>{let disposed=false;fetch('/data/malecns/manifest.json').then(r=>r.json()).then(m=>{if(!disposed)setManifest({groups:m.groups,classes:m.classes});}).catch(()=>{});return()=>{disposed=true;};},[]);
 useEffect(()=>{
  const host=wrap.current!;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});}catch{setStatus('WebGL unavailable; circuit computation remains independent');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setScissorTest(true);renderer.autoClear=false;renderer.setClearColor(0x000000,0);
  const canvas=renderer.domElement;canvas.className='brain-grid-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.1,100),group=new THREE.Group();scene.add(group);
  let geometry:THREE.BufferGeometry|undefined,material:THREE.ShaderMaterial|undefined,disposed=false,raf=0,lastPaint=0;
  let region=new Uint8Array(),glows:Float32Array[]=[],lastTicks:number[]=[],indices:number[]=[];const glowActive:number[]=[],painted:boolean[]=[];let canvasPrimed=false;
  const abort=new AbortController();
  fetch('/data/malecns/display-points.json',{signal:abort.signal}).then(r=>r.json()).then(data=>{
   if(disposed)return;const points=data.points as {position:number[];sortedIndex:number;group:string}[];
   const bounds=[0,1,2].map(k=>{const v=points.map(p=>p.position[k]).sort((a,b)=>a-b);return [v[Math.floor(v.length*.005)],v[Math.floor(v.length*.995)]];});
   const scale=4.8/Math.max(...bounds.map(b=>b[1]-b[0]));const n=points.length;
   const positions=new Float32Array(n*3),colors=new Float32Array(n*3),strength=new Float32Array(n);region=new Uint8Array(n);
   points.forEach((p,i)=>{indices.push(p.sortedIndex);positions[i*3]=(p.position[0]-(bounds[0][1]+bounds[0][0])/2)*scale;positions[i*3+1]=-(p.position[1]-(bounds[1][1]+bounds[1][0])/2)*scale;positions[i*3+2]=(p.position[2]-(bounds[2][1]+bounds[2][0])/2)*scale;region[i]=regionOfGroup(p.group);});
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('strength',new THREE.BufferAttribute(strength,1).setUsage(THREE.DynamicDrawUsage));
   material=new THREE.ShaderMaterial({uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:'attribute vec3 color; attribute float strength; varying vec3 c; uniform float pixelRatio; void main(){c=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp((.55+strength*.7)*pixelRatio*6.0/-p.z,1.0,5.0);}',fragmentShader:'varying vec3 c;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;float a=pow(1.0-d*2.0,1.4);gl_FragColor=vec4(c,a*.85);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
   group.add(new THREE.Points(geometry,material));setStatus(`${CNS.displayCount.toLocaleString()} measured soma samples per view · ${CNS.neuronCount.toLocaleString()} neurons computed per fly`);
  }).catch(e=>{if(!disposed)setStatus('Coordinate display unavailable: '+String(e));});
  const paintCell=(i:number,frame:ColonyFly['frame'])=>{
   if(!geometry)return;const colors=geometry.getAttribute('color') as THREE.BufferAttribute,sizes=geometry.getAttribute('strength') as THREE.BufferAttribute,n=region.length;
   if(!glows[i])glows[i]=new Float32Array(n);const glow=glows[i],newTick=!!frame&&frame.tick!==lastTicks[i];
   if(!newTick&&!(glowActive[i]>0))return false;let maxGlow=0;
   for(let k=0;k<n;k++){const src=frame?.compactDisplay?k:indices[k];const a=Math.max(0,Math.min(1,frame?(frame.activity[src]||0):0));glow[k]*=.62;if(newTick&&frame?.fireState[src])glow[k]=1;if(glow[k]>maxGlow)maxGlow=glow[k];
    const fl=glow[k],base=REGIONS[region[k]].color,l=.10+.55*a;
    colors.setXYZ(k,base[0]*l*(1-fl)+fl*(.35+.65*base[0]),base[1]*l*(1-fl)+fl*(.35+.65*base[1]),base[2]*l*(1-fl)+fl*(.35+.65*base[2]));sizes.setX(k,.35+a*.45+fl*1.0);}
   if(frame)lastTicks[i]=frame.tick;glowActive[i]=maxGlow>.03?1:0;colors.needsUpdate=true;sizes.needsUpdate=true;return true;
  };
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);if(now-lastPaint<DRAW_INTERVAL_MS||document.hidden||!geometry||!material)return;lastPaint=now;
   const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);canvasPrimed=false;painted.length=0;}
   material.uniforms.pixelRatio.value=renderer.getPixelRatio();
   const hostRect=host.getBoundingClientRect();renderer.autoClear=false;if(!canvasPrimed){renderer.setScissor(0,0,w,h);renderer.setViewport(0,0,w,h);renderer.clear();canvasPrimed=true;}
   const flies=latest.current;
   for(let i=0;i<count;i++){const el=views.current[i];if(!el)continue;const r=el.getBoundingClientRect();if(r.bottom<hostRect.top||r.top>hostRect.bottom)continue;
    const x=r.left-hostRect.left,y=hostRect.bottom-r.bottom,vw=Math.max(1,r.width),vh=Math.max(1,r.height);
    if(!paintCell(i,flies[i]?.frame)&&painted[i])continue;painted[i]=true;
    camera.aspect=vw/vh;camera.updateProjectionMatrix();camera.position.set(3.9,2.6,5.6);camera.lookAt(0,0,0);
    group.rotation.y=Math.sin((flies[i]?.frame?.tick??0)*.002+i*.4)*.14;
    renderer.setViewport(x,y,vw,vh);renderer.setScissor(x,y,vw,vh);renderer.clear();renderer.render(scene,camera);}
  };
  raf=requestAnimationFrame(draw);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(raf);geometry?.dispose();material?.dispose();renderer.dispose();canvas.remove();};
 },[count]);
 const sizes=manifest?.classes??{},groupNames=manifest?.groups??[];
 const rates=useMemo(()=>Array.from({length:count},(_,i)=>regionRates(flies[i]?.frame?.groupSpikeCounts,groupNames,sizes)),[flies,groupNames,sizes,count]);
 return <section className="fly-grid brain-grid" aria-label="All fly brains, live computed state">
  <div className="fly-grid-head"><span>ALL {count} BRAINS · LIVE COMPUTED SPIKE STATE</span><small>Each view is the real fire state of that fly's own CNS at its latest computed step, not an animation. Population rhythm is a shared LIF dynamic (see docs/brain-reward-loop.md). Click a cell to select the fly.</small></div>
  <div className="brain-grid-legend">{REGIONS.map((r,k)=><span key={r.id}><i style={{background:REGION_CSS[k]}}/>{r.label}</span>)}<small>fired = bright · sub-threshold membrane = dim · bars = spikes / neurons per region this step</small></div>
  <div className="brain-grid-wrap" ref={wrap}>
   <div className="brain-grid-cells">{Array.from({length:count},(_,i)=>{const fly=flies[i],f=fly?.frame,dest=fly?.destination??-1,pref=dest>=0?(fly?.learned[dest]??0):0;
    return <button key={i} className={'fly-cell brain-cell i'+i+(i===selected?' selected':'')} aria-pressed={i===selected} onClick={()=>onSelect(i)} title={(names[i]??'FLY')+' '+String(i+1).padStart(2,'0')+(f?' · step '+f.tick:'')}>
     <span className="fly-cell-name"><i/>{names[i]??'FLY'} <em>{String(i+1).padStart(2,'0')}</em><span className="fly-cell-step">{f?'STEP '+f.tick:'INIT'}</span></span>
     <div className="brain-cell-view" ref={el=>{views.current[i]=el;}}/>
     <span className="brain-cell-rates">{rates[i].map((v,k)=><i key={k} title={REGIONS[k].label+': '+(v*100).toFixed(2)+'% of region neurons fired'} style={{background:REGION_CSS[k],width:Math.min(100,v/.12*100)+'%'}}/>)}</span>
     <b>{f?f.spikeCount.toLocaleString():'—'}<small> spikes / step</small></b>
     <span className="fly-cell-dest">{dest>=0?(pairs[dest]?.name??'…'):'…'}</span>
     <span className="fly-cell-bar" title="learned preference for current destination"><i style={{width:(pref*100).toFixed(0)+'%'}}/></span>
    </button>;})}</div>
  </div>
  <div className="brain-grid-foot">{status}</div>
 </section>;
}
