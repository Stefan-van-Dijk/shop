import test from 'node:test';import assert from 'node:assert/strict';
import {snapshot,installSnapshot} from './sharon.mjs';import {validate} from './core.mjs';
test('Shared lists roundtrip without exposing cloud metadata or rewriting personal products',()=>{
 const state={schemaVersion:1,products:[{id:'p',name:'Melk',categoryId:'c',barcodes:['12345678']}],categories:[{id:'c',name:'Zuivel',entries:[]}],recipes:[],lists:[{id:'l',name:'Samen',items:[{id:'i',productId:'p',quantity:6,note:'',done:true,scannedCodes:Array(6).fill('12345678')}],cloud:{role:'owner',revision:1}}]};
 const payload=snapshot(state,state.lists[0]);assert.equal(payload.list.cloud,undefined);
 const receiver=structuredClone(state);receiver.products[0].name='Eigen melk';receiver.lists=[];
 const incoming=installSnapshot(receiver,payload,{revision:1,base:JSON.stringify(payload)});validate(receiver);
 assert.equal(receiver.products[0].name,'Eigen melk');assert.equal(incoming.items[0].scannedCodes.length,6);
 assert.deepEqual(snapshot(receiver,incoming),payload);
 installSnapshot(receiver,payload,{revision:2});assert.equal(receiver.products.length,2);
});

test('authoritative category narrowing prunes unused shared projections while retaining independent references',()=>{
 const state={categories:[{id:'shared-shared-custom',name:'Eigen categorie'}],products:[{id:'shared-shared-custom-product',name:'Eigen product',categoryId:'shared-shared-custom'}],recipes:[],lists:[]};
 const payload={list:{id:'shared',name:'Weekend',items:[{id:'a',productId:'a'},{id:'b',productId:'b'}]},categories:[{id:'fruit',name:'Fruit'},{id:'bread',name:'Brood'}],products:[{id:'a',name:'Appel',categoryId:'fruit'},{id:'b',name:'Brood',categoryId:'bread'}]};
 installSnapshot(state,payload,{role:'write'});
 const narrow={list:{...payload.list,items:[payload.list.items[0]]},categories:[payload.categories[0]],products:[payload.products[0]]};
 state.lists.push({id:'own',name:'Eigen',items:[{productId:'shared-shared-b'}]});
 installSnapshot(state,narrow,{role:'read'});assert(state.products.some(p=>p.id==='shared-shared-b'));
 state.lists=state.lists.filter(l=>l.id!=='own');installSnapshot(state,narrow,{role:'read'});
 assert.equal(state.products.some(p=>p.id==='shared-shared-b'),false);assert.equal(state.categories.some(c=>c.id==='shared-shared-bread'),false);assert(state.products.some(p=>p.id==='shared-shared-custom-product'));assert(state.categories.some(c=>c.id==='shared-shared-custom'));
});
