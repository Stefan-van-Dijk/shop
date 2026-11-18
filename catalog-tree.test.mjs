import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryTree,branchProducts,listCategoryNames} from './catalog-tree.mjs';

test('A personal category change groups both list copies without changing the saved snapshots',()=>{
 const state={
  categories:[
   {id:'fruit',name:'Fruit'},
   {id:'shared-one-old',remoteId:'old',name:'Eerdere categorie'},
   {id:'shared-two-old',remoteId:'old',name:'Eerdere categorie'}
  ],
  products:[
   {id:'apple',categoryId:'fruit',centralId:'central-apple'},
   {id:'shared-one-apple',remoteId:'apple',categoryId:'shared-one-old'},
   {id:'shared-two-apple',remoteId:'another-apple',categoryId:'shared-two-old',centralId:'central-apple'}
  ]
 };
 const categoryName=listCategoryNames(state);
 assert.deepEqual(state.products.map(categoryName),['Fruit','Fruit','Fruit']);
 assert.equal(state.products[1].categoryId,'shared-one-old');
});
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
