import {parentPort,workerData} from 'node:worker_threads';
globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);globalThis.importScripts=()=>{};globalThis.location={href:workerData.url};
const pending=[];parentPort.on('message',data=>{if(globalThis.onmessage)globalThis.onmessage({data});else pending.push(data)});
await import(workerData.url);for(const data of pending)globalThis.onmessage({data});
