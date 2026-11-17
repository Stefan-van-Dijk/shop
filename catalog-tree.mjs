// Categories reference products; walking a branch never duplicates them.
export function categoryTree(categories){
 const own=categories.filter(c=>!c.remoteId&&c.name!=='Home'),byId=new Map(own.map(c=>[c.id,c]));
 const children=new Set(own.flatMap(c=>c.entries.filter(e=>e.type==='category'&&byId.has(e.id)).map(e=>e.id)));
 const reached=new Set();
 const visit=(c,path)=>{if(path.has(c.id))return null;reached.add(c.id);const next=new Set([...path,c.id]);return {category:c,children:c.entries.filter(e=>e.type==='category').map(e=>byId.get(e.id)).filter(Boolean).map(child=>visit(child,next)).filter(Boolean)};};
 const roots=own.filter(c=>!children.has(c.id)).map(c=>visit(c,new Set()));
 for(const c of own)if(!reached.has(c.id))roots.push(visit(c,new Set()));
 return roots;
}
export function branchProducts(state,id){
 const categories=new Map(state.categories.map(c=>[c.id,c])),seen=new Set(),products=new Set(),todo=[id];
 while(todo.length){const key=todo.pop(),c=categories.get(key);if(!c||seen.has(key))continue;seen.add(key);for(const e of c.entries){if(e.type==='category')todo.push(e.id);if(e.type==='product')products.add(e.id);}}
 return state.products.filter(p=>!p.remoteId&&(seen.has(p.categoryId)||products.has(p.id)));
}
