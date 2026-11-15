// The clipboard is read only inside the explicit pairing menu click. Ordinary text
// never reaches the server or persistent storage; a probe cannot consume a code.
export class ClipboardPairing {
 constructor(identity,{read=()=>navigator.clipboard.readText(),show=()=>{},success=()=>{}}={}){Object.assign(this,{identity,read,show,success});this.code=null;this.busy=false;}
 async inspect(){
  if(this.busy)return;this.busy=true;
  try{
   if(this.identity.saved()?.confirmed){this.show(null);return;}
   if(this.identity.saved()?.compact&&this.identity.saved()?.self){try{const self=await this.identity.check();this.show(null);this.success(self);return;}catch(e){if(['pair_expired','unauthorized'].includes(e.code))this.identity.forget();throw e;}}
   // Call before the first await to preserve Safari's transient activation.
   const reading=this.read();const text=String(await reading).trim();this.code=null;
   if(!/^[A-Za-z0-9_-]{12}$/.test(text)){this.show(null);return;}
   if(await this.identity.probe(text)){this.code=text;this.show('Koppelen met Sharon');}
   else this.show(null);
  }catch(e){this.show('Koppelen met Sharon · klembord controleren',e.message);}
  finally{this.busy=false;}
 }
 async connect(){
  if(this.busy)return;
  if(this.identity.saved()?.confirmed){this.code=null;this.show(null);return;}
  if(!this.code){await this.inspect();if(!this.code)return;}
  this.busy=true;
  try{const self=await this.identity.redeem(this.code);this.code=null;this.show(null);this.success(self);}
  catch(e){this.show('Koppelen met Sharon · opnieuw proberen',e.message);}
  finally{this.busy=false;}
 }
}
