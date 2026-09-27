import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {Worker as NodeWorker} from 'node:worker_threads';
import {FlightExperiment} from '../src/lib/flight.ts';
import {TRAVEL_CAP_SECONDS,externalReward,rewardInput,updateLeaveDrive,shouldLeave,createFly,LEAVE_CAP_SECONDS,LEAVE_MIN_SECONDS,REWARD_FLOOR,rewardScale,SPIKE_BYTES} from '../src/lib/colonyPolicy.ts';
const scores:[string,number][]=[['PARP1 inhibitor 15R',-13.09],['Celecoxib @ COX-2',-11.88],['Pamiparib',-11.09],['Apixaban',-10.25],['Niraparib @ PARP1',-10.18],['Rucaparib',-9.77],['Niraparib @ Xa',-7.97],['Niraparib @ COX-2',-6.61]];
test('proportional reward transform: linear between worst and best real score, best 1, worst at the floor',()=>{
 const pairs=scores.map(([,s])=>({computed:true,score:s})),scale=rewardScale(pairs),r=pairs.map(p=>externalReward(p,scale)!);
 assert.equal(r[0],1,'best real score -> 1');assert.ok(Math.abs(r[7]-REWARD_FLOOR)<1e-9,'worst -> floor');for(let i=1;i<r.length;i++)assert.ok(r[i]<r[i-1]);
 // Linear in score: equal score gaps give equal reward gaps.
 const mid=externalReward({computed:true,score:(scale.best+scale.worst)/2},scale)!;assert.ok(Math.abs(mid-(REWARD_FLOOR+(1-REWARD_FLOOR)/2))<1e-9);
 assert.equal(externalReward({computed:false,score:-13}),null);
});
test('reward input is zero out of contact and reward × learned in contact; leave rule respects minimum and cap',()=>{
 const f=createFly(0,2);f.learned[0]=.8;assert.equal(rewardInput(f,0,.9,false),0);assert.ok(Math.abs(rewardInput(f,0,.9,true)-.72)<1e-9);assert.equal(rewardInput(f,0,null,true),0);
 assert.equal(shouldLeave(1,0,LEAVE_MIN_SECONDS-.1,0,true),false);assert.equal(shouldLeave(0,1,LEAVE_CAP_SECONDS,0,true),true);assert.equal(shouldLeave(0,0,0,TRAVEL_CAP_SECONDS-1,false),false);assert.equal(shouldLeave(0,0,0,TRAVEL_CAP_SECONDS,false),true);assert.equal(shouldLeave(0,0,5.1,0,true),true,"reward 0 stays only the minimum cap");assert.equal(shouldLeave(0,1,29,0,true),false,"reward 1 keeps the full cap");assert.equal(shouldLeave(0,1,8.1,0,true,true),true,"exploration pass uses the short cap");
 let d=0;for(let i=0;i<50;i++)d=updateLeaveDrive(d,[.3,.2,.6]);assert.ok(Math.abs(d-.5)<.01);
});
test('two real MaleCNS brains: reward channel changes computed activity, and the leave rule holds the high-reward fly longer',async()=>{
 const oldFetch=globalThis.fetch,oldWorker=(globalThis as any).Worker;
 class BrowserWorker{onmessage:any;onerror:any;w=new NodeWorker(new URL('./malecns-worker-harness.mjs',import.meta.url));constructor(){this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.(e));}postMessage(m:any){this.w.postMessage(m);}terminate(){void this.w.terminate();}}
 (globalThis as any).Worker=BrowserWorker;globalThis.fetch=(async(url:any)=>new Response(await fs.readFile(new URL('../public'+String(url),import.meta.url)))) as typeof fetch;
 const chem=[.62,.31,.48,.55,.27,.7,.44,.36],high=externalReward({computed:true,score:-13.09})!*.92,low=externalReward({computed:true,score:-6.61})!*.5;
 const units=[new FlightExperiment(2026),new FlightExperiment(9945)];
 try{await Promise.all(units.map(u=>u.init()));
  const steps=400,spikes=[0,0],drive=[0,0],left=[Infinity,Infinity],groupSum=[new Float64Array(27),new Float64Array(27)];let identical=0;
  for(let t=0;t<steps;t++){const frames=await Promise.all(units.map((u,i)=>u.inspectAsync([...chem,i===0?high:low],'baseline',true)));
   assert.equal(frames[0].sensory.length,9);assert.equal(frames[0].sensory[8],Math.min(1,high));assert.equal(frames[1].sensory[8],low);assert.equal(frames[0].spikeBits?.length,SPIKE_BYTES);
   if(frames[0].spikeBits!.every((b,k)=>b===frames[1].spikeBits![k]))identical++;
   frames.forEach((f,i)=>{if(t>=100){spikes[i]+=f.spikeCount;f.groupSpikeCounts!.forEach((c,g)=>groupSum[i][g]+=c);}drive[i]=updateLeaveDrive(drive[i],f.output);const residence=(t+1)*.05;if(left[i]===Infinity&&shouldLeave(drive[i],i===0?high:low,residence,residence,true))left[i]=residence;});}
  const meanHigh=spikes[0]/300,meanLow=spikes[1]/300,gust=[6,13,24].map(g=>[groupSum[0][g]/300,groupSum[1][g]/300]);
  console.log(JSON.stringify({rewardInput:{high:+high.toFixed(3),low:+low.toFixed(3)},meanSpikesPerStep:{high:Math.round(meanHigh),low:Math.round(meanLow)},sensoryGroupsHighVsLow:gust.map(([a,b])=>[Math.round(a),Math.round(b)]),leftAtSeconds:left,identicalBitsets:identical}));
  assert.equal(identical,0);assert.ok(meanHigh>meanLow,'reward channel should add computed spikes');assert.ok(gust.some(([a,b])=>a>b*1.1),'a sensory group should be measurably more active with reward');
  assert.ok(left[1]<=20,'low-reward fly should leave within 20 s, left at '+left[1]);assert.ok(left[0]>left[1]*3,'high-reward fly stays at least 3x longer ('+left[0]+' vs '+left[1]+')');
 }finally{units.forEach(u=>u.dispose());globalThis.fetch=oldFetch;(globalThis as any).Worker=oldWorker;}
});
