// Direct in-process MaleCNS engine harness (no worker): measures population rate, rhythm and the reward channel effect.
// Usage: node scripts/brain-dynamics-harness.mjs [path/to/core.js] [seed]
import fs from 'node:fs';import path from 'node:path';
const corePath=process.argv[2]??'public/engine/malecns/core.js',seed=Number(process.argv[3]??0);
const core=await import(path.resolve(corePath));
const buffer=fs.readFileSync('public/data/malecns/connectome.bin.gz'),ids=JSON.parse(fs.readFileSync('public/data/malecns/root-ids.json','utf8')),manifest=JSON.parse(fs.readFileSync('public/data/malecns/manifest.json','utf8')),gustatory=JSON.parse(fs.readFileSync('public/data/malecns/gustatory.json','utf8'));
const ab=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const info=await core.initEngine(ab,ids,manifest,{feedingIndices:gustatory.gustatoryIndices,seed});
const chem=[.62,.31,.48,.55,.27,.7,.44,.36];
function run(label,sensory,steps=300,skip=100){core.resetEngine();const counts=[],groups=new Float64Array(manifest.groups.length),motor=[];for(let t=0;t<steps;t++){const f=core.stepEngine(sensory,'baseline');if(t>=skip){counts.push(f.spikeCount);for(let g=0;g<groups.length;g++)groups[g]+=f.groupSpikeCounts[g];motor.push(f.output);}}
 const n=counts.length,mean=counts.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(counts.reduce((a,b)=>a+(b-mean)**2,0)/n);let ac4=0;for(let i=4;i<n;i++)ac4+=(counts[i]-mean)*(counts[i-4]-mean);ac4/=Math.max(1,(n-4)*sd*sd);
 const out=[0,1,2].map(k=>motor.reduce((a,m)=>a+m[k],0)/n);
 return {label,meanSpikes:Math.round(mean),sd:Math.round(sd),cv:+(sd/mean).toFixed(3),lag4Autocorr:+ac4.toFixed(3),meanOutput:out.map(x=>+x.toFixed(3)),groups:Array.from(groups,g=>g/n)};}
const silent=run('silent (all channels 0)',Array(9).fill(0));
const chemOnly=run('chemical input, reward 0',[...chem,0]);
const chemReward=run('chemical input, reward 1',[...chem,1]);
const diff=manifest.groups.map((g,i)=>({group:g,reward0:+chemOnly.groups[i].toFixed(1),reward1:+chemReward.groups[i].toFixed(1),delta:+(chemReward.groups[i]-chemOnly.groups[i]).toFixed(1)})).filter(x=>Math.abs(x.delta)>=5).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
console.log(JSON.stringify({core:corePath,seed,feedingCells:info.feedingCount??0,dynamicsLabel:info.dynamicsLabel,results:[silent,chemOnly,chemReward].map(({groups,...r})=>r),groupDeltaRewardOnVsOff:diff},null,1));
