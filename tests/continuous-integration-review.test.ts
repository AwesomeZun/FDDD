import {CNS} from '../src/lib/cnsDataset.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker as NodeWorker} from 'node:worker_threads';
import {FlightExperiment} from '../src/lib/flight.ts';
import {advanceFly,chooseDestination,colonySensory,createFly,externalReward,learnPreference,scoreFreePair,seededRandom,SPIKE_BYTES,type HabitatPair} from '../src/lib/colonyPolicy.ts';
import {rankCorrelation} from '../src/lib/rewardLearning.ts';
const hash=(a:Uint8Array|Float32Array)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
test('review: actual four full graphs, 300 virtual motion seconds; replay training explicitly separate',async()=>{
 const start=Date.now(),oldFetch=globalThis.fetch,oldWorker=(globalThis as any).Worker;
 class BrowserWorker{onmessage:any;onerror:any;w=new NodeWorker(new URL('./malecns-worker-harness.mjs',import.meta.url));constructor(){this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.(e));}postMessage(m:any){this.w.postMessage(m);}terminate(){void this.w.terminate();}}
 (globalThis as any).Worker=BrowserWorker;globalThis.fetch=(async(url:any)=>new Response(await fs.readFile(new URL('../public'+String(url),import.meta.url)))) as typeof fetch;
 const d=JSON.parse(await fs.readFile(new URL('../public/data/docking/multi-target.json',import.meta.url),'utf8'));
 const locations:[number,number,number][]=[[-6,1,-3.6],[-2,2,-3.8],[2,.5,-3.4],[6,1.6,-3.8],[-6,-.6,3.6],[-2,.6,3.8],[2,1.5,3.4],[6,0,3.6]];
 const pairs:HabitatPair[]=d.combinations.map((c:any,i:number)=>({...c,position:locations[i],targetName:c.targetId,receptorUrl:''})),inputs=pairs.map(scoreFreePair),rewards=pairs.map(p=>externalReward(p)!);
 const units=Array.from({length:4},(_,i)=>new FlightExperiment(2026+i*7919)),flies=units.map((_,i)=>createFly(i,pairs.length)),randoms=flies.map((_,i)=>seededRandom(2026+i*7919));
 const age=[0,0,0,0],contact=[0,0,0,0],residence=[0,0,0,0],updates=flies.map(()=>Array(pairs.length).fill(0)),arrivals=[0,0,0,0],switches=[0,0,0,0],paths=[0,0,0,0],ranges=flies.map(f=>f.position.map(x=>[x,x]));
 const outputs:number[][][]=[],spikes=flies.map(()=>[Infinity,-Infinity]),thrust=flies.map(()=>[Infinity,-Infinity]),unique=flies.map(()=>new Set<string>());let differingRounds=0;
 function control(i:number,training:boolean){const f=flies[i],j=f.destination,dist=Math.hypot(...f.position.map((x,k)=>x-inputs[j].position[k]));if(contact[i]>=1){learnPreference(f,j,rewards[j],training);if(training)updates[i][j]++;contact[i]=0;}if(age[i]>35||(dist<2.0&&residence[i]>3+f.learned[j]*9)){f.destination=chooseDestination(f.learned,randoms[i]);switches[i]++;age[i]=0;contact[i]=0;residence[i]=0;}}
 function motion(motors:number[][]){for(let sub=0;sub<5;sub++)for(let i=0;i<4;i++){const f=flies[i],j=f.destination,old=[...f.position],dist=advanceFly(f,inputs[j],motors[i],.05);paths[i]+=Math.hypot(...f.position.map((x,k)=>x-old[k]));f.position.forEach((x,k)=>{ranges[i][k][0]=Math.min(ranges[i][k][0],x);ranges[i][k][1]=Math.max(ranges[i][k][1],x);});age[i]+=.05;if(dist<2.0){if(residence[i]===0)arrivals[i]++;f.dwell[j]+=.05;contact[i]+=.05;residence[i]+=.05;}else contact[i]=0;}}
 try{
 await Promise.all(units.map(u=>u.init()));
 for(let t=0;t<1200;t++){
 const frames=await Promise.all(units.map((u,i)=>u.inspectAsync(colonySensory(inputs[flies[i].destination],flies[i],t%4),'baseline',true)));
 const hs=frames.map((f,i)=>{assert.equal(f.tick,t+1);assert.equal(f.neuronCount,CNS.neuronCount);assert.equal(f.edgeCount,CNS.edgeCount);assert.equal(f.spikeBits!.length,SPIKE_BYTES);let n=0;for(const b of f.spikeBits!)for(let bit=0;bit<8;bit++)n+=(b>>bit)&1;assert.equal(n,f.spikeCount);spikes[i][0]=Math.min(spikes[i][0],n);spikes[i][1]=Math.max(spikes[i][1],n);thrust[i][0]=Math.min(thrust[i][0],f.output[2]);thrust[i][1]=Math.max(thrust[i][1],f.output[2]);const h=hash(f.spikeBits!);unique[i].add(h);return h;});if(new Set(hs).size===4)differingRounds++;
 outputs.push(frames.map(f=>[...f.output]));flies.forEach((_,i)=>control(i,true));motion(outputs[t]);
 if(t%300===299)console.log('actual progress',t+1,'wall seconds',(Date.now()-start)/1000);
 }
 const real={virtualMotionSeconds:300,neuralSecondsPerFly:60,frames:4800,fullSpikeBytes:4800*SPIKE_BYTES,arrivals:[...arrivals],destinationDraws:[...switches],pathLengths:[...paths],axisRanges:ranges.map(r=>r.map(([a,b])=>b-a)),dwell:flies.map(f=>[...f.dwell]),learned:flies.map(f=>[...f.learned]),updates:updates.map(a=>[...a]),spikeRanges:spikes,thrustRanges:thrust,uniqueSpikeBitsets:unique.map(s=>s.size),allFourDifferentRounds:differingRounds};
 console.log('REAL',JSON.stringify(real));
 for(let i=0;i<4;i++){assert.ok(paths[i]>10);assert.ok(arrivals[i]>0);assert.ok(real.axisRanges[i].every(v=>v>.2));assert.ok(updates[i].some(n=>n>0));}
 // Independent hidden electrical histories under identical current input AND phase.
 const common=colonySensory(inputs[0],createFly(0,8),0),history=[];
 for(let t=0;t<16;t++){const f=await Promise.all(units.map(u=>u.inspectAsync(common,'baseline',true)));history.push({distinctBits:new Set(f.map(x=>hash(x.spikeBits!))).size,distinctActivity:new Set(f.map(x=>hash(Float32Array.from(x.activity)))).size});}
 // Reset all state, score perturbation only: inference must match exactly.
 // Same reseeded initial membrane state for all four, so only the score perturbation differs.
 units.forEach(u=>u.reset(2026));const changed={...pairs[0],score:100,computed:false};assert.deepEqual(scoreFreePair(pairs[0]),scoreFreePair(changed));let scoreIdentical=0;
 for(let t=0;t<16;t++){const f=await Promise.all(units.map((u,i)=>u.inspectAsync(colonySensory(scoreFreePair(i%2?changed:pairs[0]),createFly(0,8),t%4),'baseline',true)));assert.equal(new Set(f.map(x=>hash(x.spikeBits!))).size,1);assert.equal(new Set(f.map(x=>JSON.stringify(x.output))).size,1);scoreIdentical++;}
 let isolatedRounds=0;
 for(let t=0;t<8;t++){const f=await Promise.all(units.map((u,i)=>u.inspectAsync(common,i===0?'silenced':'baseline',true)));assert.equal(f[0].spikeCount,0);assert.deepEqual(f[0].output,[0,0,0]);assert.equal(new Set(f.slice(1).map(x=>hash(x.spikeBits!))).size,1);assert.ok(f[1].spikeCount>0);isolatedRounds++;}
 console.log('STATE',JSON.stringify({identicalCurrentInputHistory:history,resetScorePerturbationIdenticalRounds:scoreIdentical,singleWorkerSilencingIsolatedRounds:isolatedRounds}));
 // Extended POLICY replay, NOT additional neural simulation: cycle actual recorded motors.
 for(let t=0;t<120000;t++){flies.forEach((_,i)=>control(i,true));motion(outputs[t%outputs.length]);}
 const trained=flies.map(f=>[...f.learned]);flies.forEach(f=>f.dwell.fill(0));const frozenBefore=JSON.stringify(trained),beforePaths=[...paths];
 for(let t=0;t<40000;t++){flies.forEach((_,i)=>control(i,false));motion(outputs[t%outputs.length]);}
 assert.equal(JSON.stringify(flies.map(f=>f.learned)),frozenBefore);
 const aggregate=pairs.map((_,j)=>flies.reduce((s,f)=>s+f.dwell[j],0)),rho=rankCorrelation(rewards,aggregate);
 const replay={trainingMotionSeconds:30300,frozenEvaluationSeconds:10000,rewards,learned:trained,maxPreferenceError:Math.max(...trained.flatMap(a=>a.map((v,j)=>Math.abs(v-rewards[j])))),frozenResidence:flies.map(f=>f.dwell),aggregateResidence:aggregate,rewardResidenceSpearman:rho,perFlySpearman:flies.map(f=>rankCorrelation(rewards,f.dwell)),frozenPathLengths:paths.map((v,i)=>v-beforePaths[i]),frozenExact:true};
 console.log('REPLAY',JSON.stringify(replay));assert.ok(rho>.7);assert.ok(replay.maxPreferenceError<.01);
 console.log('WALL_SECONDS',(Date.now()-start)/1000);
 }finally{units.forEach(u=>u.dispose());globalThis.fetch=oldFetch;(globalThis as any).Worker=oldWorker;}
});
