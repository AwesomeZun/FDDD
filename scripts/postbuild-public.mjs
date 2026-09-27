// Runs after `vite build`. Removes local-only data that Vite copied from public/ into dist/ and adds the license notice file.
// The local assay server serves /data and /engine from public/, so pruning dist never affects local use.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const prune=['data/records','data/flywire','data/learning/training-spikes.bin'];
for(const rel of prune){const target=path.join(dist,rel);try{await fs.rm(target,{recursive:true,force:true});console.log('pruned dist/'+rel);}catch(e){console.warn('prune skipped',rel,String(e));}}
await fs.copyFile(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(dist,'THIRD_PARTY_NOTICES.txt'));
await fs.copyFile(path.join(root,'LICENSE'),path.join(dist,'LICENSE.txt'));
console.log('added dist/THIRD_PARTY_NOTICES.txt and dist/LICENSE.txt');
