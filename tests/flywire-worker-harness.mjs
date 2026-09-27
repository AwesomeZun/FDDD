import {parentPort} from 'node:worker_threads';
import fs from 'node:fs/promises';
const nativeFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>String(url).startsWith('/data/')?fs.readFile(new URL('../public'+url,import.meta.url)).then(bytes=>new Response(bytes)):nativeFetch(url,options);
globalThis.self={postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)};
await import('../public/engine/flywire/worker.js');
parentPort.on('message',data=>globalThis.self.onmessage({data}));
