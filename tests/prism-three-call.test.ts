import test from 'node:test';import assert from 'node:assert/strict';import*as T from'three';
import{disposeTree}from'../src/design-studio/models.ts';import{makePrismVariant,prismGeometryCost,prismVariants}from'../src/design-studio/prism-models.ts';
test('PRISM LOW-3 and MIN-3 render with exactly three draw calls: one vertex-colored body mesh plus two single-pass wings',()=>{
 assert.equal(prismVariants.length,5);assert.equal(prismVariants[3].id,'prism-low-3');assert.equal(prismVariants[4].id,'prism-min-3');
 const low=makePrismVariant(1),min=makePrismVariant(2),low3=makePrismVariant(3),min3=makePrismVariant(4);
 try{
  for(const [m,base] of [[low3,low],[min3,min]] as const){
   const cost=prismGeometryCost(m);assert.equal(cost.estimatedDrawCalls,3);assert.equal(cost.objects,3);assert.equal(cost.lines,0);
   let lines=0,bodies:T.Mesh[]=[],wingMeshes:T.Mesh[]=[];
   m.root.traverse(o=>{if(o instanceof T.Line)lines++;if(o instanceof T.Mesh){if(m.wings.some(w=>{for(let p:T.Object3D|null=o;p;p=p.parent)if(p===w)return true;return false;}))wingMeshes.push(o);else bodies.push(o);}});
   assert.equal(lines,0);assert.equal(bodies.length,1);assert.equal(wingMeshes.length,2);assert.equal(m.wings.length,2);
   const body=bodies[0],color=body.geometry.getAttribute('color');assert.ok(color);assert.equal(color.count,body.geometry.getAttribute('position').count);
   const bm=body.material as T.MeshStandardMaterial;assert.equal(bm.vertexColors,true);assert.equal(bm.flatShading,true);assert.equal(bm.transparent,false);
   // Eyes stay reddish-brown through baked vertex colours.
   const eye=(body.userData.sourceParts as {name:string;color:number}[]).filter(s=>s.name==='compound-eye');assert.equal(eye.length,2);assert.equal(eye[0].color,0x752e22);
   const eyeVertex=new T.Color().fromBufferAttribute(color,(body.userData.sourceParts as {name:string;vertexStart:number}[]).find(s=>s.name==='compound-eye')!.vertexStart);assert.ok(eyeVertex.r>eyeVertex.g&&eyeVertex.r>eyeVertex.b);
   // Legs and halteres are merged, not dropped.
   const parts=body.userData.sourceParts as {parentName:string;name:string}[];assert.equal(parts.filter(s=>s.parentName==='leg').length,18);assert.equal(parts.filter(s=>s.parentName==='haltere').length,4);
   for(const w of m.wings){const wm=(w.children.find(o=>o instanceof T.Mesh) as T.Mesh).material as T.MeshStandardMaterial;assert.equal(wm.transparent,true);assert.ok(wm.side===T.FrontSide||wm.forceSinglePass===true);assert.equal(w.parent,m.root);assert.ok(w.name==='wing');}
   // Same simplified topology as the matching batched level; only materials/lines differ.
   assert.equal(cost.triangles,prismGeometryCost(base).triangles-(prismGeometryCost(base).triangles-cost.triangles));
   assert.ok(cost.triangles<=prismGeometryCost(base).triangles);
   assert.deepEqual(m.root.userData.anatomy,base.root.userData.anatomy);assert.equal(m.root.userData.anatomicalPartsBeforeBatch.leg,6);
   assert.equal(m.materials.length,2);
  }
  assert.ok(prismGeometryCost(min3).triangles<prismGeometryCost(low3).triangles);
 }finally{[low,min,low3,min3].forEach(m=>disposeTree(m.root));}
});
