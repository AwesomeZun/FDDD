import test from 'node:test';import assert from 'node:assert/strict';
import {rewardScale,FLY_COUNT,FLY_SEED,createFly,arenaBounds,chooseDestination,learnPreference,externalReward,seededRandom,LEARNING_RATE,EXPLORATION_FLOOR,PREFERENCE_POWER} from '../src/lib/colonyPolicy.ts';
import {FLY_ACCENTS} from '../src/lib/flyAccents.ts';
const pairs=[[-6,1,-3.6],[-2,2,-3.8],[2,.5,-3.4],[6,1.6,-3.8],[-6,-.6,3.6],[-2,.6,3.8],[2,1.5,3.4],[6,0,3.6]].map((position,i)=>({id:'p'+i,targetId:'t'+(i%3),smiles:'CC',position:position as [number,number,number],radiusWorld:1.3}));
test('twenty flies: distinct seeds, distinct in-arena start positions, twenty accents',()=>{
 assert.equal(FLY_COUNT,20);
 const seeds=Array.from({length:FLY_COUNT},(_,i)=>FLY_SEED(i));assert.equal(new Set(seeds).size,FLY_COUNT);
 const bounds=arenaBounds(pairs),flies=Array.from({length:FLY_COUNT},(_,i)=>createFly(i,pairs.length));
 assert.equal(new Set(flies.map(f=>f.position.join(','))).size,FLY_COUNT);
 for(const f of flies)f.position.forEach((x,k)=>assert.ok(x>=bounds[k][0]&&x<=bounds[k][1],`fly ${f.id} axis ${k} starts inside the arena`));
 assert.ok(new Set(flies.map(f=>f.destination)).size>=Math.min(pairs.length,4),'initial destinations spread across complexes');
 assert.equal(FLY_ACCENTS.length,FLY_COUNT);assert.equal(new Set(FLY_ACCENTS).size,FLY_COUNT);
});
test('strengthened learning policy concentrates choice on the higher real Vina reward without scripting the destination',()=>{
 assert.deepEqual([LEARNING_RATE,EXPLORATION_FLOOR,PREFERENCE_POWER],[.30,.05,1]);
 const scores=[-13.09,-11.09,-10.18,-9.77,-11.88,-6.61,-10.25,-7.97],pairsForScale=scores.map(score=>({computed:true,score})),rewards=scores.map(score=>externalReward({computed:true,score},rewardScale(pairsForScale)));
 const fly=createFly(0,scores.length);for(let visit=0;visit<12;visit++)scores.forEach((_,j)=>learnPreference(fly,j,rewards[j],true));
 const random=seededRandom(7),picks=Array(scores.length).fill(0);for(let n=0;n<4000;n++)picks[chooseDestination(fly.learned,random)]++;
 const best=scores.indexOf(Math.min(...scores)),worst=scores.indexOf(Math.max(...scores));
 assert.ok(picks[best]>picks[worst]*3,'best-rewarded complex chosen far more often than the worst');
 const share=picks[best]/4000;assert.ok(share>.15&&share<.35,'proportional: best gets a plurality, not a monopoly ('+share.toFixed(2)+')');
 assert.ok(picks[worst]>0,'exploration floor keeps every complex reachable');
 const frozen=createFly(1,scores.length);scores.forEach((_,j)=>learnPreference(frozen,j,rewards[j],false));assert.ok(frozen.learned.every(v=>v===.5),'reward off leaves preference untouched');
});
