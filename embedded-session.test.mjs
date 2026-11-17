import test from 'node:test';import assert from 'node:assert/strict';
import {EmbeddedSession,isEmbedded,SHARON_ORIGIN} from './embedded-session.mjs';
function fixture(){let receive;const sent=[];const parent={postMessage:(data,origin)=>sent.push({data,origin})};const win={parent,location:{href:SHARON_ORIGIN+'/shop/?from=sharon&account=me'},addEventListener:(_,fn)=>receive=fn,removeEventListener:()=>receive=null};return {win,sent,reply(data,origin=SHARON_ORIGIN,source=parent){receive?.({data,origin,source});}};}
test('Session connects via host without reading or replacing standalone credentials',async()=>{
 const f=fixture(),client=new EmbeddedSession(f.win);assert(isEmbedded(f.win));assert.equal(client.saved(),null);
 const ready=client.check();assert.equal(f.sent[0].origin,SHARON_ORIGIN);assert.equal(f.sent[0].data.action,'session');
 f.reply({type:'shop:response',requestId:'1',result:{self:{personId:'me'}}},'https://evil.example');assert.equal(client.saved(),null);
 f.reply({type:'shop:response',requestId:'1',result:{self:{personId:'me'}}});await ready;assert.equal(client.saved().confirmed,true);
 const read=client.api().read('chosen');assert.equal(f.sent[1].data.input.id,'chosen');f.reply({type:'shop:response',requestId:'2',result:{list:{id:'chosen'}}});assert.equal((await read).list.id,'chosen');client.dispose();
});
test('Session rejects account changes and preserves server error codes',async()=>{
 const f=fixture(),client=new EmbeddedSession(f.win);const ready=client.check();f.reply({type:'shop:response',requestId:'1',result:{self:{personId:'other'}}});await assert.rejects(ready,/identiteit is gewijzigd/);
 const write=client.api().write({list:{id:'chosen'}},1,'op');f.reply({type:'shop:response',requestId:'2',error:{message:'Conflict',code:'list_conflict'}});await assert.rejects(write,{code:'list_conflict'});client.dispose();
});
