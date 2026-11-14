import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeCatalog,validate,importOverview} from './core.mjs';
import {publicCatalog} from './scripts/public-catalog.mjs';
const catalog=JSON.parse(readFileSync(new URL('./data/catalog.json',import.meta.url)));
test('Public installation contains only an empty starting category',()=>{
 validate(catalog);assert.deepEqual(catalog,publicCatalog());
 for(const field of ['products','recipes','lists','sourceFiles'])assert.deepEqual(catalog[field],[]);
});
test('Empty public catalog never overwrites personal products, lists or notes',()=>{
 const state={schemaVersion:1,...importOverview('Home (c);Fruit (c)\nFruit (c);Appels (x)'),lists:[]};
 state.products[0].barcodes=['123'];state.lists=[{id:'mine',name:'My list',items:[{id:'line',productId:state.products[0].id,quantity:3,note:'Personal note',done:true}]}];
 const before=structuredClone(state),next=mergeCatalog(state,catalog);
 assert.deepEqual(next.products,before.products);assert.deepEqual(next.lists,before.lists);assert.deepEqual(state,before);validate(next);assert.deepEqual(mergeCatalog(next,catalog),next);
});
test('Publication rejects populated catalog',()=>{
 const privateData={...catalog,lists:[{id:'private',name:'Personal',items:[]}]};
 assert.notDeepEqual(privateData,publicCatalog(privateData));
});
