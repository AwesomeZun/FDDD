import * as T from 'three';
import {WORLD_UNITS_PER_ANGSTROM, molecularGeometry} from '../lib/molecularScale.ts';

export type CoordinateAtom = { name: string; element: string; chain: string; residue: string; p: T.Vector3 };
/** PDB/PDBQT fixed columns. The first pose/model only; no coordinate regeneration. */
export function coordinateAtoms(text: string): CoordinateAtom[] {
  const atoms: CoordinateAtom[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('ENDMDL')) break;
    if (!/^(ATOM  |HETATM)/.test(line) || ![' ', 'A', ''].includes(line.slice(16, 17))) continue;
    const p = new T.Vector3(Number(line.slice(30, 38)), Number(line.slice(38, 46)), Number(line.slice(46, 54)));
    if (!p.toArray().every(Number.isFinite)) continue;
    const name = line.slice(12, 16).trim();
    const tail = line.trim().split(/\s+/).at(-1) || '';
    const autodock: Record<string, string> = { A: 'C', NA: 'N', OA: 'O', SA: 'S', HD: 'H', HS: 'H', Cl: 'Cl', Br: 'Br' };
    const raw = line.slice(76, 78).trim();
    const element = autodock[tail] || (/^(C|N|O|S|H|P|F|Cl|Br|I)$/.test(tail) ? tail : /^[A-Za-z]{1,2}$/.test(raw) ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : name.replace(/^\d+/, '')[0]);
    atoms.push({ name, element, chain: line.slice(21, 22), residue: line.slice(22, 27), p });
  }
  return atoms;
}

export function disposeMolecularObject(root: T.Object3D) {
  root.traverse(o => {
    if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points || o instanceof T.Sprite) {
      if ('geometry' in o) o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ('map' in m && m.map instanceof T.Texture) m.map.dispose();
        m.dispose();
      }
    }
  });
}

function cylinderBetween(a: T.Vector3, b: T.Vector3, radius: number, material: T.Material) {
  const d = b.clone().sub(a);
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, d.length(), 7), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

/** Stylized elliptical Cα ribbon, not DSSP secondary-structure inference. */
function ribbonGeometry(curve:T.CatmullRomCurve3,segments:number){
 const frames=curve.computeFrenetFrames(segments,false),positions:number[]=[],indices:number[]=[];
 for(let i=0;i<=segments;i++){const center=curve.getPointAt(i/segments);for(let j=0;j<=8;j++){const angle=j/8*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i],Math.cos(angle)*.95).addScaledVector(frames.binormals[i],Math.sin(angle)*.18);positions.push(p.x,p.y,p.z);if(i<segments&&j<8){const a=i*9+j,b=a+9;indices.push(a,b,a+1,b,b+1,a+1);}}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
/** Smooth Cα backbone, not a secondary-structure assignment or simulated fold. */
export function makeProteinComplex(receptorText: string, ligandText: string, color: T.ColorRepresentation, accent: T.ColorRepresentation) {
  const receptor = coordinateAtoms(receptorText);
  const ligand = coordinateAtoms(ligandText).filter(a => a.element !== 'H');
  const ca = receptor.filter(a => a.name === 'CA');
  if (ca.length < 3 || !ligand.length) throw new Error('Missing receptor backbone or ligand coordinates');
  const group = new T.Group();
  const bounds = new T.Box3().setFromPoints(receptor.map(a => a.p));
  const center = bounds.getCenter(new T.Vector3());
  // A single rigid translation + uniform scale is shared by BOTH molecules.
  const scale = WORLD_UNITS_PER_ANGSTROM;
  group.userData.molecularGeometry = molecularGeometry(receptorText);
  group.userData.worldUnitsPerAngstrom = scale;
  const molecules = new T.Group();
  molecules.scale.setScalar(scale);
  molecules.position.copy(center).multiplyScalar(-scale);
  group.add(molecules);
  const runs: CoordinateAtom[][] = [];
  const chainOrder=[...new Set(ca.map(a=>a.chain))];
  for (const atom of chainOrder.flatMap(chain=>ca.filter(a=>a.chain===chain))) {
    const run = runs.at(-1), previous = run?.at(-1);
    if (!previous || previous.chain !== atom.chain || previous.p.distanceTo(atom.p) > 4.7) runs.push([atom]);
    else if (previous.residue !== atom.residue) run!.push(atom);
  }
  const base = new T.Color(color);
  runs.forEach((run, index) => {
    if (run.length < 2) return;
    const curve = new T.CatmullRomCurve3(run.map(a => a.p), false, 'centripetal');
    const material = new T.MeshStandardMaterial({ color: base.clone().offsetHSL((index % 3) * .025, 0, (index % 2) * .035), roughness: .42, metalness: .18 });
    molecules.add(new T.Mesh(ribbonGeometry(curve, Math.min(1600, run.length * 4)), material));
  });
  const colors: Record<string, number> = { N: 0x6c9cfa, O: 0xf0827a, S: 0xe8cf88, P: 0xe9b57e, F: 0x9bd7b1, Cl: 0x9bd7b1, Br: 0xb88967 };
  const materials = new Map<string, T.MeshStandardMaterial>();
  const materialFor = (element: string) => {
    if (!materials.has(element)) materials.set(element, new T.MeshStandardMaterial({ color: colors[element] ?? accent, emissive: colors[element] ?? accent, emissiveIntensity: .38, roughness: .25, metalness: .15 }));
    return materials.get(element)!;
  };
  for (const atom of ligand) {
    const sphere = new T.Mesh(new T.SphereGeometry(.34, 10, 7), materialFor(atom.element));
    sphere.position.copy(atom.p); molecules.add(sphere);
  }
  const radii: Record<string, number> = { C: .76, N: .71, O: .66, S: 1.05, P: 1.07, F: .57, Cl: 1.02, Br: 1.2, I: 1.39 };
  for (let i = 0; i < ligand.length; i++) for (let j = i + 1; j < ligand.length; j++) {
    const a = ligand[i], b = ligand[j], distance = a.p.distanceTo(b.p);
    if (distance < .65 || distance > (radii[a.element] ?? .76) + (radii[b.element] ?? .76) + .42) continue;
    const middle = a.p.clone().add(b.p).multiplyScalar(.5);
    molecules.add(cylinderBetween(a.p, middle, .17, materialFor(a.element)), cylinderBetween(middle, b.p, .17, materialFor(b.element)));
  }
  return group;
}
