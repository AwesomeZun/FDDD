import fs from 'node:fs';
import crypto from 'node:crypto';
import {WORLD_UNITS_PER_ANGSTROM,molecularGeometry} from '../src/lib/molecularScale.ts';
const source=JSON.parse(fs.readFileSync('public/data/docking/multi-target.json','utf8'));
const targets=source.targets.map(t=>{const receptorUrl=t.displayReceptorPdbqt??t.receptorPdbqt;const raw=fs.readFileSync('public'+receptorUrl);return {targetId:t.id,receptorUrl,sha256:crypto.createHash('sha256').update(raw).digest('hex'),...molecularGeometry(raw.toString())};});
fs.writeFileSync('public/data/docking/structure-scale.json',JSON.stringify({schemaVersion:'fddd-shared-molecular-scale-v1',coordinateUnit:'angstrom',worldUnitsPerAngstrom:WORLD_UNITS_PER_ANGSTROM,targets,notes:['All receptor and ligand coordinates share one global uniform scale.','Dimensions describe prepared structures, including all retained chains; not full-length protein size when the source is a domain.','Spherical radii enclose source receptor atoms and can guide authored navigation; they are not molecular surfaces or physical contact measurements.','Fly bodies are navigation avatars, not rendered to molecular physical scale.']},null,2));
console.log(JSON.stringify(targets,null,2));
