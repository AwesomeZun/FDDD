import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFly,arenaBounds,contactRadius,orbitRadius,createFly,scoreFreePair,type HabitatPair} from '../src/lib/colonyPolicy.ts';
const base:HabitatPair={id:'test',targetId:'protein',targetName:'Protein',compoundId:'ligand',name:'Ligand',smiles:'CC',score:-10,poseUrl:'',receptorUrl:'',position:[-6,-.6,3.6],computed:true,radiusWorld:2.33732};
test('larger real molecular radius controls orbit, proximity and arena bounds',()=>{const p=scoreFreePair(base),b=arenaBounds([p]);assert.ok(orbitRadius(p)>2.7);assert.ok(contactRadius(p)>3);assert.ok(b[0][0]<-9.5);assert.ok(b[2][1]>7.2);const f=createFly(0,1);for(let i=0;i<1000;i++)advanceFly(f,p,[.2,.1,.5],.05,b);assert.ok(f.position.every((x,i)=>Number.isFinite(x)&&x>=b[i][0]&&x<=b[i][1]));});
test('geometric radius does not introduce docking-score input leakage',()=>{assert.deepEqual(scoreFreePair(base),scoreFreePair({...base,score:-1000}));assert.ok(!('score' in scoreFreePair(base)));assert.equal(orbitRadius({...scoreFreePair(base),radiusWorld:undefined}),1.6);});
