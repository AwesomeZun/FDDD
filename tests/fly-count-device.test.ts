import test from 'node:test';import assert from 'node:assert/strict';
import {MAX_FLY_COUNT,FLY_COUNT,FLY_COUNT_OPTIONS,flyCountForDevice,normalizeFlyCount,createFly} from '../src/lib/colonyPolicy.ts';
test('device-adaptive colony size: half the cores, clamped to 4..20, snapped to an option',()=>{
 assert.equal(FLY_COUNT,MAX_FLY_COUNT);assert.deepEqual([...FLY_COUNT_OPTIONS],[4,8,12,20]);
 assert.equal(flyCountForDevice(undefined),4);assert.equal(flyCountForDevice(2),4);assert.equal(flyCountForDevice(8),4);
 assert.equal(flyCountForDevice(10),4);assert.equal(flyCountForDevice(16),8);assert.equal(flyCountForDevice(24),12);
 assert.equal(flyCountForDevice(40),20);assert.equal(flyCountForDevice(128),20);
 assert.equal(normalizeFlyCount('12'),12);assert.equal(normalizeFlyCount('7'),null);assert.equal(normalizeFlyCount(null),null);
});
test('smaller colonies still spread initial destinations and keep distinct start positions',()=>{
 for(const n of FLY_COUNT_OPTIONS){const flies=Array.from({length:n},(_,i)=>createFly(i,8,n));assert.equal(new Set(flies.map(f=>f.position.join(','))).size,n);assert.ok(new Set(flies.map(f=>f.destination)).size>=Math.min(8,4));}
});
