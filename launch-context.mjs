// Presentation context never grants access; the existing device token does that.
export function readLaunchContext(href){
 const url=new URL(href);
 return {compact:url.searchParams.get('from')==='sharon',
 view:url.searchParams.get('view')==='collect'?'home':'lists',
 hostOrigin:'https://stefan-van-dijk.github.io',
 returnUrl:'https://stefan-van-dijk.github.io/sharon/'};
}
