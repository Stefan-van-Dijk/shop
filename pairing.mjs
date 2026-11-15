export const PAIR_KEY='shop.sharon.device.v1';
export const ENDPOINT='https://sharon.life/log/api/connections.php';
const messages={pair_pending:'Bevestig de controlecode in Sharon en controleer daarna opnieuw.',pair_expired:'Deze koppelcode is verlopen. Maak in Sharon een nieuwe code.',pair_used:'Deze code is al gebruikt door een andere Shop.',unauthorized:'De verbinding is ingetrokken of ongeldig. Koppel opnieuw met Sharon.',unknown_action:'Het serverbestand connections.php moet worden bijgewerkt voor koppelen.',list_conflict:'De gedeelde lijst is gewijzigd. Haal de online versie op; je lokale wijzigingen blijven bewaard.',list_forbidden:'Je hebt geen toegang meer tot deze boodschappenlijst.',list_read_only:'Je mag deze boodschappenlijst alleen bekijken.'};
export function parsePairCode(value){const m=/^SP1\.([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/.exec(String(value).trim());if(!m)throw Error('Plak de volledige tijdelijke koppelcode uit Sharon.');return {id:m[1],code:m[2]};}
function token(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export class ShopIdentity {
 constructor(storage=globalThis.localStorage,fetcher=(...args)=>fetch(...args)){this.storage=storage;this.fetcher=fetcher;}
 saved(){try{return JSON.parse(this.storage.getItem(PAIR_KEY)||'null');}catch{return null;}}
 async request(action,input={},credential=this.saved()?.token){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await this.fetcher(ENDPOINT,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'application/json',...(credential?{'X-Log-Access-Token':credential}:{})},body:JSON.stringify({protocol:'sharon-network-v1',action,...input})});const data=await response.json();if(!response.ok)throw Error(messages[data.error]||'De verbinding kon niet worden uitgevoerd. Je lokale lijsten blijven bewaard.');return data;}catch(e){if(e.name==='AbortError'||e.name==='TypeError')throw Error('Sharon is niet bereikbaar. Je lokale lijsten blijven bewaard.');throw e;}finally{clearTimeout(timer);}
 }
 async probe(value){if(!/^[A-Za-z0-9_-]{12}$/.test(value))return false;return (await this.request('shop-pair-probe',{code:value},null)).valid===true;}
 async redeem(code){
  if(!/^[A-Za-z0-9_-]{12}$/.test(code))throw Error('Geen geldige koppelcode.');
  let saved=this.saved();if(saved?.confirmed)throw Error('Shop is al gekoppeld.');
  // Persist the device key before contacting the server. Never persist clipboard text.
  if(!saved?.compact){saved={token:token(),compact:true,confirmed:false};this.storage.setItem(PAIR_KEY,JSON.stringify(saved));}
  const result=await this.request('shop-pair-redeem',{code,deviceToken:saved.token},null);
  if(this.saved()?.token!==saved.token)throw Error('De koppeling is ondertussen gewijzigd.');
  this.storage.setItem(PAIR_KEY,JSON.stringify({...saved,id:result.id,self:result.self}));
  return this.check();
 }
 async claim(value){
  const code=parsePairCode(value);let saved=this.saved();
  if(saved?.confirmed)throw Error('Deze Shop is al verbonden. Verbreek eerst de bestaande verbinding.');
  if(saved?.id!==code.id){saved={id:code.id,token:token(),confirmed:false};this.storage.setItem(PAIR_KEY,JSON.stringify(saved));}
  const result=await this.request('shop-pair-claim',{...code,deviceToken:saved.token},null);if(this.saved()?.token!==saved.token)throw Error('De koppeling is ondertussen gewijzigd.');this.storage.setItem(PAIR_KEY,JSON.stringify({...saved,fingerprint:result.fingerprint}));return result;
 }
 async check(){const saved=this.saved();if(!saved?.token)throw Error('Shop werkt zelfstandig. Plak een koppelcode om Sharon te verbinden.');const result=await this.request('shop-device-self',{},saved.token);if(!result.self?.personId||!result.self?.name)throw Error('Ongeldig serverantwoord.');if(this.saved()?.token!==saved.token)throw Error('De koppeling is ondertussen gewijzigd.');if(result.needsAck||saved.compact){
   this.storage.setItem(PAIR_KEY,JSON.stringify({...saved,self:result.self}));
   await this.request('shop-device-ack',{},saved.token);
   if(this.saved()?.token!==saved.token)throw Error('De koppeling is ondertussen gewijzigd.');
  }
  this.storage.setItem(PAIR_KEY,JSON.stringify({...saved,confirmed:true,self:result.self}));return result.self;}
 forget(){this.storage.removeItem(PAIR_KEY);}
}
