import test from 'node:test';
import assert from 'node:assert/strict';
import {percentile,benchmarkCandidates} from '../src/design-studio/benchmark.ts';
test('render benchmark quantiles are deterministic and do not mutate samples',()=>{
 const values=[4,1,3,2];assert.equal(percentile(values,.5),2.5);assert.equal(percentile(values,.25),1.75);assert.equal(percentile(values,.75),3.25);assert.deepEqual(values,[4,1,3,2]);assert.equal(percentile([7],.5),7);assert.throws(()=>percentile([],.5),/Empty/);
});
test('render benchmark refuses to fabricate browser timings in Node',async()=>{
 await assert.rejects(benchmarkCandidates(),/WebGL browser/);
});
