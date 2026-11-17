import {ShopIdentity} from './pairing.mjs';
import {EmbeddedSession,isEmbedded} from './embedded-session.mjs?v=20261117-session';
export const embedded=isEmbedded();
export const identity=embedded?new EmbeddedSession():new ShopIdentity();
export async function connectSharon(){
 await identity.check();
 if(embedded)return identity.api();
 const credential=identity.saved().token;
 const request=(action,input={})=>{if(identity.saved()?.token!==credential)throw Error('De koppeling is ondertussen gewijzigd.');return identity.request(action,input,credential);};
 return {catalog:()=>request('shopcatalog-read'),writeCatalog:(payload,revision,operation)=>request('shopcatalog-put',{payload,revision,operation}),leave:id=>request('shoplist-leave',{id}),archive:(id,archived)=>request('shoplist-archive',{id,archived}),index:()=>request('shoplist-index'),read:id=>request('shoplist-read',{id}),write:(payload,revision=0,operation=crypto.randomUUID(),create=false)=>request(create?'shoplist-create':'shoplist-put',{id:payload.list.id,payload,revision,operation})};
}
export function snapshot(state,list){
 const source=[...new Set(list.items.map(i=>i.productId))].map(id=>state.products.find(p=>p.id===id));
 const products=source.map(p=>{const {remoteId,...rest}=p;return {...rest,id:remoteId||p.id,categoryId:state.categories.find(c=>c.id===p.categoryId)?.remoteId||p.categoryId};});
 const categoryIds=new Set(source.map(p=>p.categoryId));
 const categories=state.categories.filter(c=>categoryIds.has(c.id)).map(c=>({id:c.remoteId||c.id,name:c.name,entries:[]}));
 const {cloud,archived,...clean}=list;
 return {list:{...clean,items:clean.items.map(i=>({...i,productId:source.find(p=>p.id===i.productId)?.remoteId||i.productId}))},products,categories};
}
export function installSnapshot(state,payload,cloud){
 const {list,products,categories}=payload;
 const prefix='shared-'+list.id+'-';
 const categoryMap=new Map(categories.map(c=>[c.id,prefix+c.id]));
 const productMap=new Map(products.map(p=>[p.id,prefix+p.id]));
 // Replace only records belonging to this list, never a personal catalogue item.
 for(const c of categories){const id=categoryMap.get(c.id),old=state.categories.find(x=>x.id===id);const row={...c,id,remoteId:c.id,entries:[]};if(old)Object.assign(old,row);else state.categories.push(row);}
 for(const p of products){const id=productMap.get(p.id),row={...p,id,remoteId:p.id,categoryId:categoryMap.get(p.categoryId)};const old=state.products.find(x=>x.id===id);if(old)Object.assign(old,row);else state.products.push(row);}
 const result={...list,items:list.items.map(i=>({...i,productId:productMap.get(i.productId)})),cloud};
 const index=state.lists.findIndex(l=>l.id===list.id);if(index<0)state.lists.push(result);else state.lists[index]=result;
 // Drop obsolete per-list projections after an authoritative refresh. Retain
 // anything still used by an independent list or a locally saved recipe.
 const usedProducts=new Set(state.lists.flatMap(l=>l.items.map(i=>i.productId)));
 for(const recipe of state.recipes||[])for(const item of recipe.ingredients)usedProducts.add(item.productId);
 const currentProducts=new Set(productMap.values()),currentCategories=new Set(categoryMap.values());
 state.products=state.products.filter(p=>!p.remoteId||p.id!==prefix+p.remoteId||currentProducts.has(p.id)||usedProducts.has(p.id));
 const usedCategories=new Set(state.products.map(p=>p.categoryId));
 for(const recipe of state.recipes||[])usedCategories.add(recipe.categoryId);
 state.categories=state.categories.filter(c=>!c.remoteId||c.id!==prefix+c.remoteId||currentCategories.has(c.id)||usedCategories.has(c.id));
 return result;
}
