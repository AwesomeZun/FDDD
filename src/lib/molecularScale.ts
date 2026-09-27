/** One shared conversion for every receptor and ligand. Never normalize individual structures. */
export const WORLD_UNITS_PER_ANGSTROM = 0.03;
export type MolecularGeometry = {
  atomCount:number; caCount:number; chainCount:number;
  centerAngstrom:[number,number,number];
  dimensionsAngstrom:[number,number,number];
  dimensionsWorld:[number,number,number];
  radiusAngstrom:number; radiusWorld:number;
  minYWorld:number; maxYWorld:number;
};
export function molecularGeometry(text:string):MolecularGeometry {
  const positions:[number,number,number][]=[];let caCount=0;const chains=new Set<string>();
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('ENDMDL'))break;
    if(!/^(ATOM  |HETATM)/.test(line)||![' ','A',''].includes(line.slice(16,17)))continue;
    const p=[30,38,46].map(k=>Number(line.slice(k,k+8))) as [number,number,number];
    if(!p.every(Number.isFinite))continue;positions.push(p);
    if(line.slice(12,16).trim()==='CA'){caCount++;chains.add(line.slice(21,22));}
  }
  if(!positions.length)throw Error('No valid molecular coordinates');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of positions)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const center=min.map((v,k)=>(v+max[k])/2) as [number,number,number];
  const dimensions=max.map((v,k)=>v-min[k]) as [number,number,number];
  let radius=0;for(const p of positions)radius=Math.max(radius,Math.hypot(...p.map((v,k)=>v-center[k])));
  return {atomCount:positions.length,caCount,chainCount:chains.size,centerAngstrom:center,dimensionsAngstrom:dimensions,dimensionsWorld:dimensions.map(v=>v*WORLD_UNITS_PER_ANGSTROM) as [number,number,number],radiusAngstrom:radius,radiusWorld:radius*WORLD_UNITS_PER_ANGSTROM,minYWorld:(min[1]-center[1])*WORLD_UNITS_PER_ANGSTROM,maxYWorld:(max[1]-center[1])*WORLD_UNITS_PER_ANGSTROM};
}
