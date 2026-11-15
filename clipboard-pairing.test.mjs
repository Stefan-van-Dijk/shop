import test from 'node:test';import assert from 'node:assert/strict';import {ClipboardPairing} from './clipboard-pairing.mjs';
test('Logo checks clipboard immediately, does not send ordinary text, and probe never redeems',async()=>{
 let read=false,probes=0,claims=0,value='private text';const shown=[];const id={saved:()=>null,probe:async()=>{probes++;return true;},redeem:async()=>{claims++;return {name:'Test'};}};
 const c=new ClipboardPairing(id,{read:()=>{read=true;return Promise.resolve(value);},show:x=>shown.push(x)});const p=c.inspect();assert.ok(read);await p;assert.equal(probes,0);assert.equal(shown.at(-1),null);value='abcdefghijkl';await c.inspect();assert.equal(probes,1);assert.equal(claims,0);await c.connect();assert.equal(claims,1);assert.equal(shown.at(-1),null);assert.equal(c.code,null);
});
test('Permission failure offers retry, connected installations do not read or replace identity',async()=>{
 let connected=false,reads=0;const shown=[];const c=new ClipboardPairing({saved:()=>connected?{confirmed:true}:null},{read:()=>{reads++;throw Error('permission');},show:x=>shown.push(x)});await c.inspect();assert.match(shown.at(-1),/klembord/);connected=true;await c.inspect();await c.connect();assert.equal(reads,1);assert.equal(shown.at(-1),null);
});
test('Failed redemption keeps retry item and never reports success',async()=>{
 let success=0;const shown=[];const c=new ClipboardPairing({saved:()=>null,probe:async()=>true,redeem:async()=>{throw Error('offline');}},{read:async()=>'abcdefghijkl',show:x=>shown.push(x),success:()=>success++});await c.inspect();await c.connect();assert.equal(success,0);assert.match(shown.at(-1),/opnieuw/);
});
