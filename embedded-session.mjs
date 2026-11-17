export const SHARON_ORIGIN='https://stefan-van-dijk.github.io';
export function isEmbedded(win=globalThis.window){return !!win&&win.parent!==win&&new URL(win.location.href).searchParams.get('from')==='sharon';}
export class EmbeddedSession {
 constructor(win=window){this.win=win;this.self=null;this.pending=new Map();this.counter=0;
  this.receive=event=>{
   if(event.source!==win.parent||event.origin!==SHARON_ORIGIN||event.data?.type!=='shop:response')return;
   const item=this.pending.get(event.data.requestId);if(!item)return;this.pending.delete(event.data.requestId);clearTimeout(item.timer);
   if(event.data.error)item.reject(Object.assign(Error(event.data.error.message),{code:event.data.error.code}));else item.resolve(event.data.result);
  };win.addEventListener('message',this.receive);
 }
 request(action,input={}){return new Promise((resolve,reject)=>{
  const requestId=String(++this.counter),timer=setTimeout(()=>{this.pending.delete(requestId);reject(Error('Sharon reageert niet. Open Shop opnieuw vanuit Sharon.'));},20000);
  this.pending.set(requestId,{resolve,reject,timer});this.win.parent.postMessage({type:'shop:request',requestId,action,input},SHARON_ORIGIN);
 });}
 async check(){const result=await this.request('session');const account=new URL(this.win.location.href).searchParams.get('account');if(account&&account!==result.self?.personId)throw Error('De Sharon-identiteit is gewijzigd. Open Shop opnieuw.');this.self=result.self;return this.self;}
 saved(){return this.self?{confirmed:true,self:this.self}:null;}
 dispose(){this.win.removeEventListener('message',this.receive);for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error('Shop is gesloten.'));}this.pending.clear();}
 api(){return {library:(command,payload)=>this.request('library',{command,payload}),index:()=>this.request('index'),catalog:()=>this.request('catalog'),writeCatalog:(payload,revision,operation)=>this.request('writeCatalog',{payload,revision,operation}),read:id=>this.request('read',{id}),write:(payload,revision,operation,create=false)=>this.request('write',{id:payload.list.id,payload,revision,operation,create})};}
}
