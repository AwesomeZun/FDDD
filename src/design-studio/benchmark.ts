import {flightPose} from './flightPose.ts';
import * as T from 'three';
import {candidates,makeCandidate,disposeTree,type FlyModel} from './models.ts';

export type CandidateBenchmark={
 id:string;name:string;drawCalls:number;triangles:number;lines:number;points:number;
 /** Unique allocated geometry position entries; not the number of transformed vertices per frame. */
 vertices:number;geometries:number;
 /** Synchronous render + GPU-completion wall time, not isolated GPU time or production FPS. */
 medianMs:number;p25Ms:number;p75Ms:number;minMs:number;maxMs:number;roundMediansMs:number[];
};
export type BenchmarkReport={
 method:'render-plus-gl-finish';instances:number;resolution:[number,number];pixelRatio:1;msaaSamples:number;
 rounds:number;framesPerRound:number;warmupFramesPerCandidate:number;measuredFramesPerCandidate:number;
 results:CandidateBenchmark[];fastestId:string;practicalTieIds:string[];
 confidence:'clear'|'close';startedAt:string;completedAt:string;caveats:string[];
};
export type BenchmarkModelSpec={id:string;name:string;create:()=>FlyModel};
export type BenchmarkOptions={/** Simultaneous copies of each candidate; clones share geometry/materials but are separate objects, so draw calls scale. */instances?:number;models?:BenchmarkModelSpec[];signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void};
export function percentile(values:number[],q:number){
 if(!values.length)throw new Error('Empty benchmark sample');
 const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*q,lo=Math.floor(position),fraction=position-lo;
 return sorted[lo]*(1-fraction)+sorted[Math.min(lo+1,sorted.length-1)]*fraction;
}
const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function geometryCounts(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>();
 root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points)geometries.add(o.geometry);});
 return {vertices:[...geometries].reduce((sum,g)=>sum+(g.getAttribute('position')?.count??0),0),geometries:geometries.size};
}
type Flock={root:T.Group;members:{root:T.Object3D;wings:T.Object3D[];offset:[number,number,number];phase:number}[]};
function makeFlock(model:FlyModel,instances:number):Flock{const root=new T.Group();const members:Flock['members']=[];const cols=Math.ceil(Math.sqrt(instances)),spacing=1.6;for(let n=0;n<instances;n++){const copy=n===0?model.root:model.root.clone(true);const wings:T.Object3D[]=[];copy.traverse(o=>{if(o.name==='wing')wings.push(o);});const holder=new T.Group();holder.add(copy);root.add(holder);const col=n%cols,row=Math.floor(n/cols);members.push({root:copy,wings,offset:[(col-(cols-1)/2)*spacing,0,(row-(Math.ceil(instances/cols)-1)/2)*spacing],phase:n*.37});}return {root,members};}
function poseFlock(flock:Flock,phase:number){for(const m of flock.members){const p=flightPose(phase+m.phase);m.root.position.set(m.offset[0]+p.position[0],m.offset[1]+p.position[1],m.offset[2]+p.position[2]);m.root.rotation.set(p.pitch,p.yaw,p.roll);m.wings.forEach((wing,index)=>{wing.rotation.z=(index===0?-1:1)*(.07+Math.sin((phase+m.phase)*48)*.55);});}}
function pose(model:FlyModel,phase:number){
 const p=flightPose(phase);model.root.position.fromArray(p.position);model.root.rotation.set(p.pitch,p.yaw,p.roll);
 model.wings.forEach((wing,index)=>{wing.rotation.z=(index===0?-1:1)*(.07+Math.sin(phase*48)*.55);});
}
/**
 * Actual WebGL microbenchmark, invoked by the user-facing studio. No network requests,
 * saved files, downloads, CNS computation, labels, environment or animation timer are started.
 * One 512px render target, one renderer, identical lighting/camera and motion phases.
 * The result measures CPU scene submission plus synchronous GPU completion with gl.finish().
 * It deliberately does NOT estimate main-application FPS or claim isolated GPU timings.
 */
