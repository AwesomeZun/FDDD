import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {FlightFrame} from '../lib/flight';
type SceneFrame=Pick<FlightFrame,'time'|'position'|'velocity'|'heading'>;
export function LabScene({frame,candidate,target,running,frames,selectedFly=0}:{frame:SceneFrame;candidate:number;target:number;running:boolean;frames?:SceneFrame[];selectedFly?:number}) {
 const host=useRef<HTMLDivElement>(null), live=useRef({frame,candidate,target,running,frames,selectedFly});live.current={frame,candidate,target,running,frames,selectedFly};const [error,setError]=useState('');
 useEffect(()=>{const el=host.current!;let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true})}catch{setError('3D unavailable. Flight telemetry remains available.');return}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.domElement.style.width="100%";renderer.domElement.style.height="100%";el.appendChild(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(39,1,.1,100);camera.position.set(7,5.3,10);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.1,0);controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=19;controls.maxPolarAngle=Math.PI*.6;
 scene.add(new T.HemisphereLight(0xe6f2ff,0x17202e,3));const key=new T.DirectionalLight(0xffe1ba,4);key.position.set(-3,6,4);scene.add(key);const rim=new T.PointLight(0x83dce9,65,15);rim.position.set(1,4,-3);scene.add(rim);

 // Original open molecular field: suspended, non-repeating strands, no ring or platform.
 const field=new T.Group();scene.add(field);for(let strand=0;strand<4;strand++){const pts:T.Vector3[]=[];for(let i=0;i<80;i++){const t=i/79;pts.push(new T.Vector3(-5+t*10,-.65+strand*.18+Math.sin(t*4+strand)*.22,-3.3+strand*.3+Math.sin(t*7+strand)*.7))}const g=new T.BufferGeometry().setFromPoints(pts);field.add(new T.Line(g,new T.LineBasicMaterial({color:strand%2?0xb49a79:0x789fac,transparent:true,opacity:.12,depthWrite:false})))}
 const dust:number[]=[];for(let i=0;i<200;i++){const n=Math.sin(i*127.1)*43758.5453,f=n-Math.floor(n),q=Math.sin(i*31.7)*9631.73,g=q-Math.floor(q);dust.push((f-.5)*13,(g-.5)*8,(Math.sin(i*2.4))*5-3)}scene.add(new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(dust,3)),new T.PointsMaterial({color:0xa0b9c9,size:.018,transparent:true,opacity:.3})));

 // Original rounded avatars. No anatomical meshes or Flybody assets are loaded.
 const palette=[0xe8b87f,0x89cfd5,0xb8a9dc,0xa9c5a1];
 const offsets=[new T.Vector3(-1.2,0,0),new T.Vector3(1.2,0,0),new T.Vector3(0,0,-1.2),new T.Vector3(0,0,1.2)];
 const sphere=new T.SphereGeometry(1,32,24);
 const eyeMat=new T.MeshPhysicalMaterial({color:0x182634,roughness:.12,clearcoat:1,metalness:.1});
 const shineMat=new T.MeshBasicMaterial({color:0xfffcf2});
 const wingMat=new T.MeshPhysicalMaterial({color:0xe7f7ff,transparent:true,opacity:.48,roughness:.26,metalness:.08,side:T.DoubleSide,depthWrite:false,clearcoat:1});
 const labelTextures:T.CanvasTexture[]=[];
 const avatars=palette.map((color,index)=>{
  const root=new T.Group(),body=new T.Group();root.add(body);scene.add(root);
  const mat=new T.MeshPhysicalMaterial({color,roughness:.38,clearcoat:.5,metalness:.03});
  const pale=new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color(0xfff4db),.38),roughness:.5});
  const add=(parent:T.Object3D,material:T.Material,pos:number[],scale:number[])=>{const mesh=new T.Mesh(sphere,material);mesh.position.fromArray(pos);mesh.scale.fromArray(scale);parent.add(mesh);return mesh};
  // A bean thorax and softly tapered abdomen, heading points along +X.
  add(body,mat,[-.12,0,0],[.25,.19,.18]);
  add(body,pale,[.07,.03,0],[.20,.19,.18]);
  add(body,mat,[.24,.07,0],[.18,.18,.19]);
  for(const side of [-1,1]){
   add(body,eyeMat,[.32,.11,side*.13],[.102,.117,.071]);
   add(body,shineMat,[.372,.156,side*.165],[.025,.031,.014]);
   add(body,shineMat,[.384,.105,side*.159],[.009,.012,.007]);
   // Six tiny tucked feet read as rounded mitts, never bristles or wires.
   for(let j=0;j<3;j++)add(body,mat,[-.19+j*.15,-.15,side*.13],[.063,.043,.035]);
  }
  const antennae=new T.Group();body.add(antennae);
  for(const side of [-1,1]){const a=add(antennae,pale,[.27,.263,side*.075],[.023,.072,.024]);a.rotation.x=side*.28;add(antennae,mat,[.27,.32,side*.092],[.036,.034,.035])}
  const wings:T.Group[]=[];
  for(const side of [-1,1]){
   const pivot=new T.Group();pivot.position.set(-.025,.145,side*.08);body.add(pivot);
   const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.12,.07,-.46,.16,-.46,.32);shape.bezierCurveTo(-.45,.52,-.12,.47,0,0);
   const mesh=new T.Mesh(new T.ShapeGeometry(shape,28),wingMat);mesh.rotation.x=side*Math.PI/2;pivot.add(mesh);pivot.userData.side=side;wings.push(pivot);
  }
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');
  let label:T.Sprite|undefined;if(ctx){ctx.font='500 30px system-ui';ctx.textAlign='center';ctx.fillStyle='#cbd8e1';ctx.fillText(String(index+1).padStart(2,'0'),64,42);const tex=new T.CanvasTexture(canvas);labelTextures.push(tex);label=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity:.7}));label.scale.set(.38,.19,1);label.position.set(0,.58,0);root.add(label)}
  const positions=new Float32Array(180*3),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setDrawRange(0,0);
  const trail=new T.Line(geometry,new T.LineBasicMaterial({color,transparent:true,opacity:.45,depthWrite:false}));trail.frustumCulled=false;scene.add(trail);
  return {root,body,wings,antennae,label,trail,geometry,positions,history:[] as T.Vector3[],lastTime:-1,phase:0};
 });
 // A compact folded chain with loops and helical domains, not a DNA double helix.
 const protein=new T.Group();protein.position.set(0,1.3,0);scene.add(protein);const points:T.Vector3[]=[];for(let i=0;i<300;i++){const t=i/299*Math.PI*6;points.push(new T.Vector3(Math.sin(t)*.64+Math.sin(t*3.3)*.23,Math.cos(t*.7)*.65+Math.cos(t*3.3)*.18,Math.sin(t*1.7)*.52+Math.sin(t*3.3)*.15))}
 const curve=new T.CatmullRomCurve3(points);protein.add(new T.Mesh(new T.TubeGeometry(curve,650,.043,7,false),new T.MeshPhysicalMaterial({color:0x8dccd5,emissive:0x234b57,emissiveIntensity:.4,metalness:.35,roughness:.28,transparent:true,opacity:.75})));
 const atomGeo=new T.SphereGeometry(.023,6,5),atomMat=new T.MeshBasicMaterial({color:0xc5e7ed,transparent:true,opacity:.6});points.filter((_,i)=>i%3===0).forEach(p=>{const a=new T.Mesh(atomGeo,atomMat);a.position.copy(p);protein.add(a)});
 const ligand=new T.Group();scene.add(ligand);const ligandMat=new T.MeshStandardMaterial({color:0xe8b77d,emissive:0xb47835,emissiveIntensity:1.1,metalness:.3,roughness:.22});const ligandPts:T.Vector3[]=[];for(let i=0;i<7;i++){const a=i/6*Math.PI*2,p=new T.Vector3(Math.cos(a)*.19,Math.sin(a)*.19,Math.sin(a*2)*.06);ligandPts.push(p);if(i<6){const atom=new T.Mesh(new T.SphereGeometry(.047,12,8),ligandMat);atom.position.copy(p);ligand.add(atom)}}ligand.add(new T.Line(new T.BufferGeometry().setFromPoints(ligandPts),new T.LineBasicMaterial({color:0xeac38c})));ligand.add(new T.PointLight(0xe6af70,2,2));

 const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(el);resize();const reduced=matchMedia('(prefers-reduced-motion: reduce)');let raf=0,last=performance.now(),phase=0;const aim=new T.Vector3();
 const render=(now:number)=>{
  const dt=Math.min(.05,(now-last)/1000);last=now;const v=live.current,moving=v.running&&!reduced.matches;
  if(moving)phase+=dt;
  const incoming=v.frames?.length?v.frames.slice(0,4):[v.frame];
  const bounds=new T.Box3().setFromCenterAndSize(protein.position,new T.Vector3(2.6,2.6,2.6));
  avatars.forEach((a,i)=>{
   const f=incoming[i];a.root.visible=!!f;a.trail.visible=!!f&&!reduced.matches;if(!f)return;
   aim.fromArray(f.position).multiplyScalar(.65);if(v.frames?.length)aim.add(offsets[i]);
   // Display transform only: every avatar and trail uses its own controller position.
   a.root.position.copy(aim);a.root.rotation.y=-f.heading;
   const speed=Math.hypot(...f.velocity);
   a.body.rotation.z=moving?T.MathUtils.clamp(f.velocity[1]*.06,-.12,.12):0;
   if(moving)a.phase+=dt;
   a.wings.forEach(w=>{w.rotation.x=moving?w.userData.side*(.18+Math.sin(a.phase*48+i*.7)*Math.min(.38,speed*.6)):.18*w.userData.side});
   // Antenna animation is purely decorative and pauses with the simulation.
   a.antennae.rotation.z=moving?Math.sin(a.phase*2+i)*.035:0;
   if(f.time<a.lastTime){a.history.length=0;a.geometry.setDrawRange(0,0)}
   if(f.time!==a.lastTime){if(!a.history.length||a.history[a.history.length-1].distanceToSquared(aim)>1e-7){a.history.push(aim.clone());if(a.history.length>180)a.history.shift();a.history.forEach((p,j)=>p.toArray(a.positions,j*3));a.geometry.getAttribute('position').needsUpdate=true;a.geometry.setDrawRange(0,a.history.length)}a.lastTime=f.time}
   if(a.label)a.label.material.opacity=i===v.selectedFly?1:.55;
   bounds.expandByPoint(aim.clone().addScalar(.7));bounds.expandByPoint(aim.clone().addScalar(-.7));
  });
  if(moving){protein.rotation.y=phase*.1+v.target*.4;ligand.rotation.z=phase*.35}
  const approach=.85+.65*(.5+.5*Math.cos(phase*.45));ligand.position.set(protein.position.x+approach,protein.position.y+.12+v.candidate*.025,protein.position.z+.4);
  bounds.expandByPoint(ligand.position.clone().addScalar(.3));
  // Fit the enclosing sphere in both axes, including narrow phone canvases.
  const center=bounds.getCenter(new T.Vector3()),radius=bounds.getSize(new T.Vector3()).length()*.5;
  const halfFov=Math.min(T.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect));
  const fit=radius/Math.sin(halfFov)*1.06;
  const direction=camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);controls.minDistance=fit;controls.maxDistance=Math.max(30,fit*2);camera.far=Math.max(100,fit*4);camera.position.copy(center).addScaledVector(direction,Math.max(fit,camera.position.distanceTo(center)));camera.updateProjectionMatrix();
  controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render)
 };raf=requestAnimationFrame(render);
 return()=>{labelTextures.forEach(t=>t.dispose());cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points||o instanceof T.Sprite){if(!(o instanceof T.Sprite))o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()};
 },[]);
 return <div className="lab-canvas" ref={host} style={{width:"100%",height:"100%"}} aria-label="Open molecular field with stylized fruit-fly avatars. Each avatar follows its own circuit flight controller; wings are illustrative. Drag to orbit.">{error&&<div className="fallback" role="status">{error}</div>}</div>
}
