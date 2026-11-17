import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryTree,branchProducts} from './catalog-tree.mjs';
test('branches include descendants and repeated product references once',()=>{
 const state={categories:[{id:'a',name:'A',entries:[{type:'category',id:'b'},{type:'product',id:'p'}]},{id:'b',name:'B',entries:[{type:'product',id:'p'}]}],products:[{id:'p',categoryId:'b'},{id:'outside',categoryId:'c'}]};
 assert.deepEqual(branchProducts(state,'a').map(p=>p.id),['p']);
 const roots=categoryTree(state.categories);assert.equal(roots.length,1);assert.equal(roots[0].children[0].category.id,'b');
});
test('cycles terminate and imported remote categories are excluded',()=>{
 const cs=[{id:'a',name:'A',entries:[{type:'category',id:'b'}]},{id:'b',name:'B',entries:[{type:'category',id:'a'}]},{id:'r',name:'Remote',remoteId:'other',entries:[]}];
 const roots=categoryTree(cs);assert.equal(roots.length,1);assert.equal(roots[0].children[0].children.length,0);
 assert.deepEqual(branchProducts({categories:cs,products:[]},'a'),[]);
});
