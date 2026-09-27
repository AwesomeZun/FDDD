import * as T from 'three';
export const candidates=[
 {id:'onyx',number:'01',name:'ONYX',tag:'Natural / satin',description:'짧고 넓은 줄무늬 복부, 통통한 가슴과 적갈색 눈. 초파리의 기본형.',accent:'#76d9c2',finish:'Warm chitin · satin',shape:'자연스러운 초파리'},
 {id:'aero',number:'02',name:'MICA',tag:'Minimal / soft',description:'초파리의 짧고 단단한 비례를 유지하고 표면만 단순하게 정리.',accent:'#a1c4fb',finish:'Soft mineral · matte',shape:'단순한 곡면'},
 {id:'prism',number:'03',name:'PRISM',tag:'Faceted / precise',description:'넓은 복부와 둥근 날개를 절제된 면으로 표현한 초파리.',accent:'#e3b483',finish:'Bronze · faceted',shape:'낮은 다각형 조형'},
 {id:'veil',number:'04',name:'VEIL',tag:'Translucent / delicate',description:'초파리의 분절과 적갈색 눈이 반투명 외피 안에서도 읽히는 형태.',accent:'#b7a9e6',finish:'Amber shell · translucent',shape:'은은한 반투명 외피'},
 {id:'vector',number:'05',name:'VECTOR',tag:'Wireframe / structural',description:'통통한 가슴, 넓은 줄무늬 복부와 짧은 다리를 선으로 그린 초파리.',accent:'#8be2ec',finish:'Contour · structural',shape:'초파리의 와이어 윤곽'},
 {id:'ivory',number:'06',name:'IVORY',tag:'Sculptural / restrained',description:'짧고 둥근 초파리 형태를 따뜻한 세라믹과 갈색 띠로 표현.',accent:'#e8d4aa',finish:'Warm ceramic · matte',shape:'따뜻한 세라믹 조형'},
] as const;
export type FlyModel={root:T.Group;wings:T.Group[];materials:T.Material[];index:number};
function rod(a:T.Vector3,b:T.Vector3,r:number,material:T.Material,facets=6){const d=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(r*.62,r,d.length(),facets),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
function line(points:T.Vector3[],material:T.Material){return new T.Line(new T.BufferGeometry().setFromPoints(points),material);}
function ellipsoid(root:T.Group,p:number[],s:number[],material:T.Material,low=false){const m=new T.Mesh(low?new T.IcosahedronGeometry(1,1):new T.SphereGeometry(1,24,16),material);m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);root.add(m);return m;}
const ABDOMEN_LENGTH=.76;
const profile=(t:number)=>.36*Math.pow(Math.sin(Math.PI*(.17+.83*t)),.56);
function abdomenGeometry(start=0,end=1,offset=0,facets=32){const pts=Array.from({length:Math.max(4,Math.ceil((end-start)*40))+1},(_,i,)=>{const t=start+(end-start)*i/Math.max(4,Math.ceil((end-start)*40));return new T.Vector2(profile(t)+offset,t*ABDOMEN_LENGTH);});const geo=new T.LatheGeometry(pts,facets);geo.rotateX(-Math.PI/2);geo.scale(1,.82,1);return geo;}
/** Procedural Drosophila design studies, not taxonomic reconstructions. +Z is the head. */
export function makeCandidate(index:number):FlyModel{
 const root=new T.Group(),wings:T.Group[]=[],spec=candidates[index],wire=index===4,low=index===2,glass=index===3;
 const thoraxColors=[0x77503a,0x64716d,0x76583d,0x947453,0x4d777a,0xa59c88],abdomenColors=[0x79553b,0x718078,0x876445,0x9c8059,0x54858a,0xafa58e];
 const shell=new T.MeshPhysicalMaterial({color:thoraxColors[index],roughness:glass?.30:.68,metalness:low?.22:.06,transparent:glass,opacity:glass?.43:1,clearcoat:.12,side:T.DoubleSide,flatShading:low});
 const abdominal=new T.MeshPhysicalMaterial({color:abdomenColors[index],roughness:.72,metalness:.03,transparent:glass,opacity:glass?.48:1,flatShading:low});
 const band=new T.MeshStandardMaterial({color:index===5?0x706652:index===1?0x4b5d53:0x3d2d24,roughness:.85,metalness:0,transparent:glass,opacity:glass?.58:1,flatShading:low});
 const eye=new T.MeshStandardMaterial({color:index===5?0x813f2c:0x752e22,roughness:.83,metalness:0});
 const bone=new T.LineBasicMaterial({color:wire?spec.accent:0x706850,transparent:true,opacity:wire?.72:.55});
 const vein=new T.LineBasicMaterial({color:wire?spec.accent:0x8d9d97,transparent:true,opacity:wire?.63:.43});
 const wingmat=new T.MeshPhysicalMaterial({color:0xe0e4d7,transparent:true,opacity:glass?.28:.40,roughness:.36,iridescence:.22,iridescenceIOR:1.3,metalness:0,side:T.DoubleSide,depthWrite:false});
 const materials:T.Material[]=[shell,abdominal,band,eye,bone,vein,wingmat];
 const bodyWidth=index===1?.97:index===5?1.035:1;
 if(wire){
  // Complete rounded body contours, not a needle-like cage or exposed metallic spine.
  for(const [z,rx,ry]of [[.44,.17,.16],[.29,.30,.25],[.10,.335,.29],[-.10,.28,.23]] as number[][]){root.add(line(Array.from({length:33},(_,i)=>new T.Vector3(Math.cos(i/32*Math.PI*2)*rx,Math.sin(i/32*Math.PI*2)*ry+.04,z)),bone));}
  for(let k=0;k<8;k++){const angle=k/8*Math.PI*2;root.add(line([[.44,.17,.16],[.29,.30,.25],[.10,.335,.29],[-.10,.28,.23]].map(([z,rx,ry])=>new T.Vector3(Math.cos(angle)*rx,Math.sin(angle)*ry+.04,z)),bone));}
  for(let k=0;k<6;k++){const t=k/6,r=profile(t);const ring=line(Array.from({length:33},(_,i)=>new T.Vector3(Math.cos(i/32*Math.PI*2)*r,Math.sin(i/32*Math.PI*2)*r*.82,-.17-t*ABDOMEN_LENGTH)),bone);ring.name='abdominal-band';root.add(ring);}
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;root.add(line(Array.from({length:30},(_,i)=>{const t=i/29,r=profile(t);return new T.Vector3(Math.cos(a)*r,Math.sin(a)*r*.82,-.17-t*ABDOMEN_LENGTH);}),bone));}
  const head=ellipsoid(root,[0,.05,.51],[.265,.205,.22],new T.MeshBasicMaterial({color:spec.accent,wireframe:true,transparent:true,opacity:.28}));head.name='head';
 }else{
  const thorax=ellipsoid(root,[0,.04,.115],[.335*bodyWidth,.29,.34],shell,low);thorax.name='thorax';
  const abdomen=new T.Mesh(abdomenGeometry(0,1,0,low?10:32),abdominal);abdomen.position.z=-.17;abdomen.scale.x=bodyWidth;abdomen.name='abdomen';root.add(abdomen);
  // Subtle anterior tergite edges and a dark posterior male abdomen, not regular yellow/black bee bands.
  for(const [start,end] of [[.16,.195],[.37,.425],[.59,.665],[.77,.997]]){const stripe=new T.Mesh(abdomenGeometry(start,end,.004,low?10:32),band);stripe.position.z=-.17;stripe.scale.x=bodyWidth;stripe.name='abdominal-band';root.add(stripe);}
  const head=ellipsoid(root,[0,.05,.51],[.265,.205,.22],shell,low);head.name='head';
  if(glass){const inner=ellipsoid(root,[0,-.005,-.51],[.215,.165,.29],abdominal);inner.name='internal-soft-volume';}
  if(index===5){for(const side of [-1,1])ellipsoid(root,[side*.105,.23,.09],[.18,.08,.23],shell);}
  // A few tiny thoracic bristles, not long radial antennae.
  if(index===0||index===3)for(const side of [-1,1])for(let k=0;k<3;k++)root.add(line([new T.Vector3(side*.21,.24,.26-k*.15),new T.Vector3(side*.245,.31,.24-k*.15)],bone));
 }
 // Anatomically flush compound-eye lobes: brown/red, matte, never spherical cartoon eyes.
 for(const side of [-1,1]){const e=ellipsoid(root,[side*.211,.072,.548],[.083,.151,.137],eye,low);e.rotation.y=side*.12;e.name='compound-eye';}
 // Short paired mouth lobes under the face. There is no projecting piercing proboscis.
 const mouth=ellipsoid(root,[0,-.108,.692],[.052,.046,.035],band);mouth.name='short-mouthparts';
 // Compact, bent legs: tarsi stay close to the stout thorax, not mosquito-like spokes.
 for(const side of [-1,1])for(let k=0;k<3;k++){
  const z=.31-k*.20,leg=new T.Group();leg.name='leg';
  const a=new T.Vector3(side*.235,-.13,z),b=new T.Vector3(side*(.34+k*.012),-.25,z+.06-k*.045),c=new T.Vector3(side*(.46+k*.014),-.36,z+.13-k*.13),d=new T.Vector3(side*(.52+k*.009),-.37,z+.17-k*.155);
  if(wire)leg.add(line([a,b,c,d],bone));else leg.add(rod(a,b,.028,shell),rod(b,c,.019,band),rod(c,d,.011,band));root.add(leg);
 }
 for(const side of [-1,1]){
  // Small flagellomere plus short feathered arista, rather than long mosquito feelers.
  const flag=ellipsoid(root,[side*.078,.047,.724],[.027,.040,.025],band);flag.name='antenna';
  const aristaA=new T.Vector3(side*.078,.076,.73),aristaB=new T.Vector3(side*.139,.163,.768);root.add(line([aristaA,aristaB],bone));
  for(let j=1;j<=3;j++){const p=aristaA.clone().lerp(aristaB,j/4);root.add(line([p.clone().add(new T.Vector3(-side*.026,.013,.006)),p,p.clone().add(new T.Vector3(side*.027,-.012,.009))],bone));}
  // Halteres identify this as a dipteran without becoming decorative lights.
  const h=new T.Group();h.name='haltere';h.add(rod(new T.Vector3(side*.24,-.01,-.08),new T.Vector3(side*.385,.055,-.18),.012,band));ellipsoid(h,[side*.39,.058,-.185],[.043,.038,.047],abdominal);root.add(h);
  const hinge=new T.Group();hinge.name='wing';hinge.position.set(side*.245,.235,.20);root.add(hinge);
  const length=index===1?1.0:index===3?1.1:1.055,width=index===5?.88:.82;
  const shape=new T.Shape();shape.moveTo(0,0);
  // Broad rounded membrane, gently swept rearward. PRISM varies tessellation, not anatomy.
  shape.bezierCurveTo(length*.25,.09,length*.78,.055,length*.97,-width*.22);
  shape.bezierCurveTo(length*1.08,-width*.45,length*.90,-width*.80,length*.63,-width*.88);
  shape.bezierCurveTo(length*.36,-width*.91,length*.11,-width*.35,0,0);
  const geometry=new T.ShapeGeometry(shape,low?9:30);geometry.rotateX(Math.PI/2);
  if(!wire){const wing=new T.Mesh(geometry,wingmat);wing.scale.x=side;hinge.add(wing);}else geometry.dispose();
  const outline=shape.getPoints(low?18:48).map(p=>new T.Vector3(p.x*side,.002,p.y));hinge.add(line(outline,vein));
  // All vein coordinates share the membrane's NEGATIVE-Z convention.
  for(const [ratio,y]of [[.40,.29],[.66,.60],[.88,.43]])hinge.add(line([new T.Vector3(),new T.Vector3(side*length*ratio*.55,.005,-width*.14),new T.Vector3(side*length*ratio,.005,-width*y)],vein));
  hinge.add(line([new T.Vector3(side*length*.27,.006,-width*.20),new T.Vector3(side*length*.50,.006,-width*.34),new T.Vector3(side*length*.71,.006,-width*.60)],vein));
  hinge.rotation.y=side*.36;wings.push(hinge);
 }
 root.userData.candidate=index;
 root.userData.anatomy={family:'Drosophilidae-inspired',abdomenLength:ABDOMEN_LENGTH,thoraxWidth:.67*bodyWidth,headWidth:.53,maxLegLateral:.538,antennaProjection:.078,wingLength:index===1?1:index===3?1.1:1.055,wingWidth:index===5?.88:.82};
 return {root,wings,materials,index};
}
export function disposeTree(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points||o instanceof T.Sprite){if('geometry'in o)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{if('map'in m&&(m as T.MeshBasicMaterial).map)(m as T.MeshBasicMaterial).map!.dispose();m.dispose();});}
