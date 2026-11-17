import test from 'node:test';
import assert from 'node:assert/strict';
import {barcodePreferences,categoryProductIds,createLibraryId,displayCentralProduct,reachesCategory} from './product-library.mjs';
import {syncAccountCatalog} from './catalog-sync.mjs';

test('Source barcodes can be disabled and restored, while manual barcodes can be removed',()=>{
 const product={barcodes:['00123456','00876543'],packages:[{barcode:'00123456',source:'https://world.openfoodfacts.org/product/00123456'}]};
 assert.deepEqual(barcodePreferences(product,[],[]),{barcodes:[],disabledBarcodes:['00123456']});
 assert.deepEqual(barcodePreferences(product,[],['00123456']),{barcodes:['00123456'],disabledBarcodes:[]});
 assert.equal(product.packages.length,1);
});

test('An updated central product keeps its ID and uses the personal name and barcode settings',()=>{
 const id=createLibraryId();
 assert.match(id,/^[A-Za-z0-9_-]{12}$/);
 const p={id:'old-id',centralId:id,centralBarcode:'00123456',name:'Mijn melk',centralName:'Melk',barcodes:['00123456','00000000']};
 const central=new Map([[id,{id,name:'Volle melk',barcode:null}]]);
 const updated=displayCentralProduct(p,central);
 assert.equal(updated.name,'Mijn melk');
 assert.deepEqual(updated.barcodes,['00000000']);
 assert.equal(updated.id,'old-id');
 assert.equal(displayCentralProduct({...p,name:'Melk'},central).name,'Volle melk');
});

test('Nested categories show products once and a second device preserves personal placements and list entries',async()=>{
 const parent={id:'parent',name:'Boodschappen',entries:[{type:'category',id:'child'}]};
 const child={id:'child',name:'Ontbijt',entries:[{type:'product',id:'milk'}],collectionIds:['collection12']};
 const milk={id:'milk',name:'Melk',categoryId:'child',hidden:true,barcodes:[],centralId:createLibraryId()};
 const row={id:'row',productId:'milk',quantity:2,done:true,note:'Voor morgen'};
 const deviceA={categories:[parent,child],products:[milk],recipes:[],lists:[]};
 const deviceB={...structuredClone(deviceA),lists:[{id:'list',name:'Week',items:[row]}]};
 let remote={revision:0,payload:{categories:[],products:[],recipes:[]}};
 const api={catalog:async()=>({catalog:remote}),writeCatalog:async(payload,revision)=>{
  assert.equal(revision,remote.revision);remote={revision:revision+1,payload};return {catalog:remote};
 }};
 await syncAccountCatalog(deviceA,api,'person',()=>{});
 await syncAccountCatalog(deviceB,api,'person',()=>{});
 assert.equal(reachesCategory(deviceB.categories,'parent','child'),true);
 assert.deepEqual([...categoryProductIds(deviceB.categories,'parent',deviceB.products)],['milk']);
 assert.equal(deviceB.products[0].hidden,true);
 assert.deepEqual(deviceB.categories[1].collectionIds,['collection12']);
 assert.deepEqual(deviceB.lists[0].items,[row]);
});
