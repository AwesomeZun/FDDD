import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {WORLD_UNITS_PER_ANGSTROM,molecularGeometry} from '../src/lib/molecularScale.ts';
import {coordinateAtoms,makeProteinComplex,disposeMolecularObject} from '../src/components/ProteinRibbon.ts';
const manifest=JSON.parse(fs.readFileSync('public/data/docking/multi-target.json','utf8'));
const metadata=JSON.parse(fs.readFileSync('public/data/docking/structure-scale.json','utf8'));
const receptor=(id:string)=>{const t=manifest.targets.find((x:any)=>x.id===id);return fs.readFileSync('public'+(t.displayReceptorPdbqt??t.receptorPdbqt),'utf8');};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all prepared receptors and ligands use the same Angstrom conversion',()=>{
 for(const t of manifest.targets){const c=manifest.combinations.find((x:any)=>x.targetId===t.id),r=receptor(t.id),l=fs.readFileSync('public'+c.poseUrl,'utf8');const o=makeProteinComplex(r,l,0xaaaaaa,0xffffff);near(o.children[0].scale.x,WORLD_UNITS_PER_ANGSTROM);near(o.children[0].scale.y,WORLD_UNITS_PER_ANGSTROM);near(o.children[0].scale.z,WORLD_UNITS_PER_ANGSTROM);assert.equal(o.userData.worldUnitsPerAngstrom,.03);disposeMolecularObject(o);}
});
test('source size ratios are preserved instead of normalizing large assemblies',()=>{
 const parp=molecularGeometry(receptor('parp1-4r6e-chain-a')),cox=molecularGeometry(receptor('cox2-3ln1'));
 assert.equal(parp.caCount,350);assert.equal(cox.caCount,2208);assert.equal(cox.chainCount,4);
 near(Math.max(...cox.dimensionsWorld)/Math.max(...parp.dimensionsWorld),139.439/61.425);
 assert.ok(Math.max(...cox.dimensionsWorld)>2.26*Math.max(...parp.dimensionsWorld));
 for(const t of metadata.targets){const actual=molecularGeometry(receptor(t.targetId));assert.deepEqual(actual.dimensionsWorld,t.dimensionsWorld);near(actual.radiusWorld,t.radiusWorld);}
});
test('ligand coordinates and receptor-ligand distances share one transform',()=>{
 const c=manifest.combinations[0],r=receptor(c.targetId),lt=fs.readFileSync('public'+c.poseUrl,'utf8'),o=makeProteinComplex(r,lt,0xaaaaaa,0xffffff);o.position.set(5,-2,3);o.updateMatrixWorld(true);
 const molecules=o.children[0],a=coordinateAtoms(r)[0].p,b=coordinateAtoms(lt).find(x=>x.element!=='H')!.p;
 const transformedA=molecules.localToWorld(a.clone()),transformedB=molecules.localToWorld(b.clone());near(transformedA.distanceTo(transformedB),a.distanceTo(b)*WORLD_UNITS_PER_ANGSTROM);
 const geometry=molecularGeometry(r);const expected=b.clone().sub(new T.Vector3(...geometry.centerAngstrom)).multiplyScalar(.03).add(o.position);near(expected.distanceTo(transformedB),0);disposeMolecularObject(o);
});
test('orthographic comparison preserves apparent scale across station depths',()=>{
 const camera=new T.OrthographicCamera(-10,10,8,-8,.1,100);camera.position.set(2,10,25);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const screenLength=(center:T.Vector3)=>{const a=center.clone().project(camera),b=center.clone().add(new T.Vector3(50*WORLD_UNITS_PER_ANGSTROM,0,0)).project(camera);return Math.hypot(a.x-b.x,a.y-b.y);};
 near(screenLength(new T.Vector3(-6,1,-3.6)),screenLength(new T.Vector3(6,1.6,3.8)));
});
