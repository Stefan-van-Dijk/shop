import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopIdentity,parsePairCode,PAIR_KEY,ENDPOINT} from './pairing.mjs';
const code='SP1.abcdefghijkl.'+'a'.repeat(43);
function storage(){const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('Pairing stores its own key before the claim and reuses it after a lost response',async()=>{
 const store=storage(),calls=[];const service=new ShopIdentity(store,async(url,options)=>{assert.equal(url,ENDPOINT);assert.equal(options.credentials,'omit');assert.ok(store.getItem(PAIR_KEY));assert.equal(options.headers['X-Log-Access-Token'],undefined);calls.push(JSON.parse(options.body));if(calls.length===1)throw new TypeError('lost');return {ok:true,json:async()=>({status:'claimed',fingerprint:'12345678'})};});
 await assert.rejects(service.claim(code));await service.claim(code);assert.equal(calls[0].deviceToken,calls[1].deviceToken);assert.equal(service.saved().confirmed,false);assert.equal(store.getItem(PAIR_KEY).includes('a'.repeat(43)),false);
});
test('Pairing never sends a claim if saving the local credential fails',async()=>{
 let sent=false;const service=new ShopIdentity({getItem:()=>null,setItem:()=>{throw Error('storage');}},async()=>{sent=true;});await assert.rejects(service.claim(code));assert.equal(sent,false);
});
test('Only a server-confirmed identity is marked connected; forget preserves other storage',async()=>{
 const store=storage();store.setItem('bs.app.v1','private lists');store.setItem(PAIR_KEY,JSON.stringify({id:'abcdefghijkl',token:'b'.repeat(43)}));let ok=false;
 const service=new ShopIdentity(store,async(url,o)=>{assert.equal(o.headers['X-Log-Access-Token'],'b'.repeat(43));return {ok,json:async()=>ok?{self:{personId:'abcdefghijkl',name:'Test'}}:{error:'pair_pending'}};});await assert.rejects(service.check());assert.ok(!service.saved().confirmed);ok=true;await service.check();assert.equal(service.saved().confirmed,true);await assert.rejects(service.claim(code));service.forget();assert.equal(store.getItem('bs.app.v1'),'private lists');
});
test('Pair codes accept only the fixed format, never a supplied endpoint',()=>{assert.equal(parsePairCode(' '+code+' ').id,'abcdefghijkl');assert.throws(()=>parsePairCode('https://example.org/'+code));});
test('A late verification cannot restore a disconnected identity',async()=>{
 const store=storage();store.setItem(PAIR_KEY,JSON.stringify({id:'abcdefghijkl',token:'b'.repeat(43)}));let complete;const service=new ShopIdentity(store,()=>new Promise(r=>{complete=r;}));const pending=service.check();service.forget();complete({ok:true,json:async()=>({self:{personId:'abcdefghijkl',name:'Old'}})});await assert.rejects(pending,/ondertussen gewijzigd/);assert.equal(service.saved(),null);
});
test('Compact pairing acknowledges durable local storage before reporting connected',async()=>{
 const store=storage(),actions=[];const service=new ShopIdentity(store,async(u,o)=>{const body=JSON.parse(o.body);actions.push(body.action);if(body.action==='shop-pair-redeem')return {ok:true,json:async()=>({id:'device',self:{personId:'abcdefghijkl',name:'Test'}})};if(body.action==='shop-device-self')return {ok:true,json:async()=>({self:{personId:'abcdefghijkl',name:'Test'},needsAck:true})};assert.equal(service.saved().self.name,'Test');assert.equal(service.saved().confirmed,false);return {ok:true,json:async()=>({ok:true})};});await service.redeem('abcdefghijkl');assert.deepEqual(actions,['shop-pair-redeem','shop-device-self','shop-device-ack']);assert.equal(service.saved().confirmed,true);
});
