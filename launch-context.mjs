// Presentation context never grants access; the host session or existing device token does that.
export function readLaunchContext(href){
 const url=new URL(href);
 const compact=url.searchParams.get('from')==='sharon';
 const view=url.searchParams.get('view')==='catalog'?'catalog':url.searchParams.get('view')==='collect'?'home':'lists';
 const catalogId=key=>{
  const id=url.searchParams.get(key);
  return compact&&view==='catalog'&&id&&/^[a-zA-Z0-9_-]{1,160}$/.test(id)?id:null;
 };
 return {compact,view,categoryId:catalogId('category'),collectionId:catalogId('collection'),
 hostOrigin:'https://stefan-van-dijk.github.io',
 returnUrl:'https://stefan-van-dijk.github.io/sharon/'};
}

// Only the two shopping modes are shared with the trusted embedding host.
export function publishHostView(view,win=globalThis.window){
 if(!win||win.parent===win||!readLaunchContext(win.location.href).compact)return false;
 const mode=view==='home'?'collect':view==='lists'?'check':null;if(!mode)return false;
 win.parent.postMessage({type:'shop:view',view:mode},readLaunchContext(win.location.href).hostOrigin);return true;
}
