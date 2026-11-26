import {validate} from './core.mjs';
const groups=['categories','products','recipes'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function catalogSnapshot(state){
 const categories=state.categories.filter(x=>!x.remoteId),cs=new Set(categories.map(x=>x.id));
 const products=state.products.filter(x=>!x.remoteId&&cs.has(x.categoryId)),ps=new Set(products.map(x=>x.id));
 const recipes=state.recipes.filter(x=>!x.remoteId&&cs.has(x.categoryId)&&x.ingredients.every(i=>ps.has(i.productId))),rs=new Set(recipes.map(x=>x.id));
 return structuredClone({categories:categories.map(c=>({...c,entries:c.entries.filter(e=>(e.type==='category'?cs:e.type==='product'?ps:rs).has(e.id))})),products,recipes});
}
function composeCatalog(state,personal){
 const current=catalogSnapshot(state);
 const combined=Object.fromEntries(groups.map(group=>{const ids=new Set(current[group].map(x=>x.id));return [group,[...state[group].filter(x=>!ids.has(x.id)),...personal[group]]];}));
 const personalIds={category:new Set(current.categories.map(x=>x.id)),product:new Set(current.products.map(x=>x.id)),recipe:new Set(current.recipes.map(x=>x.id))};
 const retained={category:new Set(combined.categories.map(x=>x.id)),product:new Set(combined.products.map(x=>x.id)),recipe:new Set(combined.recipes.map(x=>x.id))};
 combined.categories=combined.categories.map(category=>{
  const local=state.categories.find(x=>x.id===category.id);
  const extras=(local?.entries||[]).filter(e=>!personalIds[e.type]?.has(e.id)&&retained[e.type]?.has(e.id));
  return {...category,entries:[...category.entries,...extras.filter(e=>!category.entries.some(x=>x.type===e.type&&x.id===e.id))]};
 });
 return combined;
}
export function mergeCatalogChanges(base,local,remote){
 const result={};
 for(const group of groups){
  const b=new Map((base?.[group]||[]).map(x=>[x.id,x])),l=new Map(local[group].map(x=>[x.id,x])),r=new Map(remote[group].map(x=>[x.id,x]));
  result[group]=[];
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
   const before=b.get(id),left=l.get(id),right=r.get(id);
   if(!same(left,before)&&!same(right,before)&&!same(left,right))throw Error('Dezelfde catalogusgegevens zijn elders gewijzigd. Je lokale keuzes blijven bewaard.');
   const item=!same(left,before)?left:right;if(item)result[group].push(item);
  }
 }
 return result;
}
export async function syncAccountCatalog(state,api,personId,persist){
 if(!personId)throw Error('De gekoppelde identiteit ontbreekt.');
 let meta=state.catalogSync;
 if(meta&&meta.personId!==personId)throw Error('Deze catalogus hoort bij een andere identiteit. Je lokale gegevens blijven bewaard.');
 const before=catalogSnapshot(state),response=await api.catalog();
 const remote=response.catalog;
 // A read can confirm a write whose response never reached this device.
 const previousAttempt=meta?.pending;
 if(previousAttempt&&remote.operation===previousAttempt.operation&&same(remote.payload,previousAttempt.payload)){
  meta={personId,base:remote.payload,revision:remote.revision};
 }
 const merged=mergeCatalogChanges(meta?.base,before,remote.payload);
 validate({schemaVersion:1,...composeCatalog(state,merged),lists:state.lists||[]});
 let confirmed=remote;
 if(!same(merged,remote.payload)){
  const pending=meta?.pending?.revision===remote.revision&&same(meta.pending.payload,merged)
   ?meta.pending:{payload:merged,revision:remote.revision,operation:crypto.randomUUID()};
  state.catalogSync={...meta,personId,pending};await persist();
  confirmed=(await api.writeCatalog(pending.payload,pending.revision,pending.operation)).catalog;
 }
 // Rebase edits made while the request was in flight before applying the reply.
 const current=catalogSnapshot(state),next=mergeCatalogChanges(before,current,confirmed.payload);
 // Validate the whole local graph before changing any array. Remote deletion
 // must not orphan local lists, recipes or shared projections.
 const combined=composeCatalog(state,next);
 validate({schemaVersion:1,...combined,lists:state.lists||[]});
 for(const group of groups)state[group]=combined[group];
 state.catalogSync={personId,base:structuredClone(confirmed.payload),revision:confirmed.revision};await persist();
 return next;
}
