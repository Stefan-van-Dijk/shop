import test from 'node:test';import assert from 'node:assert/strict';
import {mergeCatalogChanges,syncAccountCatalog} from './catalog-sync.mjs';
const empty=()=>({categories:[],products:[],recipes:[]});
test('catalog merge retains independent changes and rejects same-record collisions',()=>{
 const b=empty(),l={...b,products:[{id:'a',name:'A'}]},r={...b,products:[{id:'b',name:'B'}]};
 assert.equal(mergeCatalogChanges(b,l,r).products.length,2);
 assert.throws(()=>mergeCatalogChanges(b,l,{...b,products:[{id:'a',name:'Other'}]}),/elders gewijzigd/);
});
test('account catalog uploads activities and survives lost response without deleting local edits',async()=>{
 const state={...empty(),categories:[{id:'c',name:'C',entries:[]}],recipes:[{id:'a',kind:'activity',name:'Trip',categoryId:'c',ingredients:[]}]},saved=[];let remote={revision:0,payload:empty()},lose=true;
 const api={catalog:async()=>structuredClone({catalog:remote}),writeCatalog:async(payload,revision,operation)=>{remote={payload,revision:revision+1,operation};if(lose){lose=false;throw Error('lost');}return {catalog:remote};}};
 await assert.rejects(syncAccountCatalog(state,api,'person',()=>saved.push(structuredClone(state))));
 assert(state.catalogSync.pending);await syncAccountCatalog(state,api,'person',()=>{});
 assert.equal(state.catalogSync.revision,1);assert.equal(state.recipes[0].kind,'activity');
 await assert.rejects(syncAccountCatalog(state,api,'other',()=>{}),/andere identiteit/);
});
test('remote changes preserve edits made while awaiting the request',async()=>{
 const state={...empty(),categories:[{id:'c',name:'C',entries:[]}]};let finish;const promise=new Promise(r=>finish=r);
 const work=syncAccountCatalog(state,{catalog:()=>promise},'person',()=>{});
 state.products.push({id:'local',name:'New',categoryId:'c',barcodes:[]});finish({catalog:{revision:2,payload:{...empty(),categories:[{id:'c',name:'C',entries:[]}],products:[{id:'remote',name:'Remote',categoryId:'c',barcodes:[]}]}}});
 await work;assert.deepEqual(state.products.map(p=>p.id),['local','remote']);
});

test('remote deletion cannot orphan a local list and shared projections retain their identity',async()=>{
 const payload={categories:[{id:'c',name:'C',entries:[]}],products:[{id:'shared-p',name:'P',categoryId:'c',barcodes:[]}],recipes:[]};
 const state={...structuredClone(payload),lists:[{id:'l',name:'L',items:[{id:'i',productId:'shared-p',quantity:1,done:false,note:''}]}],catalogSync:{personId:'person',base:structuredClone(payload),revision:1}};
 const original=structuredClone(state);
 await assert.rejects(syncAccountCatalog(state,{catalog:async()=>({catalog:{revision:2,payload:{...payload,products:[]}}})},'person',()=>{}));
 assert.deepEqual(state,original);
 await syncAccountCatalog(state,{catalog:async()=>({catalog:{revision:1,payload}})},'person',()=>{});
 assert.equal(state.products[0].id,'shared-p');
});

test('shared catalog projections remain local and are not republished into personal catalog',async()=>{
 const state={categories:[{id:'shared-c',remoteId:'c',name:'Shared',entries:[]}],products:[{id:'shared-p',remoteId:'p',name:'P',categoryId:'shared-c',barcodes:[]}],recipes:[],lists:[]};
 await syncAccountCatalog(state,{catalog:async()=>({catalog:{revision:0,payload:empty()}}),writeCatalog:()=>assert.fail('must not upload shared projections')},'person',()=>{});
 assert.equal(state.products[0].remoteId,'p');assert.equal(state.catalogSync.base.products.length,0);
});

test('personal category preserves local menu entries into shared content while upload stays personal',async()=>{
 const state={categories:[{id:'c',name:'C',entries:[{type:'product',id:'shared-p'},{type:'recipe',id:'r'}]}],products:[{id:'shared-p',remoteId:'p',name:'Shared P',categoryId:'c',barcodes:[]}],recipes:[{id:'r',name:'Trip',kind:'activity',categoryId:'c',ingredients:[{productId:'shared-p',quantity:1,note:''}]}],lists:[]};
 let uploaded;
 await syncAccountCatalog(state,{catalog:async()=>({catalog:{revision:0,payload:empty()}}),writeCatalog:async payload=>{uploaded=structuredClone(payload);return {catalog:{revision:1,payload}};}},'person',()=>{});
 assert.deepEqual(uploaded.categories[0].entries,[]);assert.equal(uploaded.products.length,0);assert.equal(uploaded.recipes.length,0);
 assert.deepEqual(state.categories[0].entries,[{type:'product',id:'shared-p'},{type:'recipe',id:'r'}]);
 assert.equal(state.recipes[0].id,'r');
});
