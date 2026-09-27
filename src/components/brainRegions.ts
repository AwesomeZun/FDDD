/**
 * Region palette for MaleCNS superclass groups. This is a VIEWING palette keyed on the official
 * superclass annotation of each displayed soma sample; it does not infer cell types or activity.
 */
export const REGIONS=[
 {id:'sensory',label:'SENSORY',color:[.30,.95,.85],groups:['cb_sensory','cb_sensory_tbc','ol_sensory','vnc_sensory','vnc_sensory_tbc','sensory_ascending','sensory_ascending_tbc','sensory_descending']},
 {id:'central',label:'CENTRAL',color:[.55,.62,1],groups:['cb_intrinsic','ol_intrinsic','visual_projection','visual_projection_tbc','visual_centrifugal','vnc_intrinsic']},
 {id:'descending',label:'DESCENDING',color:[1,.72,.30],groups:['descending_neuron','efferent_descending']},
 {id:'motor',label:'VNC MOTOR',color:[1,.38,.42],groups:['vnc_motor','cb_motor']},
 {id:'other',label:'OTHER',color:[.62,.66,.70],groups:[]},
] as const;
export const REGION_CSS=REGIONS.map(r=>`rgb(${r.color.map(c=>Math.round(c*255)).join(',')})`);
export function regionOfGroup(group:string){const k=REGIONS.findIndex(r=>(r.groups as readonly string[]).includes(group));return k<0?REGIONS.length-1:k;}
/** Per-region spike rate (spikes / neurons in region) from a frame's real per-group spike counts. */
export function regionRates(groupSpikeCounts:Uint32Array|undefined,groupNames:string[],groupSizes:Record<string,number>):number[]{
 const spikes=new Array(REGIONS.length).fill(0),sizes=new Array(REGIONS.length).fill(0);
 groupNames.forEach((name,g)=>{const r=regionOfGroup(name);sizes[r]+=groupSizes[name]??0;spikes[r]+=groupSpikeCounts?.[g]??0;});
 return spikes.map((s,i)=>sizes[i]?s/sizes[i]:0);
}
