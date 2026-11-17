// Presentation context never grants access; the host session or existing device token does that.
export function readLaunchContext(href){
 const url=new URL(href);
 return {compact:url.searchParams.get('from')==='sharon',
 view:url.searchParams.get('view')==='collect'?'home':'lists',
 hostOrigin:'https://stefan-van-dijk.github.io',
 returnUrl:'https://stefan-van-dijk.github.io/sharon/'};
}

// Only the two shopping modes are shared with the trusted embedding host.
export function publishHostView(view,win=globalThis.window){
 if(!win||win.parent===win||!readLaunchContext(win.location.href).compact)return false;
 const mode=view==='home'?'collect':view==='lists'?'check':null;if(!mode)return false;
 win.parent.postMessage({type:'shop:view',view:mode},readLaunchContext(win.location.href).hostOrigin);return true;
}
