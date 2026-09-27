import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeCandidate,type FlyModel} from './models.ts';

export const prismVariants=[
 {id:'prism-original',number:'01',name:'PRISM ORIGINAL',tag:'Original / unbatched',description:'현재 PRISM 그대로. 세 단계의 기준 모델입니다.',accent:'#e3b483',finish:'Bronze · original',shape:'현재형 · 원본 보존'},
 {id:'prism-low',number:'02',name:'PRISM LOW',tag:'Low poly / batched',description:'초파리 체형과 디테일을 유지하며 작은 부품의 면 수와 그리기 호출을 줄였습니다.',accent:'#9cccb3',finish:'Bronze · same materials',shape:'저폴리 · 정적 메시 병합'},
 {id:'prism-min',number:'03',name:'PRISM MIN',tag:'Minimum / batched',description:'더 각진 최소형. 붉은 눈·짧은 다리·넓은 날개는 남겨 실루엣 손실을 비교합니다.',accent:'#a7b9e3',finish:'Bronze · same materials',shape:'최소형 · 강한 단순화'},
 {id:'prism-low-3',number:'04',name:'PRISM LOW-3',tag:'Low poly / 3 draw calls',description:'LOW 기하 구조를 정점 색상 한 재질로 굽고 선을 모두 제거했습니다. 몸통 1회 + 날개 2회.',accent:'#d7c48a',finish:'Vertex color · single pass wings',shape:'저폴리 · 호출 3회'},
 {id:'prism-min-3',number:'05',name:'PRISM MIN-3',tag:'Minimum / 3 draw calls',description:'MIN 기하 구조를 정점 색상 한 재질로 굽고 선을 모두 제거했습니다. 몸통 1회 + 날개 2회.',accent:'#c9a98a',finish:'Vertex color · single pass wings',shape:'최소형 · 호출 3회'},
] as const;
export type PrismLevel=0|1|2|3|4;
const bands=[[.16,.195],[.37,.425],[.59,.665],[.77,.997]] as const;
const profile=(t:number)=>.36*Math.pow(Math.sin(Math.PI*(.17+.83*t)),.56);
function abdomen(start:number,end:number,offset:number,radial:number,segments:number){
 const points=Array.from({length:segments+1},(_,i)=>{const t=start+(end-start)*i/segments;return new T.Vector2(profile(t)+offset,t*.76);});
 const g=new T.LatheGeometry(points,radial);g.rotateX(-Math.PI/2);g.scale(1,.82,1);return g;
}
function descendantsOf(node:T.Object3D,parent:T.Object3D){for(let p:T.Object3D|null=node;p;p=p.parent)if(p===parent)return true;return false;}
type SourceRange={name:string;parentName:string;vertexStart:number;vertexCount:number};
/** Merge nonmoving opaque parts without changing their materials or joining disconnected lines. */
function batchBody(root:T.Group,wings:T.Group[]){
 root.updateMatrixWorld(true);
 const meshGroups=new Map<T.Material,{geometries:T.BufferGeometry[];sources:SourceRange[];count:number}>();
 const lineGroups=new Map<T.Material,{positions:number[];sources:SourceRange[]}>();
 const removed:T.Object3D[]=[],markers:T.Object3D[]=[];
 root.traverse(obj=>{
  if(wings.some(w=>descendantsOf(obj,w)))return;
  if(obj instanceof T.Mesh){
   if(Array.isArray(obj.material)||obj.material.transparent)throw new Error('Only opaque single-material body meshes may be batched');
   let g=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();g.applyMatrix4(obj.matrixWorld);
   if(!g.getAttribute('normal'))g.computeVertexNormals();
   for(const attribute of Object.keys(g.attributes))if(attribute!=='position'&&attribute!=='normal')g.deleteAttribute(attribute);
   let group=meshGroups.get(obj.material);if(!group){group={geometries:[],sources:[],count:0};meshGroups.set(obj.material,group);}
   const count=g.getAttribute('position').count;group.sources.push({name:obj.name,parentName:obj.parent?.name??'',vertexStart:group.count,vertexCount:count});group.count+=count;group.geometries.push(g);
   if(obj.name){const marker=new T.Object3D();marker.name=obj.name;marker.matrix.copy(obj.matrixWorld);marker.matrixAutoUpdate=false;marker.userData={batchedGeometryMarker:true,materialUUID:obj.material.uuid,vertexStart:group.count-count,vertexCount:count};markers.push(marker);}
   removed.push(obj);
  }else if(obj instanceof T.Line){
   if(Array.isArray(obj.material))throw new Error('Single-material line required');
   let group=lineGroups.get(obj.material);if(!group){group={positions:[],sources:[]};lineGroups.set(obj.material,group);}
   const start=group.positions.length/3;appendSegments(obj,root,group.positions);
   group.sources.push({name:obj.name,parentName:obj.parent?.name??'',vertexStart:start,vertexCount:group.positions.length/3-start});removed.push(obj);
  }
 });
 for(const obj of removed){obj.removeFromParent();(obj as T.Mesh|T.Line).geometry.dispose();}
 for(const marker of markers)root.add(marker);
 const manifest:Record<string,unknown>[]=[];
 for(const [material,group]of meshGroups){const merged=mergeGeometries(group.geometries,false);if(!merged)throw new Error('Could not merge body geometry');group.geometries.forEach(g=>g.dispose());merged.computeBoundingBox();merged.computeBoundingSphere();const mesh=new T.Mesh(merged,material);mesh.name='body-material-batch';mesh.userData.sourceParts=group.sources;root.add(mesh);manifest.push({kind:'mesh',materialUUID:material.uuid,sources:group.sources});}
 for(const [material,group]of lineGroups){const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(group.positions,3));const lines=new T.LineSegments(geometry,material);lines.name='body-line-batch';lines.userData.sourceParts=group.sources;root.add(lines);manifest.push({kind:'line-segments',materialUUID:material.uuid,sources:group.sources});}
 root.userData.batchingManifest=manifest;
}
function appendSegments(line:T.Line,space:T.Object3D,out:number[]){
 const matrix=new T.Matrix4().copy(space.matrixWorld).invert().multiply(line.matrixWorld),positions=line.geometry.getAttribute('position'),index=line.geometry.index;
 const count=index?.count??positions.count,stride=line instanceof T.LineSegments?2:1;
 const a=new T.Vector3(),b=new T.Vector3();
 for(let i=0;i<count-1;i+=stride){a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);out.push(a.x,a.y,a.z,b.x,b.y,b.z);}
}
function batchWingLines(wing:T.Group){
 wing.updateWorldMatrix(true,true);const groups=new Map<T.Material,number[]>(),old:T.Line[]=[];
 wing.traverse(o=>{if(!(o instanceof T.Line))return;if(Array.isArray(o.material))throw new Error('Single-material wing line required');let points=groups.get(o.material);if(!points){points=[];groups.set(o.material,points);}appendSegments(o,wing,points);old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 for(const [material,positions]of groups){const line=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)),material);line.name='wing-outline-and-veins';wing.add(line);}
}
/** Bake each part's material color into a vertex color attribute, merge every nonmoving part into ONE mesh, drop all lines. */
function batchBodyVertexColor(root:T.Group,wings:T.Group[]){
 root.updateMatrixWorld(true);
 const geometries:T.BufferGeometry[]=[],sources:(SourceRange&{color:number})[]=[],removed:T.Object3D[]=[];let count=0;
 root.traverse(obj=>{
  if(wings.some(w=>descendantsOf(obj,w)))return;
  if(obj instanceof T.Mesh){
   if(Array.isArray(obj.material)||obj.material.transparent)throw new Error('Only opaque single-material body meshes may be batched');
   const material=obj.material as T.MeshStandardMaterial;if(!material.color)throw new Error('Body material must have a color to bake');
   const g=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();g.applyMatrix4(obj.matrixWorld);
   if(!g.getAttribute('normal'))g.computeVertexNormals();
   for(const attribute of Object.keys(g.attributes))if(attribute!=='position'&&attribute!=='normal')g.deleteAttribute(attribute);
   const n=g.getAttribute('position').count,colors=new Float32Array(n*3);const c=material.color;
   for(let i=0;i<n;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
   g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   sources.push({name:obj.name,parentName:obj.parent?.name??'',vertexStart:count,vertexCount:n,color:c.getHex()});count+=n;geometries.push(g);removed.push(obj);
  }else if(obj instanceof T.Line)removed.push(obj);
 });
 for(const obj of removed){obj.removeFromParent();(obj as T.Mesh|T.Line).geometry.dispose();}
 const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Could not merge vertex-colored body geometry');geometries.forEach(g=>g.dispose());
 merged.computeBoundingBox();merged.computeBoundingSphere();
 const material=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.7,metalness:.1});
 const mesh=new T.Mesh(merged,material);mesh.name='body-vertex-color-batch';mesh.userData.sourceParts=sources;root.add(mesh);
 root.userData.batchingManifest=[{kind:'mesh-vertex-color',materialUUID:material.uuid,sources}];
 return material;
}
function singlePassWings(wings:T.Group[]){
 // Same membrane tint/opacity as the original wing material, but rendered in ONE pass and without outline/vein lines.
 const material=new T.MeshStandardMaterial({color:0xe0e4d7,transparent:true,opacity:.40,roughness:.36,metalness:0,side:T.DoubleSide,forceSinglePass:true,depthWrite:false});
 for(const wing of wings){
  const lines:T.Line[]=[];wing.traverse(o=>{if(o instanceof T.Line)lines.push(o);});for(const l of lines){l.removeFromParent();l.geometry.dispose();}
  const meshes=wing.children.filter(o=>o instanceof T.Mesh) as T.Mesh[];if(meshes.length!==1)throw new Error('Expected one membrane per wing');
  meshes[0].material=material;meshes[0].name='wing-membrane';
 }
 return material;
}
function simplifyGeometry(model:FlyModel,tier:1|2){
 const radial=tier===1?8:6,longitudinal=tier===1?8:5;let stripeIndex=0;
 model.root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;const source=o.geometry;let g:T.BufferGeometry|undefined;
  if(o.name==='abdomen')g=abdomen(0,1,0,radial,longitudinal);
  else if(o.name==='abdominal-band'){const [start,end]=bands[stripeIndex++];g=abdomen(start,end,.004,radial,Math.max(1,Math.ceil((end-start)*longitudinal)));}
  else if(source instanceof T.IcosahedronGeometry)g=new T.IcosahedronGeometry(source.parameters.radius,tier===1?1:0);
  else if(source instanceof T.SphereGeometry)g=new T.SphereGeometry(source.parameters.radius,tier===1?8:6,tier===1?5:4);
  else if(source instanceof T.CylinderGeometry){const p=source.parameters;g=new T.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,tier===1?4:3,1,p.openEnded,p.thetaStart,p.thetaLength);}
  else if(source instanceof T.ShapeGeometry){g=new T.ShapeGeometry(source.parameters.shapes,tier===1?5:3);g.rotateX(Math.PI/2);}
  if(g){o.geometry=g;source.dispose();}
 });
 for(const wing of model.wings){const membrane=wing.children.find(o=>o instanceof T.Mesh) as T.Mesh<T.ShapeGeometry>;const shape=membrane.geometry.parameters.shapes as T.Shape;const outline=wing.children.find(o=>o instanceof T.Line) as T.Line;const side=Math.sign(wing.position.x);const g=new T.BufferGeometry().setFromPoints(shape.getPoints(tier===1?8:5).map(p=>new T.Vector3(p.x*side,.002,p.y)));outline.geometry.dispose();outline.geometry=g;}
 return {radial,longitudinal};
}
export function makePrismVariant(level:number):FlyModel{
 if(!Number.isInteger(level)||level<0||level>4)throw new Error('PRISM level must be 0..4');
 const model=makeCandidate(2);
 // The baseline object is deliberately untouched, including candidate ID and geometry/materials.
 if(level===0)return model;
 const tier:1|2=level===1||level===3?1:2;
 const partsBefore:Record<string,number>={};model.root.traverse(o=>{if(o.name)partsBefore[o.name]=(partsBefore[o.name]??0)+1;});
 const {radial,longitudinal}=simplifyGeometry(model,tier);
 model.root.updateMatrixWorld(true);
 if(level<=2){
  batchBody(model.root,model.wings);model.wings.forEach(batchWingLines);
  model.root.userData.simplification={radialSegments:radial,abdomenLengthSegments:longitudinal,smallSphereSegments:tier===1?[8,5]:[6,4],bodyIcosahedronDetail:tier===1?1:0,rodRadialSegments:tier===1?4:3,wingCurveSegments:tier===1?5:3,staticBodyBatched:true,wingLineStripsConvertedToSegments:true,materialsUnchanged:true};
 }else{
  const bodyMaterial=batchBodyVertexColor(model.root,model.wings),wingMaterial=singlePassWings(model.wings);
  for(const m of model.materials)m.dispose();model.materials=[bodyMaterial,wingMaterial];
  model.root.userData.simplification={radialSegments:radial,abdomenLengthSegments:longitudinal,smallSphereSegments:tier===1?[8,5]:[6,4],bodyIcosahedronDetail:tier===1?1:0,rodRadialSegments:tier===1?4:3,wingCurveSegments:tier===1?5:3,staticBodyBatched:true,bodyVertexColorSingleMaterial:true,allLinesRemoved:true,wingSinglePass:true,materialsUnchanged:false,targetDrawCalls:3};
 }
 model.root.userData.prismLevel=level;model.root.userData.prismVariant=prismVariants[level].id;model.root.userData.anatomicalPartsBeforeBatch=partsBefore;
 return model;
}
export function prismGeometryCost(model:FlyModel){let objects=0,triangles=0,lines=0,vertices=0,estimatedDrawCalls=0;model.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){objects++;const g=o.geometry,n=g.index?.count??g.getAttribute('position').count;vertices+=g.getAttribute('position').count;const materials=Array.isArray(o.material)?o.material:[o.material];estimatedDrawCalls+=materials.reduce((sum,m)=>sum+(m.transparent&&m.side===T.DoubleSide&&!m.forceSinglePass?2:1),0);if(o instanceof T.Mesh)triangles+=n/3;else lines+=o instanceof T.LineSegments?n/2:Math.max(0,n-1);}});return {objects,triangles,lines,vertices,estimatedDrawCalls};}
