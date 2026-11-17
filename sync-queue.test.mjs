import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyncQueue,flushBeforeReturn} from './sync-queue.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('A later edit during an upload is sent before the shared task completes',async()=>{
 const first=deferred(),second=deferred(),writes=[];let local='one',online='zero',busy=0,max=0;
 const queue=createSyncQueue(async()=>{busy++;max=Math.max(max,busy);const value=local;writes.push(value);await(writes.length===1?first.promise:second.promise);online=value;busy--;});
 const initial=queue.request();local='two';const subsequent=queue.request();assert.equal(initial,subsequent);
 first.resolve();await new Promise(r=>setTimeout(r,0));assert.deepEqual(writes,['one','two']);assert.equal(online,'one');
 second.resolve();await initial;assert.equal(online,'two');assert.equal(max,1);assert.equal(queue.current,null);
});
test('Return waits for the last queued edit, then permits the host to remove the frame',async()=>{
 const first=deferred(),last=deferred();let local=1,online=0,round=0,left=false;
 const queue=createSyncQueue(async()=>{const value=local;await(++round===1?first.promise:last.promise);online=value;});
 queue.request();local=2;queue.request();
 const closing=flushBeforeReturn({sync:()=>queue.request(),hasPending:()=>online!==local,leave:()=>{left=true;}});
 first.resolve();await new Promise(r=>setTimeout(r,0));assert.equal(left,false);last.resolve();await closing;assert.equal(left,true);assert.equal(online,2);
});
test('An unsuccessful save keeps the frame open and can be retried without dropping local changes',async()=>{
 let pending=true,left=false;
 const options={sync:async()=>{},hasPending:()=>pending,leave:()=>{left=true;}};
 await assert.rejects(flushBeforeReturn(options),/nog niet online opgeslagen/);assert.equal(left,false);assert.equal(pending,true);
 pending=false;await flushBeforeReturn(options);assert.equal(left,true);
});
test('A rejected sync resets the queue so a later request can recover',async()=>{
 let fail=true;const queue=createSyncQueue(async()=>{if(fail)throw Error('offline');});
 await assert.rejects(queue.request(),/offline/);assert.equal(queue.current,null);fail=false;await queue.request();
});
