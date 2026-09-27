import {CNS} from './cnsDataset.ts';
import type {FlightFrame} from './flight.ts';
import {chemicalSensory} from './rewardLearning.ts';
export type HabitatPair={id:string;targetId:string;targetName:string;compoundId:string;name:string;smiles:string;score:number;poseUrl:string;receptorUrl:string;position:[number,number,number];computed:boolean;radiusWorld?:number};
export type ColonyFly={id:number;position:[number,number,number];velocity:[number,number,number];destination:number;feeding:number;dwell:number[];trail:[number,number,number][];frame?:FlightFrame;learned:number[]};
export type ScoreFreePair=Pick<HabitatPair,'id'|'targetId'|'smiles'|'position'|'radiusWorld'>;
/** 20 flies, each with its own full MaleCNS worker (no shared or reduced brains). Raised from 4 on user request. */
/** Maximum colony size. Every fly always runs its own full MaleCNS worker; the live size is chosen per device (see flyCountForDevice). */
export const MAX_FLY_COUNT=20;
/** Backwards-compatible alias used by tests and metadata; equals MAX_FLY_COUNT. */
export const FLY_COUNT=MAX_FLY_COUNT;
export const FLY_COUNT_OPTIONS=[4,8,12,20] as const;
export const FLY_COUNT_STORAGE_KEY='fddd.fly-count';
/** Device default: half the logical cores, clamped to 4..20, rounded down to the nearest option. Each fly is one full 167,122-neuron worker. */
export function flyCountForDevice(hardwareConcurrency:number|undefined){const cores=Number.isFinite(hardwareConcurrency)&&(hardwareConcurrency as number)>0?(hardwareConcurrency as number):4;const target=Math.max(4,Math.min(MAX_FLY_COUNT,Math.floor(cores/2)));let pick:number=FLY_COUNT_OPTIONS[0];for(const o of FLY_COUNT_OPTIONS)if(o<=target)pick=o;return pick;}
export function normalizeFlyCount(value:unknown){const n=Number(value);return (FLY_COUNT_OPTIONS as readonly number[]).includes(n)?n:null;}
export const TRAIL_LIMIT=240, SEGMENT_STEPS=1024, SPIKE_BYTES=Math.ceil(CNS.neuronCount/8);
export const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
export function seededRandom(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function scoreFreePair(p:HabitatPair):ScoreFreePair{return {id:p.id,targetId:p.targetId,smiles:p.smiles,position:[...p.position],...(p.radiusWorld===undefined?{}:{radiusWorld:p.radiusWorld})};}
// Target identity is an authored categorical cue, not a protein representation.
export function colonySensory(p:ScoreFreePair,fly:ColonyFly,phase:number):number[]{const c=chemicalSensory(p.smiles,phase%4);let h=2166136261;for(const ch of p.targetId)h=Math.imul(h^ch.charCodeAt(0),16777619);return c.map((v,i)=>clamp(.75*v+.15*((h>>>(i*4))&15)/15+.10*clamp(.5+(p.position[i%3]-fly.position[i%3])/16,0,1),0,1));}
// Authored reward transform of real Vina scores; not calibrated affinity. Sharpened 2026-09-14 (was sigmoid((score+7)/2)) so the
// single best executed score (PARP1 inhibitor 15R, -13.09 kcal/mol) stands clearly apart: centre -11.9, width .5 kcal/mol.
// Resulting rewards for the eight executed pairs are listed in docs/brain-reward-loop.md. Cross-target scores stay uncalibrated.
// Authored reward transform of REAL Vina scores (kcal/mol), not calibrated affinity. Proportional mode (user request 2026-09-15):
// reward is a linear rescale between the worst and best executed score in the loaded set, with a small floor so the
// worst pair is still occasionally visited. Best score -> 1, worst -> REWARD_FLOOR. Cross-target scores stay uncalibrated.
export const REWARD_FLOOR=.05;
export type RewardScale={best:number;worst:number};
export function rewardScale(pairs:Pick<HabitatPair,'computed'|'score'>[]):RewardScale{const scores=pairs.filter(p=>p.computed&&Number.isFinite(p.score)).map(p=>p.score);if(!scores.length)return {best:-1,worst:0};return {best:Math.min(...scores),worst:Math.max(...scores)};}
export function externalReward(p:Pick<HabitatPair,'computed'|'score'>,scale?:RewardScale):number|null{if(!(p.computed&&Number.isFinite(p.score)))return null;const sc=scale??{best:-13,worst:-6};const span=sc.worst-sc.best;const linear=span>1e-9?clamp((sc.worst-p.score)/span,0,1):1;return REWARD_FLOOR+(1-REWARD_FLOOR)*linear;}
// Reward channel value fed into the feeding/gustatory neurons (engine input 8): only while the fly is inside the contact radius
// of its destination, value = externalReward × learned preference. Zero elsewhere. Recorded per frame as sensory[8].
export function rewardInput(fly:ColonyFly,index:number,reward:number|null,inContact:boolean):number{return inContact&&reward!==null?clamp(reward*fly.learned[index],0,1):0;}
// Brain-driven leave rule (authored decoding of computed descending output; replaces the 35 s / residence timers):
// leaveDrive = EMA of |turn|+|lift| motor output magnitude; the fly leaves its destination when leaveDrive exceeds
// LEAVE_BASE + LEAVE_REWARD_GAIN × rewardInput after at least LEAVE_MIN_SECONDS in contact, or at LEAVE_CAP_SECONDS.
// Proportional mode: the stay cap scales with the reward input (LEAVE_CAP_MIN_SECONDS at reward 0 up to
// LEAVE_CAP_MIN+LEAVE_CAP_SPAN at reward 1); the first unseen-target pass uses EXPLORE_CAP_SECONDS so learning starts quickly.
// The brain-driven early leave (leaveDrive threshold) still applies inside the cap. Authored decoding, labelled as such.
export const LEAVE_BASE=.24, LEAVE_REWARD_GAIN=.35, LEAVE_MIN_SECONDS=2, LEAVE_CAP_MIN_SECONDS=5, LEAVE_CAP_SPAN_SECONDS=25, EXPLORE_CAP_SECONDS=8, LEAVE_EMA=.15, TRAVEL_CAP_SECONDS=30;
export const LEAVE_CAP_SECONDS=LEAVE_CAP_MIN_SECONDS+LEAVE_CAP_SPAN_SECONDS;
export function stayCapSeconds(reward:number,exploring=false){return exploring?EXPLORE_CAP_SECONDS:LEAVE_CAP_MIN_SECONDS+LEAVE_CAP_SPAN_SECONDS*clamp(reward,0,1);}
export function updateLeaveDrive(previous:number,output:number[]):number{const turn=Math.abs(Number(output[0])||0),lift=Math.abs(Number(output[1])||0);return previous+LEAVE_EMA*((turn+lift)-previous);}
export function shouldLeave(leaveDrive:number,reward:number,residenceSeconds:number,ageSeconds:number,inContact:boolean,exploring=false):boolean{if(!inContact)return ageSeconds>=TRAVEL_CAP_SECONDS;if(residenceSeconds>=stayCapSeconds(reward,exploring))return true;if(residenceSeconds<LEAVE_MIN_SECONDS)return false;return leaveDrive>LEAVE_BASE+LEAVE_REWARD_GAIN*clamp(reward,0,1);}
// Authored learning-policy parameters (not result manipulation): raised so preference for higher real Vina reward
// concentrates within minutes instead of hours. Before 2026-09-14: rate .12, exploration floor .15, softmax gain 4.
// Destination choice is PROPORTIONAL to learned preference (weight = learned^PREFERENCE_POWER, power 1 = linear),
// so the colony spreads across pairs in the ratio of their learned (reward-derived) values instead of piling onto one.
export const LEARNING_RATE=.30, EXPLORATION_FLOOR=.05, PREFERENCE_POWER=1;
export function learnPreference(fly:ColonyFly,index:number,reward:number|null,training:boolean){if(training&&reward!==null)fly.learned[index]+=LEARNING_RATE*(reward-fly.learned[index]);}
export function chooseDestination(values:number[],random:()=>number):number{if(!values.length)return -1;const logits=values.map(v=>Math.pow(clamp(v,0,1),PREFERENCE_POWER)),sum=logits.reduce((s,v)=>s+v,0)||1;const weights=logits.map(v=>EXPLORATION_FLOOR/values.length+(1-EXPLORATION_FLOOR)*v/sum);let draw=random();for(let i=0;i<weights.length;i++){draw-=weights[i];if(draw<=0)return i;}return values.length-1;}
export const FLY_SEED=(id:number)=>2026+id*7919;
// Start positions: a 5 x 4 lattice inside the arena (x -6..6, z -3..3) with a small deterministic stagger, so 20 flies never start off-arena.
export function createFly(id:number,count:number,total:number=MAX_FLY_COUNT):ColonyFly{const col=id%5,row=Math.floor(id/5)%4;return {id,position:[-6+col*3+((row%2)?.7:0),.3+(id%3)*.6,-3+row*2+((col%2)?.4:0)],velocity:[.2,0,.2],destination:count?Math.floor(id*count/Math.max(1,total))%count:-1,feeding:0,dwell:Array(count).fill(0),trail:[],learned:Array(count).fill(.5)};}
export const orbitRadius=(p:ScoreFreePair)=>p.radiusWorld===undefined?1.6:p.radiusWorld+.4;
export const contactRadius=(p:ScoreFreePair)=>p.radiusWorld===undefined?2.5:p.radiusWorld+1.25; // widened from +.75: fast orbiting flies hovered just outside contact
export function arenaBounds(pairs:ScoreFreePair[]){return [0,1,2].map(k=>[Math.min(...pairs.map(p=>p.position[k]-contactRadius(p)-.6)),Math.max(...pairs.map(p=>p.position[k]+contactRadius(p)+.6))]) as [number,number][];}
// Authored attraction/orbit steering; actual neural motor output modulates turn, thrust and lift.
// This is not a learned flight controller. Zero output removes thrust and damps velocity.
/** Authored flight-speed multiplier for the habitat adapter (world units/s); raised from 1 on user request. Does not change the CNS computation or the motor outputs it produces. */
export const FLIGHT_SPEED=4.5;
export function advanceFly(fly:ColonyFly,p:ScoreFreePair,output:number[],dt:number,bounds?:[number,number][]):number{
 const motor=output.map(x=>Number.isFinite(x)?x:0),turn=Math.tanh(motor[0]??0),lift=Math.tanh(motor[1]??0),thrust=Math.tanh(Math.abs(motor[2]??0)*3);
 const delta=p.position.map((v,i)=>v-fly.position[i]),distance=Math.hypot(...delta),near=Math.exp(-distance*distance/Math.max(3,orbitRadius(p)**2)),side=fly.id%2?1:-1;
 const radial=distance>orbitRadius(p)+.9?1:(distance-orbitRadius(p))/Math.max(distance,.05);
 const desired=[delta[0]*radial+near*side*(-delta[2])*2+turn*.5,delta[1]*radial+lift*.5+near*.3*side,delta[2]*radial+near*side*delta[0]*2-turn*.4];
 const norm=Math.hypot(...desired)||1,speed=FLIGHT_SPEED*thrust*(.65+.55*Math.abs(turn)),blend=1-Math.exp(-dt*2.2*Math.sqrt(FLIGHT_SPEED));
 for(let i=0;i<3;i++){fly.velocity[i]+=(desired[i]/norm*speed-fly.velocity[i])*blend;fly.position[i]+=fly.velocity[i]*dt;const lo=bounds?.[i]?.[0]??(i===1?-2.8:i===0?-7.5:-5.5),hi=bounds?.[i]?.[1]??(i===1?4:i===0?7.5:5.5);if(fly.position[i]<lo||fly.position[i]>hi){fly.position[i]=clamp(fly.position[i],lo,hi);fly.velocity[i]*=-.5;}}
 fly.trail.push([...fly.position]);if(fly.trail.length>TRAIL_LIMIT)fly.trail.splice(0,fly.trail.length-TRAIL_LIMIT);
 return distance;
}