export async function benchmarkCandidates(options:BenchmarkOptions={}):Promise<BenchmarkReport>{
 if(typeof document==='undefined')throw new Error('Run this benchmark in a WebGL browser.');
 if(document.hidden)throw new Error('Keep the design page in the foreground while measuring.');
 const specs=options.models??candidates.map((c,i)=>({id:c.id,name:c.name,create:()=>makeCandidate(i)}));if(!specs.length)throw new Error('No benchmark models');
 const instances=Math.max(1,Math.floor(options.instances??1));
 const startedAt=new Date().toISOString(),size=512,rounds=12,framesPerRound=8,warmup=24;
 const models:FlyModel[]=[],scene=new T.Scene();let renderer:T.WebGLRenderer|undefined,target:T.WebGLRenderTarget|undefined;
 const check=()=>{if(options.signal?.aborted)throw new DOMException('Benchmark cancelled','AbortError');if(document.hidden)throw new Error('Measurement stopped because the page moved into the background. Run it again in the foreground.');if(renderer?.getContext().isContextLost())throw new Error('WebGL context lost during measurement.');};
 try{
  renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(1);renderer.setSize(size,size,false);renderer.setClearColor(0x070e13);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.cssText='position:fixed;left:-1024px;top:0;width:512px;height:512px;pointer-events:none;';
  document.body.appendChild(renderer.domElement);
  const gl=renderer.getContext(),msaaSamples='MAX_SAMPLES' in gl?Math.min(4,Number(gl.getParameter(gl.MAX_SAMPLES))||0):0;
  // Explicit offscreen framebuffer avoids presentation/visibility-dependent swap timing.
  target=new T.WebGLRenderTarget(size,size,{depthBuffer:true,stencilBuffer:false});target.samples=msaaSamples;
  renderer.setRenderTarget(target);
  const camera=new T.PerspectiveCamera(38,1,.05,160);const span=Math.ceil(Math.sqrt(instances))*1.6;if(instances===1)camera.position.set(3.2,2.7,4.8);else camera.position.set(span*.35,span*.9,span*1.15);camera.lookAt(0,0,0);
  scene.add(new T.HemisphereLight(0xd9edf2,0x202d36,2.4));
  for(const [color,intensity,position] of [[0xf4eee3,4.2,[4,8,5]],[0x83bed3,3.5,[-7,4,-4]],[0xbfc0e4,1.8,[6,1,-2]]] as [number,number,[number,number,number]][]){const light=new T.DirectionalLight(color,intensity);light.position.fromArray(position);scene.add(light);}
  const flocks:Flock[]=[];specs.forEach(spec=>{const m=spec.create();const flock=makeFlock(m,instances);flock.root.visible=false;scene.add(flock.root);models.push(m);flocks.push(flock);});
  const stats=models.map(m=>geometryCounts(m.root));
  const timings=models.map(()=>[] as number[]),roundTimings=models.map(()=>[] as number[]);
  const counts=models.map(()=>({drawCalls:0,triangles:0,lines:0,points:0}));
  // Compile every candidate and exercise its materials before any timed samples.
  for(let i=0;i<models.length;i++){
   check();flocks[i].root.visible=true;
   await renderer.compileAsync(scene,camera);
   for(let n=0;n<warmup;n++){poseFlock(flocks[i],n*.05);renderer.render(scene,camera);}
   gl.finish();flocks[i].root.visible=false;await nextFrame();
  }
  const total=rounds*models.length;let completed=0;options.onProgress?.(completed,total);
  // Every model appears once in each position of the measurement order per six-round cycle.
  for(let round=0;round<rounds;round++){
   for(let slot=0;slot<models.length;slot++){
    check();const index=(slot+round)%models.length,flock=flocks[index],batch:number[]=[];
    flock.root.visible=true;
    // An untimed settling frame removes material-switch and old GPU-queue carryover.
    poseFlock(flock,round*.4);renderer.render(scene,camera);gl.finish();
    for(let n=0;n<framesPerRound;n++){
     poseFlock(flock,round*.4+n*.05);
     renderer.info.reset();
     const before=performance.now();renderer.render(scene,camera);gl.finish();const elapsed=performance.now()-before;
     if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('Invalid timing sample.');
     batch.push(elapsed);timings[index].push(elapsed);
     const r=renderer.info.render;counts[index]={drawCalls:r.calls,triangles:r.triangles,lines:r.lines,points:r.points};
    }
    roundTimings[index].push(percentile(batch,.5));flock.root.visible=false;
    options.onProgress?.(++completed,total);await nextFrame();
   }
  }
  const results:CandidateBenchmark[]=specs.map((c,i)=>({id:c.id,name:c.name,...counts[i],...stats[i],medianMs:percentile(roundTimings[i],.5),p25Ms:percentile(roundTimings[i],.25),p75Ms:percentile(roundTimings[i],.75),minMs:Math.min(...timings[i]),maxMs:Math.max(...timings[i]),roundMediansMs:roundTimings[i]}));
  const ranked=[...results].sort((a,b)=>a.medianMs-b.medianMs),best=ranked[0];
  const practicalTieIds=ranked.filter(r=>r.medianMs-best.medianMs<=Math.max(.05,best.medianMs*.10)||(r.p25Ms<=best.p75Ms&&r.p75Ms>=best.p25Ms)).map(r=>r.id);
  return {method:'render-plus-gl-finish',instances,resolution:[size,size],pixelRatio:1,msaaSamples,rounds,framesPerRound,warmupFramesPerCandidate:warmup,measuredFramesPerCandidate:rounds*framesPerRound,results,fastestId:best.id,practicalTieIds,confidence:practicalTieIds.length===1?'clear':'close',startedAt,completedAt:new Date().toISOString(),caveats:[
   'Times include JavaScript/renderer submission and blocking GPU completion, not isolated GPU time. They are NOT application FPS.',
   '512×512 offscreen render target; one candidate at a time ('+instances+' simultaneous copies, separate objects sharing geometry); identical camera, lighting and flight phases. Background, labels and CNS simulation are excluded.',
   'Shader compilation and settling frames are excluded. Twelve counterbalanced rounds with eight measured frames each; median of round medians.',
   'Offscreen rendering excludes presentation/compositing and may differ from the visible canvas tone-mapping path.',
   'Other tabs, CNS workers, browser scheduling, thermal state and hardware affect timings. Pause other workloads for a cleaner rerun.',
   'Practical ties use a 10% or 0.05ms margin and overlapping interquartile ranges; this is a heuristic, not a statistical significance test.',
   'Draw calls and rendered primitive counts are actual renderer.info values, including material passes. Vertex count is unique allocated position entries, not per-frame GPU invocations.'
  ]};
 }finally{
  models.forEach(m=>disposeTree(m.root));scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line)o.geometry.dispose();});target?.dispose();if(renderer){renderer.setRenderTarget(null);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 }
}
