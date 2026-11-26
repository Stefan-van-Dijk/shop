import {categoryTree,branchProducts,listCategoryNames} from './catalog-tree.mjs?v=20261118-category-board';
import {sharonLogoMarkup} from './brand.mjs?v=20261117-catalog';
import {openSourceBarcodes,barcodePreferences,categoryProductIds,reachesCategory,displayCentralProduct} from './product-library.mjs?v=20261117-products';
import {createSyncQueue,flushBeforeReturn} from './sync-queue.mjs?v=20261117-sync-return';
import {readLaunchContext,publishHostView} from './launch-context.mjs?v=20261118-category-board';
import {fetchSelectedList} from './selected-list.mjs?v=20261117-session';
import {syncAccountCatalog,catalogSnapshot} from './catalog-sync.mjs?v=20261116-account-catalog';
import {ClipboardPairing} from './clipboard-pairing.mjs?v=20261115-list-lifecycle';
import {listSyncStatus} from './sync-status.mjs?v=20261115-list-lifecycle';
import {connectSharon,identity,embedded,snapshot,installSnapshot} from './sharon.mjs?v=20261117-product-library';
import {norm,uid,importOverview,addItem,validate,mergeCatalog,productQuantity,decreaseProduct,removeCategoryCycles,createBeepGate,barcodeFormat,findBeepProfile,saveBeepProfile,markScannedLine,addPickedExtra,importShoppingList,importListFile,fuzzyMatch,mergeProductVariants,similarProductPairs} from './core.mjs?v=20261117-products';
const $=s=>document.querySelector(s), el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const launch=readLaunchContext(location.href);
if(launch.compact){document.body.classList.add('from-sharon');const back=el('button',undefined,'quiet sharonReturn');back.id='returnSharon';back.type='button';back.setAttribute('aria-label','Terug naar Sharon');back.title='Terug naar Sharon';back.innerHTML=sharonLogoMarkup();back.onclick=()=>returnToSharon();document.querySelector('header').prepend(back);const title=el('strong');title.id='contextTitle';$('#activeListSelect').after(title);const create=el('button','Nieuwe lijst','secondary');create.onclick=()=>{closeMenu();$('#newList').click();};$('#appMenu').prepend(create);}
if(launch.compact){
 const brand=document.querySelector('header .brand'),wrap=el('div',undefined,'shopMenuAnchor'),trigger=el('button','ShopList','brand');
 trigger.id='shopMenuBrand';trigger.type='button';trigger.setAttribute('aria-label','ShopList-menu openen');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','appMenu');
 brand.replaceWith(wrap);wrap.append(trigger,$('#appMenu'));
}
if(embedded)document.body.classList.add('is-embedded');
let launchPending=launch.compact&&new URLSearchParams(location.search).has('shoplist');
if(launchPending)document.querySelector('main').inert=true;
let catalogSelection=launch.categoryId||'',catalogQuery='';
let cloudBusy=false,catalogError='',openingList=false,returningToSharon=false,catalogLoading=false,pairingLoading=false;
const cloudQueue=createSyncQueue(runCloudSync);
let homeSection='mylist',productCategory='',homeFilter='needed';const KEY=embedded?'shop.embedded.v1:'+(new URLSearchParams(location.search).get('account')||'unknown')+':'+(new URLSearchParams(location.search).get('shoplist')||'new'):'bs.app.v1';let state={schemaVersion:1,categories:[],products:[],recipes:[],lists:embedded?[]:[{id:uid(),name:'Deze week',items:[]}]},activeList,view='home',path=[],saveBlocked=false,stopCamera=()=>{};
try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}catch{saveBlocked=true;$('#saveStatus').textContent='Opgeslagen gegevens konden niet worden gelezen. Exporteer eerst je oorspronkelijke back-up.';}
removeCategoryCycles(state.categories);const expanded=new Set();activeList=state.lists.find(l=>l.id===state.activeListId)?.id||state.lists[0]?.id;let timer;
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('#toast').style.display='none',3600);}
function save(){state.centralProductCache=[...centralProducts.values()];state.activeListId=activeList;removeCategoryCycles(state.categories);if(saveBlocked){toast('Opslaan geblokkeerd: herstel eerst een geldige back-up.');return false;}try{markCloudChanges();state.activeListId=activeList;localStorage.setItem(KEY,JSON.stringify(state));$('#saveStatus').textContent='Lokaal bewaard in deze browser';updateCloudStatus();queueMicrotask(()=>syncCloud());return true;}catch{$('#saveStatus').textContent='Opslaan mislukt — maak nu een back-up.';toast('Opslag vol of niet beschikbaar. Maak een back-up.');return false;}}
const centralProducts=new Map((Array.isArray(state.centralProductCache)?state.centralProductCache:[]).filter(p=>p&&typeof p.id==='string').map(p=>[p.id,p]));
const conflictingBarcodes=new Set();
let sharedCollections=[];
const rawProduct=id=>state.products.find(p=>p.id===id);
const list=()=>state.lists.find(l=>l.id===activeList),prod=id=>{
 const item=rawProduct(id);
 return item && displayCentralProduct(item,centralProducts);
},cat=id=>state.categories.find(c=>c.id===id);
function btn(text,fn,cls='secondary'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
function field(label,type,value=''){const l=el('label',label,'field'),input=el('input');input.type=type;input.value=value;l.append(input);$('#modalBody').append(l);return input;}
function categoryField(value){const l=el('label','Categorie','field'),s=el('select');for(const c of state.categories.filter(c=>c.name!=='Home')){const o=el('option',c.name);o.value=c.id;s.append(o);}s.value=value||s.options[0]?.value||'';l.append(s);$('#modalBody').append(l);return s;}
function openModal(title,build,onSubmit,action='Bewaren'){$('#modalTitle').textContent=title;$('#modalBody').replaceChildren();$('#modalSave').textContent=action;build();$('#modalForm').onsubmit=e=>{e.preventDefault();try{if(onSubmit()!==false)closeModal();}catch(err){toast(err.message);}};$('#modal').showModal();}
function closeModal(){stopDeck();stopCamera();$('#modal').close();}
$('#closeModal').onclick=closeModal;$('#modal').addEventListener('close',()=>{stopCamera();stopDeck();});$('#modal').addEventListener('cancel',()=>{stopCamera();stopDeck();});
function closeMenu(){$('#appMenu').hidden=true;$('#manageLogo').setAttribute('aria-expanded','false');$('#shopMenuBrand')?.setAttribute('aria-expanded','false');}
function switchView(v){closeMenu();view=v;$('#contextNew').hidden=!launch.compact&&v==='lists';for(const id of ['home','lists','manage','catalog'])$('#'+id).hidden=id!==v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));render();if(!launchPending)publishHostView(v);}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
function render(){
 renderContext();
 $('#welcome').hidden=state.products.length>0||view!=='shop';$('#count').textContent=list()?.items.filter(i=>!i.done).length||0;
 const sel=$('#listSelect');sel.replaceChildren();state.lists.filter(l=>!l.archived).forEach(l=>{const o=el('option',l.name);o.value=l.id;sel.append(o);});sel.value=activeList||'';
 if(view==='home')renderHome();if(view==='lists')renderList($('#listRows'),$('#onlyNeeded').checked);if(view==='manage')renderManage();if(view==='catalog')renderCatalog();
}
function ensureList(){if(!list()){const l={id:uid(),name:'Boodschappen',items:[]};state.lists.push(l);activeList=l.id;}}
function refreshQuantities(){
 document.querySelectorAll('.productLine').forEach(row=>{const amount=productQuantity(list(),row.dataset.productId);row.querySelector('output').textContent=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3}).format(amount);row.querySelector('.minus').disabled=amount<=0;row.classList.toggle('selected',amount>0);});
 renderContext();
}
function quickAdd(p){ensureList();addItem(list(),p.id);save();if(view==='home'&&homeSection==='mylist')renderHome();else refreshQuantities();}
function hold(element,action,accept=()=>true){
 let timer,start,suppress=false;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 element.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||!accept(e))return;suppress=false;start=[e.clientX,e.clientY];timer=setTimeout(()=>{timer=null;suppress=true;action();},500);});
 element.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>10)cancel();});
 for(const event of ['pointerup','pointercancel','pointerleave'])element.addEventListener(event,cancel);
 element.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
 element.addEventListener('contextmenu',e=>e.preventDefault());
}
function swipeAction(row,action){
 let start=null,suppress=false;
 row.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||e.target.closest('input,select,.minus'))return;start=[e.clientX,e.clientY];suppress=false;});
 row.addEventListener('pointermove',e=>{if(start&&Math.abs(e.clientY-start[1])>30)start=null;});
 row.addEventListener('pointerup',e=>{if(start&&Math.abs(e.clientX-start[0])>=65&&Math.abs(e.clientY-start[1])<30){suppress=true;action();}start=null;});
 row.addEventListener('pointercancel',()=>start=null);row.addEventListener('pointerleave',()=>start=null);
 row.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
}
function chooseProduct(p,item){
 item=item||list()?.items.find(i=>i.productId===p.id&&!i.done);let quantity,note;
 openModal(p.name,()=>{quantity=field('Aantal','number',String(item?.quantity||1));quantity.min='0.01';quantity.step='any';note=field('Notitie (optioneel)','text',item?.note||'');$('#modalBody').append(btn('Productgegevens bewerken',()=>{closeModal();editProduct(p);},'quiet'));},()=>{
 const amount=Number(quantity.value);if(!Number.isFinite(amount)||amount<=0)throw Error('Vul een positief aantal in.');
 if(item){item.quantity=amount;item.note=note.value.trim();}else{ensureList();addItem(list(),p.id,amount,note.value.trim());}save();render();
 },item?'Bewaren':'Toevoegen');
}
function chooseRecipe(r){let checks=[];openModal(r.name,()=>{if(!r.ingredients.length){$('#modalBody').append(el('p','Dit gerecht heeft nog geen ingrediënten. Vul het aan via Beheren.'));return;}
 $('#modalBody').append(el('p','Vink uit wat je al in huis hebt. Hoeveelheden in productnamen blijven letterlijk behouden.'));
 r.ingredients.forEach(i=>{const l=el('label',undefined,'checkrow'),c=el('input');c.type='checkbox';c.checked=true;l.append(c,el('span',`${i.quantity} × ${prod(i.productId)?.name}${i.note?' · '+i.note:''}`));$('#modalBody').append(l);checks.push([c,i]);});},()=>{ensureList();let n=0;checks.forEach(([c,i])=>{if(c.checked){addItem(list(),i.productId,i.quantity,i.note);n++;}});save();render();toast(n+' ingrediënten toegevoegd');},'Selectie toevoegen');}
function renderList(target=$('#listRows'),neededOnly=false){target.replaceChildren();const l=list();$('#progress').textContent=l?`${l.items.filter(i=>i.done).length} van ${l.items.length} afgevinkt`: 'Maak een lijst om te beginnen.';if(!l?.items.length){$('#shoppingProgress').textContent='0 / 0';target.append(el('p','Nog niets op je lijst. Voeg producten toe bij Verzamelen.','empty'));return;}
 const groups=new Map(),categoryName=listCategoryNames(state);$('#shoppingProgress').textContent=l.items.filter(i=>i.done).length+' / '+l.items.length;if(neededOnly&&l.items.every(i=>i.done)){target.append(el('p','Alles in de tas. Goed geregeld!','empty success'));return;}for(const item of l.items.filter(i=>(!neededOnly||!i.done)&&matchesProduct(prod(i.productId),$('#listSearch').value,i.note))){const name=categoryName(rawProduct(item.productId));if(!groups.has(name))groups.set(name,[]);groups.get(name).push(item);}
 for(const [name,items]of [...groups].sort(([a],[b])=>a.localeCompare(b,'nl'))){target.append(el('h3',name,'sectionLabel'));items.forEach(i=>{const row=el('div',undefined,'row'+(i.done?' done':'')),check=el('input');row.dataset.listItem=i.id;check.type='checkbox';check.checked=i.done;check.setAttribute('aria-label',prod(i.productId).name+' afvinken');const setDone=value=>{i.done=value;check.checked=value;row.classList.toggle('done',value);if(value&&!i.purchaseRecorded){i.purchaseRecorded=true;const p=prod(i.productId);p.purchaseCount=(p.purchaseCount||0)+1;p.lastPurchased=Date.now();}save();renderContext();$('#progress').textContent=`${l.items.filter(item=>item.done).length} van ${l.items.length} afgevinkt`;$('#shoppingProgress').textContent=l.items.filter(item=>item.done).length+' / '+l.items.length;};check.onchange=()=>setDone(check.checked);const text=btn('',()=>setDone(!i.done),'text');text.setAttribute('aria-label',prod(i.productId).name+' afvinken of terugzetten');text.append(el('strong',prod(i.productId).name));if(i.note)text.append(el('small',i.note));const qty=el('span',i.quantity+' ×','listQuantity');qty.setAttribute('aria-label','Aantal '+prod(i.productId).name);const remove=btn('×',()=>removeListItem(i,row),'quiet');remove.setAttribute('aria-label','Verwijder '+prod(i.productId).name);row.append(check,text,qty,remove);swipeAction(row,()=>setDone(!i.done));target.append(row);});}
}
$('#manageSearch').oninput=renderManage;$('#listSelect').onchange=e=>{activeList=e.target.value;save();render();};
$('#newList').onclick=()=>{let name;openModal('Nieuwe lijst',()=>name=field('Naam','text'),()=>{if(!name.value.trim())throw Error('Geef de lijst een naam.');const l={id:uid(),name:name.value.trim(),items:[]};state.lists.push(l);activeList=l.id;save();switchView('home');queueMicrotask(()=>syncCloud());});};
$('#renameList').onclick=()=>{if(!list())return;let name;openModal('Lijst hernoemen',()=>name=field('Naam','text',list().name),()=>{if(!name.value.trim())throw Error('Geef de lijst een naam.');list().name=name.value.trim();save();render();});};
$('#deleteList').onclick=$('#contextDelete').onclick=()=>{const removed=list();if(!removed)return;let busy=false;openModal('Lijst verwijderen',()=>$('#modalBody').append(el('p','“'+removed.name+'” uit jouw overzicht verwijderen? Andere deelnemers behouden toegang. De laatste deelnemer verwijdert de lijst volledig.')),()=>{if(busy)return false;busy=true;$('#modalSave').disabled=true;(async()=>{try{if(removed.cloud)await (await connectSharon()).leave(removed.id);else{state.deletedLists=state.deletedLists||[];state.deletedLists.push({...removed,deletedAt:Date.now()});}state.lists=state.lists.filter(l=>l.id!==removed.id);activeList=state.lists.find(l=>!l.archived)?.id;save();render();closeModal();}catch(e){toast(e.message);}finally{busy=false;$('#modalSave').disabled=false;}})();return false;},'Verwijderen');};
$('#restoreList').onclick=()=>{const removed=state.deletedLists?.pop();if(!removed){toast('Geen verwijderde lijst om terug te zetten.');return;}delete removed.deletedAt;state.lists.push(removed);activeList=removed.id;save();render();toast('Lijst teruggezet.');};
$('#findDuplicates').onclick=reviewSimilarProducts;

$('#clearDone').onclick=()=>{if(list()&&confirm('Alle afgevinkte regels verwijderen?')){list().items=list().items.filter(i=>!i.done);save();render();}};
$('#share').onclick=async()=>{if(!list())return;const text=list().name+'\n'+list().items.map(i=>`${i.done?'✓':'□'} ${i.quantity} × ${prod(i.productId).name}${i.note?' — '+i.note:''}`).join('\n');try{if(navigator.share)await navigator.share({title:list().name,text});else{await navigator.clipboard.writeText(text);toast('Lijst gekopieerd');}}catch(e){if(e.name!=='AbortError'){openModal('Kopieer je lijst',()=>{const t=el('textarea');t.value=text;$('#modalBody').append(t);},()=>{},'Sluiten');}}};
function renderManage(){const target=$('#manageRows');target.replaceChildren();const q=norm($('#manageSearch').value);for(const [kind,arr]of [['Gerecht',state.recipes],['Product',state.products]])for(const p of arr.filter(p=>matchesProduct(p,q))){const row=el('div',undefined,'row'),text=el('div',undefined,'text');text.append(el('strong',p.name),el('small',kind+' · '+cat(p.categoryId)?.name));if(kind==='Product'){hold(text,()=>chooseProduct(p));swipeAction(row,()=>editProduct(p));}row.append(text,btn('Bewerken',()=>kind==='Gerecht'?editRecipe(p):editProduct(p)));target.append(row);}}
function moveEntry(type,id,old,newId){if(old===newId)return;state.categories.forEach(c=>c.entries=c.entries.filter(e=>e.type!==type||e.id!==id));cat(newId).entries.push({type,id});}
function editProduct(product) {
 if(product)product=rawProduct(product.id);
 if (!state.categories.length) { toast('Voeg eerst een categorie toe.'); return; }
 let name, category, barcodes, favorite, hidden, extraCategories, choices;
 const openCodes=openSourceBarcodes(product || {});
 openModal(product?'Product bewerken':'Nieuw product',()=>{
  name=field('Naam','text',product?.name||'');
  category=categoryField(product?.categoryId);
  extraCategories=product?.remoteId?[]:categoryChecks('Ook tonen in',new Set(state.categories.filter(c=>c.entries.some(e=>e.type==='product'&&e.id===product?.id)).map(c=>c.id)));
  barcodes=field('Eigen barcodes (gescheiden door komma’s)','text',product?.barcodes.filter(code=>!openCodes.includes(code)).join(', ')||'');
  favorite=field('Favoriet','checkbox');
  favorite.checked=!!product?.favorite;
  hidden=product?.remoteId?{checked:!!product.hidden}:field('Verbergen bij producten','checkbox');
  hidden.checked=!!product?.hidden;
  choices=openCodes.map(code=>{
   const toggle=field('Barcode '+code+' gebruiken','checkbox');
   toggle.checked=product.barcodes.includes(code);
   const source=el('a','Open Food Facts · ODbL');
   source.href='https://world.openfoodfacts.org/product/'+encodeURIComponent(code);
   source.target='_blank';source.rel='noopener';
   toggle.parentElement.append(source);
   return [code,toggle];
  });
  if(product&&!product.remoteId){
   if(product.centralId){
    $('#modalBody').append(el('p','Product-ID '+product.centralId,'hint'));
    const central=centralProducts.get(product.centralId);
   if(central?.canRemoveBarcode)$('#modalBody').append(btn('Centrale productgegevens bewerken',()=>editCentralProduct(central)));
    if(central?.canRemoveBarcode&&central.barcode)$('#modalBody').append(btn('Centrale barcode verwijderen',()=>{
     if(!confirm('Deze barcode uit de centrale productbibliotheek verwijderen?'))return;
     libraryAction(async api=>{
      await api.library('barcode-remove',{id:central.id,barcode:central.barcode});
      centralProducts.set(central.id,{...central,barcode:null});
      const current=rawProduct(product.id);
      if(current)current.barcodes=current.barcodes.filter(code=>code!==central.barcode);
      save();closeModal();render();
     });
    }));
   }else if(embedded||identity.saved()?.confirmed){
    $('#modalBody').append(btn('Koppelen aan productbibliotheek',()=>registerProduct(product)));
   }
  }
  cameraControl($('#modalBody'),value=>{
   const open=choices.find(([code])=>code===value);
   if(open){open[1].checked=true;return;}
   barcodes.value=[...new Set([...barcodes.value.split(',').map(s=>s.trim()).filter(Boolean),value])].join(', ');
  });
 },()=>{
  const value=name.value.trim();
  if(!value)throw Error('Vul een naam in.');
  if(state.products.some(x=>x.id!==product?.id&&!x.remoteId&&norm(x.name)===norm(value)))throw Error('Deze productnaam bestaat al.');
  const preferences=barcodePreferences(product||{},barcodes.value.split(',').map(s=>s.trim()).filter(Boolean),choices.filter(([,check])=>check.checked).map(([code])=>code));
  if(preferences.barcodes.some(code=>state.products.some(x=>x.id!==product?.id&&!x.remoteId&&prod(x.id).barcodes.includes(code))))throw Error('Een barcode is al gekoppeld aan een ander product.');
  const item=product?rawProduct(product.id):{id:uid(),input:'plain'};
  if(!item||!cat(category.value))throw Error('De catalogus is gewijzigd. Open het product opnieuw.');
  Object.assign(item,{name:value,categoryId:category.value,...preferences,favorite:favorite.checked,hidden:hidden.checked});
  if(!product)state.products.push(item);
  const categories=new Set([category.value,...checkedCategories(extraCategories)]);
  for(const c of item.remoteId?[]:state.categories){
   const has=c.entries.some(e=>e.type==='product'&&e.id===item.id);
   if(has&&!categories.has(c.id))c.entries=c.entries.filter(e=>e.type!=='product'||e.id!==item.id);
   if(!has&&categories.has(c.id))c.entries.push({type:'product',id:item.id});
  }
  save();render();
 });
}
$('#newCategory').onclick=()=>{let name;openModal('Nieuwe categorie',()=>name=field('Naam','text'),()=>{const value=name.value.trim();if(!value||state.categories.some(c=>norm(c.name)===norm(value)))throw Error('Kies een unieke categorienaam.');const c={id:uid(),name:value,entries:[]};state.categories.push(c);const home=state.categories.find(c=>c.name==='Home');if(home)home.entries.push({type:'category',id:c.id});save();render();});};
function editRecipe(r,kind='recipe'){if(!state.categories.length){toast('Voeg eerst een categorie toe.');return;}let name,category,ingredients;openModal(r?.kind==='activity'||kind==='activity'?'Activiteit bewerken':r?'Gerecht bewerken':'Nieuw gerecht',()=>{name=field('Naam','text',r?.name||'');category=categoryField(r?.categoryId);$('#modalBody').append(el('p','Eén ingrediënt per regel: aantal | productnaam | notitie. Nieuwe productnamen worden toegevoegd.','hint'));ingredients=el('textarea');ingredients.setAttribute('aria-label','Ingrediënten');ingredients.value=r?.ingredients.map(i=>`${i.quantity} | ${prod(i.productId).name} | ${i.note}`).join('\n')||'';$('#modalBody').append(ingredients);},()=>{if(!name.value.trim())throw Error('Vul een naam in.');const lines=ingredients.value.split('\n').filter(x=>x.trim()).map(line=>{const [q,n,...note]=line.split('|').map(s=>s.trim());if(!n||!Number.isFinite(Number(q))||Number(q)<=0)throw Error('Gebruik: 1 | productnaam | notitie');return {quantity:Number(q),name:n,note:note.join(' | ')};});const result=lines.map(i=>{let p=state.products.find(p=>norm(p.name)===norm(i.name));if(!p){p={id:uid(),name:i.name,categoryId:category.value,barcodes:[],input:'plain'};state.products.push(p);cat(category.value).entries.push({type:'product',id:p.id});}return {productId:p.id,quantity:i.quantity,note:i.note};});if(r){moveEntry('recipe',r.id,r.categoryId,category.value);Object.assign(r,{name:name.value.trim(),categoryId:category.value,ingredients:result});}else{const item={id:uid(),kind,name:name.value.trim(),categoryId:category.value,ingredients:result};state.recipes.push(item);cat(category.value).entries.push({type:'recipe',id:item.id});}save();render();});}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#backup').onclick=()=>{if(saveBlocked){download('bs-oorspronkelijke-opslag.json',localStorage.getItem(KEY)||'');return;}download('bs-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2));};
function importFile(mode){const file=$('#file');file.accept=mode==='list'?'.csv,.json,text/csv,application/json':'.json';file.value='';file.onchange=async()=>{try{const selected=file.files?.[0];if(!selected)return;const text=await selected.text();if(mode==='list'){if(saveBlocked)throw Error('Herstel eerst je bestaande opslag.');state=importListFile(state,text,selected.name);activeList=state.activeListId||activeList;}else{const restored=validate(JSON.parse(text));if(!confirm('Je huidige gegevens vervangen door deze back-up?'))return;state=restored;activeList=state.lists[0]?.id;path=[];saveBlocked=false;}if(!save())throw Error('Opslaan mislukt. Je bestand is niet blijvend geïmporteerd.');render();toast('Gegevens ingeladen');}catch(e){toast(e.message);}};file.click();}
$('#firstImport').onclick=()=>importFile('list');$('#restore').onclick=()=>importFile('json');$('#importList').onclick=()=>importFile('list');

let barcodeLibrary;
function loadBarcodeReader(){
 if(window.ZXingBrowser)return Promise.resolve(window.ZXingBrowser);
 if(!barcodeLibrary)barcodeLibrary=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./vendor/zxing-browser-0.1.5.min.js';
  script.onload=()=>window.ZXingBrowser?resolve(window.ZXingBrowser):reject(Error('Scanner niet geladen'));
  script.onerror=()=>{script.remove();barcodeLibrary=null;reject(Error('Scanner niet geladen'));};document.head.append(script);
 });return barcodeLibrary;
}
function cameraControl(container,onCode){
 const area=el('div',undefined,'scanner'),video=el('video'),status=el('p',undefined,'hint');
 status.setAttribute('role','status');video.muted=true;video.playsInline=true;video.hidden=true;
 const start=btn('Scan barcode',async()=>{
  stopCamera();
  if(!navigator.mediaDevices?.getUserMedia){status.textContent='Camerascan wordt niet ondersteund in deze browser. Vul de barcode handmatig in of gebruik een externe scanner.';return;}
  let cancelled=false,stream,timer,controls;start.disabled=true;
  const stop=()=>{cancelled=true;clearTimeout(timer);controls?.stop();stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;video.hidden=true;start.disabled=false;cancel.hidden=true;};
  stopCamera=stop;cancel.hidden=false;status.textContent='Camera openen…';
  try{
   let detector=null;
   if('BarcodeDetector' in window){try{const supported=await BarcodeDetector.getSupportedFormats();const formats=supported.filter(x=>['ean_13','ean_8','upc_a','upc_e','code_128'].includes(x));if(formats.length)detector=new BarcodeDetector({formats});}catch{}}
   let fallback=null;if(!detector)fallback=await loadBarcodeReader();if(cancelled)return;
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
   if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
   video.srcObject=stream;video.hidden=false;await video.play();if(cancelled)return;
   status.textContent='Richt de camera op de streepjescode.';
   const decoded=value=>{if(cancelled)return;stop();status.textContent='Barcode herkend: '+value;try{onCode(value);}catch{status.textContent='Barcode '+value+' gelezen. Vul deze code handmatig in om verder te gaan.';}};
   const useFallback=async()=>{
    try{const library=fallback||await loadBarcodeReader();if(cancelled)return;const reader=new library.BrowserMultiFormatOneDReader();
     controls=await reader.decodeFromStream(stream,video,(result,error,session)=>{if(cancelled){session?.stop();return;}if(result)decoded(result.getText());});if(cancelled)controls?.stop();
    }catch{if(!cancelled){stop();status.textContent='Barcodeherkenning kon niet starten. Typ de code hieronder.';}}
   };
   if(fallback){await useFallback();return;}
   const started=Date.now();let errors=0;
   const tick=async()=>{if(cancelled)return;try{const results=await detector.detect(video);if(cancelled)return;if(results.length){decoded(results[0].rawValue);return;}}catch{errors++;}
    if(cancelled)return;if(errors>=2||Date.now()-started>5000){status.textContent='Richt de volledige barcode scherp in beeld. Alternatieve herkenning actief.';await useFallback();return;}timer=setTimeout(tick,250);};tick();

  }catch(e){stop();status.textContent=e.name==='NotAllowedError'?'Geen cameratoegang. Geef toestemming in je browser of typ de code.':e.message==='unsupported'?'Deze browser herkent geen ondersteunde productbarcodes. Typ de code.':'Camera niet beschikbaar. Je kunt de barcode ook typen.';}
 });
 const cancel=btn('Stop scannen',()=>{stopCamera();status.textContent='Scannen gestopt.';},'quiet');cancel.hidden=true;
 area.append(start,cancel,video,status);container.append(area);return start;
}
const offCache=new Map();let offCalls=[];
async function lookupBarcode(value){
 if(!/^\d{8,14}$/.test(value))throw Error('Vul 8 tot 14 cijfers in.');
 const cached=[...centralProducts.values()].find(p=>p.barcode===value);
 if(cached)return {...cached,categories:[],central:cached};
 if(embedded||identity.saved()?.confirmed){
  try{
   const api=await connectSharon();
   const {product}=await api.library('lookup',{barcode:value});
   if(product)return {...product,categories:[],central:product};
  }catch{/* A lookup can still use public data when the linked library is offline. */}
 }
 let data=offCache.get(value);
 if(!data){offCalls=offCalls.filter(t=>Date.now()-t<60000);if(offCalls.length>=10)throw Error('Even wachten: probeer het over een minuut opnieuw.');offCalls.push(Date.now());
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(value)+'.json?fields=product_name,product_name_nl,brands,quantity,categories_tags&app_name=ShopList',{signal:controller.signal});if(response.status===404)return null;if(!response.ok)throw Error('Productdatabase niet bereikbaar.');data=await response.json();offCache.set(value,data);}finally{clearTimeout(timeout);}}
 const p=data.product;if(!p||!(p.product_name_nl||p.product_name))return null;
 return {barcode:value,name:p.product_name_nl||p.product_name,brand:p.brands||'',quantity:p.quantity||'',categories:p.categories_tags||[],source:'https://world.openfoodfacts.org/product/'+value};
}
function rememberPackage(product,code,proposal){
 if(product.disabledBarcodes)product.disabledBarcodes=product.disabledBarcodes.filter(value=>value!==code);
 if(!product.barcodes.includes(code))product.barcodes.push(code);
 if(proposal?.barcode!==code)return;
 const {central,...pack}=proposal;
 if(central&&!product.remoteId&&!product.centralId&&product.barcodes.length===1){
  Object.assign(product,{centralId:central.id,centralBarcode:code,centralName:central.name});
  centralProducts.set(central.id,central);
 }
 if(pack.source){
  product.packages=product.packages||[];
  if(!product.packages.some(item=>item.barcode===code))product.packages.push(pack);
 }
}

function barcodeModal(){
 let code,select,name,category,status,startScan,proposal=null,request=0;
 const inspect=async()=>{
  const value=code.value.trim(),token=++request;proposal=null;
  const known=state.products.find(p=>prod(p.id).barcodes.includes(value));
  if(known){quickAdd(known);closeModal();toast(known.name+' toegevoegd');return;}
  if(!/^\d{8,14}$/.test(value)){status.textContent='Vul 8 tot 14 cijfers in, of koppel de code handmatig.';return;}
  status.textContent='Product opzoeken…';
  try{
   const found=await lookupBarcode(value);
   if(token!==request||!$('#modal').open||!code.isConnected||code.value.trim()!==value)return;
   if(!found){status.textContent='Niet gevonden. Kies een bestaand product of vul zelf een naam in.';return;}
   proposal=found;
   name.value=proposal.name;status.textContent=[proposal.name,proposal.brand,proposal.quantity].filter(Boolean).join(' · ');
   const tags=proposal.categories.join(' ');const rules=[[/beverages|drinks/,'Drinken'],[/fruits/,'Fruit'],[/vegetables/,'Groenten'],[/meats/,'Vlees'],[/breads|breakfast/,'Brood & Ontbijt'],[/desserts|yogurts/,'Toetjes'],[/sauces/,'Sauzen'],[/pastas/,'Pasta']];
   for(const [pattern,label] of rules){const c=state.categories.find(c=>c.name===label);if(c&&pattern.test(tags)){category.value=c.id;break;}}
   status.textContent+=' — controleer naam en categorie, of koppel aan je eigen product.';
  }catch{if(token===request&&code.isConnected)status.textContent='Online herkenning niet beschikbaar. Je kunt hieronder zelf koppelen of toevoegen.';}
 };
 openModal('Scannen & aanvullen',()=>{
  code=field('Barcode','text');code.inputMode='numeric';code.oninput=()=>{request++;proposal=null;};
  startScan=cameraControl($('#modalBody'),value=>{code.value=value;inspect();});
  $('#modalBody').append(btn('Product opzoeken',inspect));status=el('p','Een bekende barcode gaat direct op je lijst.','hint');status.setAttribute('role','status');$('#modalBody').append(status);
  const label=el('label','Koppelen aan je eigen product','field');select=el('select');select.setAttribute('aria-label','Product koppelen');const empty=el('option','Nieuw product maken');empty.value='';select.append(empty);
  state.products.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl')).forEach(p=>{const o=el('option',p.name);o.value=p.id;select.append(o);});label.append(select);$('#modalBody').append(label);
  name=field('Naam voor een nieuw product','text');category=categoryField();
  const source=el('a','Productgegevens: Open Food Facts · ODbL');source.href='https://world.openfoodfacts.org';source.target='_blank';source.rel='noopener';$('#modalBody').append(source,el('p','Alleen de barcode wordt opgezocht. Je lijst en camerabeelden worden niet verstuurd.','hint'));
 },()=>{
  const value=code.value.trim();if(!value)throw Error('Vul een barcode in.');
  let p=state.products.find(p=>prod(p.id).barcodes.includes(value))||rawProduct(select.value);
  if(!p){if(!name.value.trim())throw Error('Kies een product of vul een naam in.');if(!category.value)throw Error('Maak eerst een categorie.');p=state.products.find(p=>norm(p.name)===norm(name.value));
   if(!p){p={id:uid(),name:name.value.trim(),categoryId:category.value,barcodes:[],input:'plain'};state.products.push(p);cat(category.value).entries.push({type:'product',id:p.id});}}
  rememberPackage(p,value,proposal);
  quickAdd(p);render();toast(p.name+' toegevoegd');
 },'Koppelen & toevoegen');startScan.click();
}

render();

async function loadPublishedCatalog(){
 if(saveBlocked)return;
 const status=$('#catalogStatus');status.textContent='Catalogus laden…';catalogLoading=true;updateCloudStatus();
 try{
  const response=await fetch('./data/catalog.json',{cache:'no-cache'});
  if(!response.ok)throw Error('Catalogus niet bereikbaar');
  const catalog=await response.json();state=mergeCatalog(state,catalog);save();render();
  status.textContent='Jouw lijsten worden automatisch op dit apparaat bewaard. Maak zelf een back-up via Beheer.';
 }catch(e){status.textContent='Catalogus niet geladen. Je bestaande gegevens blijven beschikbaar.';$('#retryCatalog').hidden=false;}finally{catalogLoading=false;updateCloudStatus();}
}
$('#retryCatalog').onclick=loadPublishedCatalog;
loadPublishedCatalog();

function renderContext(){
 if(launch.compact)$('#contextTitle').textContent=list()?.name||'Nieuwe lijst';
 updateCloudStatus();
 const select=$('#activeListSelect');select.replaceChildren();for(const l of state.lists.filter(l=>!l.archived)){const o=el('option',l.name);o.value=l.id;select.append(o);}select.value=activeList||'';
 const n=list()?.items.filter(i=>!i.done).length||0;$('#count').textContent=n;$('#contextCount').textContent=n===1?'1 product nodig':n+' producten nodig';
}
function categoryChecks(label, selected=new Set(), exclude=()=>false) {
 const group=el('fieldset'),legend=el('legend',label),choices=[];
 group.append(legend);
 for(const category of state.categories.filter(c=>!c.remoteId&&c.name!=='Home'&&!exclude(c))){
  const row=el('label',undefined,'checkrow'),checkbox=el('input');
  checkbox.type='checkbox';
  checkbox.checked=selected.has(category.id);
  row.append(checkbox,el('span',category.name));group.append(row);
  choices.push([category.id,checkbox]);
 }
 $('#modalBody').append(group);
 return choices;
}

function checkedCategories(choices) {
 return choices.filter(([,checkbox])=>checkbox.checked).map(([id])=>id);
}

function openCategorySettings() {
 openModal('Categorieën',()=>{
  for(const category of state.categories.filter(c=>!c.remoteId&&c.name!=='Home')){
   $('#modalBody').append(btn(category.name,()=>{closeModal();editCategoryParents(category);}));
  }
  $('#modalBody').append(btn('Nieuwe categorie',()=>{closeModal();$('#newCategory').click();}));
 },()=>{},'Sluiten');
}

function editCategoryParents(category) {
 let parents;
 openModal(category.name,()=>{
  parents=categoryChecks('Tonen onder',new Set(state.categories.filter(c=>c.entries.some(e=>e.type==='category'&&e.id===category.id)).map(c=>c.id)),
   c=>reachesCategory(state.categories,category.id,c.id));
 },()=>{
  const chosen=new Set(checkedCategories(parents));
  for(const parent of state.categories.filter(c=>!c.remoteId&&c.name!=='Home')){
   const linked=parent.entries.some(e=>e.type==='category'&&e.id===category.id);
   if(linked&&!chosen.has(parent.id))parent.entries=parent.entries.filter(e=>e.type!=='category'||e.id!==category.id);
   if(!linked&&chosen.has(parent.id)&&!reachesCategory(state.categories,category.id,parent.id))parent.entries.push({type:'category',id:category.id});
  }
  save();render();
 });
}

function libraryAction(work) {
 return Promise.resolve().then(connectSharon).then(work).catch(error=>{
  const messages={
   product_conflict:'De barcode hoort al bij andere productgegevens. Controleer merk en verpakking.',
   invalid_product:'Vul naam, merk, verpakkingsinhoud en een barcode van 8 tot 14 cijfers in.',
   barcode_protected:'Alleen de toevoegende gebruiker kan deze eigen centrale barcode verwijderen.',
   unknown_action:'De Sharon-server moet eerst worden bijgewerkt voor de productbibliotheek.',
   collection_forbidden:'Je hebt geen toegang tot deze verzameling of mag die alleen bekijken.',
   invalid_collection:'Kies minstens één opgeslagen categorie en geef de verzameling een naam.'
  };
  toast(messages[error.code]||error.message);
 });
}

function registerProduct(product) {
 const packages=(product.packages||[]).filter(pack=>openSourceBarcodes(product).includes(pack.barcode)&&product.barcodes.includes(pack.barcode));
 const openPackage=packages.find(pack=>pack.barcode===product.barcodes[0])||null;
 closeModal();
 let name,brand,quantity,barcode;
 openModal('Koppelen aan productbibliotheek',()=>{
  name=field('Openbare productnaam','text',openPackage?.name||product.name);
  brand=field('Merk','text',openPackage?.brand||'');
  quantity=field('Verpakkingsinhoud','text',openPackage?.quantity||'');
  barcode=field('Barcode','text',openPackage?.barcode||(product.barcodes.length===1?product.barcodes[0]:''));
  if(openPackage){
   for(const input of [name,brand,quantity,barcode])input.readOnly=!!input.value;
   $('#modalBody').append(el('p','Bron · Open Food Facts','hint'));
  }
 },()=>{
  const data={name:name.value.trim(),brand:brand.value.trim(),quantity:quantity.value.trim(),barcode:barcode.value.trim()};
  if(!data.name||!data.brand||!data.quantity||!/^\d{8,14}$/.test(data.barcode))throw Error('Vul naam, merk, verpakkingsinhoud en barcode in.');
  if(!product.barcodes.includes(data.barcode))throw Error('Koppel de barcode eerst aan dit product en bewaar die wijziging.');
  if(name.disabled)return false;
  name.disabled=true;
  libraryAction(async api=>{
   try{
    const {product:central}=await api.library('product',{...data,source:openSourceBarcodes(product).includes(data.barcode)?'openfoodfacts':null});
    const current=rawProduct(product.id);
    if(!current||current.centralId||!current.barcodes.includes(data.barcode))throw Error('Het product is inmiddels gewijzigd. Open het opnieuw.');
    Object.assign(current,{centralId:central.id,centralBarcode:central.barcode,centralName:central.name});
    centralProducts.set(central.id,central);
    save();if(name.isConnected)closeModal();render();toast('Product gekoppeld');
   }finally{name.disabled=false;}
  });
  return false;
 },'Koppelen');
}

function editCentralProduct(central) {
 closeModal();
 let name,brand,quantity;
 openModal('Centrale productgegevens bewerken',()=>{
  name=field('Productnaam','text',central.name);
  brand=field('Merk','text',central.brand);
  quantity=field('Verpakkingsinhoud','text',central.quantity);
  $('#modalBody').append(el('p','Maak een veld leeg om eigen informatie te verwijderen. Het product behoudt ID '+central.id+'.','hint'));
  for(const [label,input] of [['Naam verwijderen',name],['Merk verwijderen',brand],['Verpakkingsinhoud verwijderen',quantity]]){
   input.parentElement.append(btn(label,()=>{input.value='';input.focus();}));
  }
 },()=>{
  if(name.disabled)return false;
  const data={id:central.id,revision:central.revision,name:name.value.trim(),brand:brand.value.trim(),quantity:quantity.value.trim()};
  name.disabled=true;
  libraryAction(async api=>{
   try{
    const {product}=await api.library('product-edit',data);
    centralProducts.set(product.id,product);save();if(name.isConnected)closeModal();render();
   }finally{name.disabled=false;}
  });
  return false;
 });
}

async function refreshLibrary(api) {
 if(!api.library)return;
 try{
  const ids=[...new Set(state.products.map(p=>p.centralId).filter(id=>typeof id==='string'))];
  for(let offset=0;offset<ids.length;offset+=500){
   const result=await api.library('products',{ids:ids.slice(offset,offset+500)});
   for(const product of result.products)centralProducts.set(product.id,product);
  }
  if(sharedCollections.length||homeSection==='products'){
   sharedCollections=(await api.library('index')).collections;
  }
  // Public source facts can be linked safely. Personal names, categories and historical list IDs stay in place.
  const candidates=state.products.filter(p=>!p.remoteId&&!p.centralId&&p.barcodes.length===1).flatMap(p=>{
   const pack=p.packages?.find(pkg=>pkg.barcode===p.barcodes[0]&&openSourceBarcodes(p).includes(pkg.barcode));
   return pack?.name&&pack?.brand&&pack?.quantity&&!conflictingBarcodes.has(pack.barcode)?[{id:p.id,pack}]:[];
  }).slice(0,5);
  for(const {id,pack} of candidates){
   try{
    const {product}=await api.library('product',{name:pack.name,brand:pack.brand,quantity:pack.quantity,barcode:pack.barcode,source:'openfoodfacts'});
    const current=rawProduct(id);
    if(current&&!current.centralId&&current.barcodes.includes(pack.barcode)){
     Object.assign(current,{centralId:product.id,centralBarcode:product.barcode,centralName:product.name||product.id});
     centralProducts.set(product.id,product);
     queueMicrotask(()=>syncCloud());
    }
   }catch(error){
    if(!['product_conflict','invalid_product'].includes(error.code))throw error;
    conflictingBarcodes.add(pack.barcode);
   }
  }
 }catch(error){if(error.code==='collection_forbidden')sharedCollections=[];}
 const used=new Set(state.products.map(p=>p.centralId));
 state.centralProductCache=[...centralProducts.values()].filter(p=>used.has(p.id));
}

function openCollections() {
 libraryAction(async api=>{
  sharedCollections=(await api.library('index')).collections;
  const owned=sharedCollections.filter(row=>row.role==='owner'),received=sharedCollections.filter(row=>row.role!=='owner');
  openModal('Gedeelde catalogi',()=>{
   $('#modalBody').append(btn('Delen via Sharon',()=>shareCatalog()));
   for(const row of [...owned,...received])$('#modalBody').append(btn(row.name,()=>{closeModal();openSharedCollection(row);}));
  },()=>{},'Sluiten');
 });
}

function openSharedCollection(collection) {
 if(!collection)return;
 openModal(collection.name,()=>{
  if(collection.categories?.length){const structure=el('details'),summary=el('summary','Categorieën in deze catalogus');structure.append(summary);for(const category of collection.categories.filter(c=>c.name!=='Home'))structure.append(el('p',category.name));$('#modalBody').append(structure);}
  $('#modalBody').append(btn('Plaats in mijn categorieën',()=>{closeModal();placeCollection(collection);}));
  if(collection.role==='owner')$('#modalBody').append(btn('Toegang beheren in Sharon',()=>shareCatalog(null,collection.id)));
  if(collection.role!=='read'){
   const pick=el('select');pick.setAttribute('aria-label','Centraal product toevoegen');
   const placeholder=el('option','Kies een gekoppeld product');placeholder.value='';pick.append(placeholder);
   for(const product of state.products.filter(p=>!p.remoteId&&p.centralId&&!collection.products.some(item=>item.key===p.centralId))){
    const option=el('option',product.name);option.value=product.centralId;pick.append(option);
   }
   if(pick.options.length>1)$('#modalBody').append(pick,btn('Toevoegen aan verzameling',()=>{
    if(pick.value)changeCollectionItem(collection,pick.value,true);
   }));
  }
  for(const product of collection.products){
   const row=el('div',undefined,'row'),label=el('span',product.name||product.id,'text');
   row.append(label,btn('Op mijn lijst',()=>addCollectionProduct(collection,product)));
   if(collection.role!=='read'){
    const remove=btn('Weghalen',()=>changeCollectionItem(collection,product.key,false),'quiet');
    remove.setAttribute('aria-label',(product.name||product.id)+' uit verzameling halen');row.append(remove);
   }
   $('#modalBody').append(row);
  }
 },()=>{},'Sluiten');
}

function addCollectionProduct(collection, product) {
 let own=state.products.find(item=>!item.remoteId&&(product.central?item.centralId===product.id:item.collectionProductKey===collection.id+'/'+product.key));
 if(!own){
  const target=state.categories.find(c=>c.collectionIds?.includes(collection.id))||state.categories.find(c=>!c.remoteId&&c.name!=='Home');
  if(!target){toast('Maak eerst een eigen categorie.');return;}
  own={id:uid(),name:product.name||product.id,categoryId:target.id,input:'plain',barcodes:[]};
  if(product.central){
   Object.assign(own,{centralId:product.id,centralBarcode:product.barcode,centralName:product.name||product.id});
   centralProducts.set(product.id,product);
   if(product.barcode)own.barcodes.push(product.barcode);
   if(product.source&&product.barcode)own.packages=[{barcode:product.barcode,source:product.source}];
  }else own.collectionProductKey=collection.id+'/'+product.key;
  state.products.push(own);
  target.entries.push({type:'product',id:own.id});
 }
 quickAdd(own);toast((product.name||product.id)+' toegevoegd');
}

function placeCollection(collection){
 let choices;
 openModal(collection.name,()=>{
  choices=categoryChecks('Tonen binnen mijn categorieën',new Set(state.categories.filter(c=>c.collectionIds?.includes(collection.id)).map(c=>c.id)));
 },()=>{
  const selected=new Set(checkedCategories(choices));
  for(const category of state.categories.filter(c=>!c.remoteId)){
   const ids=new Set(category.collectionIds||[]);
   if(selected.has(category.id))ids.add(collection.id);else ids.delete(collection.id);
   if(ids.size||category.collectionIds)category.collectionIds=[...ids];
  }
  save();render();
 });
}

function changeCollectionItem(collection,key,include){
 libraryAction(async api=>{
  await api.library('item',{id:collection.id,key,include});
  sharedCollections=(await api.library('index')).collections;
  closeModal();openSharedCollection(sharedCollections.find(row=>row.id===collection.id));
 });
}

function productControl(p){
 const row=el('div',undefined,'productLine');row.dataset.productId=p.id;
 const minus=btn('−',()=>{decreaseProduct(list(),p.id);save();refreshQuantities();},'step minus');minus.setAttribute('aria-label',p.name+' verminderen');
 const name=btn(p.name,()=>quickAdd(p),'productName');name.setAttribute('aria-label',p.name+' toevoegen');name.title='Klik om toe te voegen. Houd vast voor een notitie.';
 name.onkeydown=e=>{if(e.key==='F2'){e.preventDefault();editProduct(p);}};
 const qty=el('output',String(productQuantity(list(),p.id)),'productQuantity');qty.setAttribute('aria-label','Aantal '+p.name);qty.setAttribute('aria-live','polite');
 const plus=btn('+',()=>quickAdd(p),'step plus');plus.setAttribute('aria-label',p.name+' verhogen');minus.disabled=productQuantity(list(),p.id)<=0;
 row.append(minus,name,qty,plus);hold(row,()=>chooseProduct(p),e=>!e.target.closest('.minus'));swipeAction(row,()=>editProduct(p));return row;
}
function renderHome(){
 const target=$('#homeContent');target.replaceChildren();document.querySelectorAll('[data-source]').forEach(b=>{b.classList.toggle('active',b.dataset.source===homeSection);b.setAttribute('aria-pressed',String(b.dataset.source===homeSection));});
 const titles={mylist:'Thuis je lijst nalopen.',products:'Alles voor je lijst.',recipes:'Wat eten we?',activities:'Wat ben je van plan?'};
 const heading=el('div',undefined,'sectionHeading');heading.append(el('h2',titles[homeSection]));target.append(heading);
 if(homeSection==='mylist'){renderHomeList(target);return;}
 if(homeSection==='products'){
  heading.append(btn('+ Product',()=>editProduct(),'quiet'),btn('Catalogus',()=>switchView('catalog'),'quiet'));
  if(embedded||identity.saved()?.confirmed)heading.append(btn('Gedeelde categorieën',openCollections,'quiet'));
  const order=['frequent','alphabetical','category'].includes(state.productOrder)?state.productOrder:'frequent';
  const sort=el('div',undefined,'productSort');sort.setAttribute('role','group');sort.setAttribute('aria-label','Producten sorteren');
  for(const [value,label]of [['frequent','Vaak nodig'],['alphabetical','A–Z'],['category','Categorie']]){const button=btn(label,()=>{state.productOrder=value;save();renderHome();});button.classList.toggle('active',order===value);button.setAttribute('aria-pressed',String(order===value));sort.append(button);}target.append(sort);
  const filters=el('div',undefined,'categoryFilters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Productcategorie');
  const options=[{id:'',name:'Alles'},...state.categories.filter(c=>c.name!=='Home'&&!c.remoteId).sort((a,b)=>a.name.localeCompare(b.name,'nl'))];
  if(!options.some(c=>c.id===productCategory))productCategory='';
  for(const c of options){const button=btn(c.name,()=>{productCategory=c.id;renderHome();},'categoryChip');button.classList.toggle('active',productCategory===c.id);button.setAttribute('aria-pressed',String(productCategory===c.id));filters.append(button);}target.append(filters);
  const selected=cat(productCategory),q=norm($('#quickName').value);
  const matches=selected&&categoryProductIds(state.categories,selected.id,state.products);
  if(selected)for(const collection of sharedCollections.filter(row=>state.categories.some(c=>c.collectionIds?.includes(row.id)&&reachesCategory(state.categories,selected.id,c.id))))target.append(btn(collection.name,()=>openSharedCollection(collection)));
  const products=state.products.filter(p=>!p.hidden&&(!matches||matches.has(p.id))).map(p=>prod(p.id)).filter(p=>matchesProduct(p,q)).sort((a,b)=>{const alpha=a.name.localeCompare(b.name,'nl');if(order==='frequent')return Number(!!b.favorite)-Number(!!a.favorite)||(b.purchaseCount||0)-(a.purchaseCount||0)||alpha;if(order==='category')return (cat(a.categoryId)?.name||'Overig').localeCompare(cat(b.categoryId)?.name||'Overig','nl')||alpha;return alpha;});
  target.append(el('p',products.length+' producten'+(selected?' · '+selected.name:''),'hint'));
  if(!products.length)target.append(el('p','Geen producten gevonden. Kies Alles of pas je zoektekst aan. Met + Op de lijst kun je een nieuw product toevoegen.','empty'));
  let lastCategory=null;products.forEach(p=>{if(order==='category'){const label=cat(p.categoryId)?.name||'Overig';if(label!==lastCategory){target.append(el('h3',label,'sectionLabel'));lastCategory=label;}}target.append(productControl(p));});
 }else{
  const activity=homeSection==='activities';heading.append(btn(activity?'+ Activiteit':'+ Gerecht',()=>editRecipe(undefined,activity?'activity':'recipe'),'quiet'));
  target.append(el('p',activity?'Kies een moment en zet op je lijst wat nog ontbreekt.':'Kies een gerecht. Vink uit wat je al in huis hebt.','hint'));
  state.recipes.filter(r=>(r.kind==='activity')===activity).forEach(r=>{const row=el('div',undefined,'recipeLine'),open=btn('',()=>chooseRecipe(r),'recipeName');open.append(el('strong',r.name),el('small',r.ingredients.length+' producten'));row.append(open,btn('Kies producten',()=>chooseRecipe(r),'secondary'));swipeAction(row,()=>editRecipe(r));target.append(row);});
 }refreshQuantities();
}
$('#homeScan').onclick=barcodeModal;
$('#onlyNeeded').onchange=()=>renderList($('#listRows'),$('#onlyNeeded').checked);
$('#saveActivity').onclick=()=>{
 if(!list()?.items.length){toast('Vul eerst je lijst met producten.');return;}let name;
 openModal('Lijst als activiteit bewaren',()=>name=field('Naam','text',list().name),()=>{if(!name.value.trim())throw Error('Vul een naam in.');state.recipes.push({id:uid(),kind:'activity',name:name.value.trim(),categoryId:prod(list().items[0].productId).categoryId,ingredients:list().items.map(i=>({productId:i.productId,quantity:i.quantity,note:i.note}))});save();render();});
};

$('#activeListSelect').onchange=e=>{activeList=e.target.value;save();render();};
$('#contextNew').onclick=()=>$('#newList').click();

document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{homeSection=b.dataset.source;renderHome();});
$('#quickName').oninput=()=>{if(homeSection!=='mylist')homeSection='products';productCategory='';renderHome();};
$('#listSearch').oninput=()=>renderList();
$('#quickForm').onsubmit=e=>{
 e.preventDefault();const name=$('#quickName').value.trim();if(!name)return;
 let p=state.products.find(p=>norm(p.name)===norm(name)||(p.aliases||[]).some(alias=>norm(alias)===norm(name)));
 if(!p){let c=state.categories.find(c=>c.name==='Zelf toegevoegd');if(!c){c={id:uid(),name:'Zelf toegevoegd',entries:[]};state.categories.push(c);const home=state.categories.find(c=>c.name==='Home');if(home)home.entries.push({type:'category',id:c.id});}
 p={id:uid(),name,categoryId:c.id,barcodes:[],input:'plain'};state.products.push(p);c.entries.push({type:'product',id:p.id});}
 quickAdd(p);$('#quickName').value='';render();toast(p.name+' op '+list().name);
};

let stopDeck=()=>{};
function updatePickedRows(){
 const l=list();if(!l)return;
 for(const row of document.querySelectorAll('[data-list-item]')){const item=l.items.find(i=>i.id===row.dataset.listItem);if(item){row.classList.toggle('done',item.done);row.querySelector('input[type=checkbox]').checked=item.done;}}
 renderContext();$('#progress').textContent=`${l.items.filter(i=>i.done).length} van ${l.items.length} afgevinkt`;$('#shoppingProgress').textContent=l.items.filter(i=>i.done).length+' / '+l.items.length;
}
function pickScan(){
 ensureList();
 const scanList=list();let code,status,select,start,result,request=0,proposal=null;
 const options=()=>{select.replaceChildren();const none=el('option','Kies het product op je lijst');none.value='';select.append(none);for(const i of scanList.items.filter(i=>!i.done)){const o=el('option',prod(i.productId).name+' · '+i.quantity+' ×');o.value=i.id;select.append(o);}};
 const commit=item=>{
  const value=code.value.trim();if(saveBlocked){status.textContent='Opslaan geblokkeerd. Herstel eerst je opgeslagen gegevens via Beheer.';return;}
  const p=rawProduct(item.productId),other=state.products.find(p=>prod(p.id).barcodes.includes(value));
  if(other&&other.id!==p.id&&!p.barcodes.includes(value)){status.textContent='Deze barcode is al gekoppeld aan '+other.name+'. Pas die koppeling aan via Beheer.';return;}
  const oldProduct=structuredClone(p),oldItem=structuredClone(item);rememberPackage(p,value,proposal);markScannedLine(item,value);
  if(!item.purchaseRecorded){item.purchaseRecorded=true;p.purchaseCount=(p.purchaseCount||0)+1;p.lastPurchased=Date.now();}
  if(!save()){for(const key of Object.keys(p))delete p[key];Object.assign(p,oldProduct);for(const key of Object.keys(item))delete item[key];Object.assign(item,oldItem);status.textContent='Barcode niet opgeslagen: browseropslag niet beschikbaar. Maak ruimte vrij en probeer opnieuw.';return;}updatePickedRows();status.textContent=p.name+' · '+item.quantity+' × afgevinkt. Barcode '+value+' gekoppeld.';result.replaceChildren();code.value='';proposal=null;request++;options();start.textContent='Scan volgend product';
 };
 const offerExtra=known=>{
  const value=code.value.trim(),packageInfo=proposal;
  const panel=el('div');result.append(panel);
  panel.append(btn('Extra product meenemen',()=>{
   panel.replaceChildren();
   const input=(title,type,value)=>{const label=el('label',title,'field'),node=el('input');node.type=type;node.value=value;label.append(node);panel.append(label);return node;};
   let target,name,category;
   if(known)panel.append(el('p',known.name));
   else{
    const label=el('label','Product','field');target=el('select');const empty=el('option','Nieuw product');empty.value='';target.append(empty);
    for(const p of state.products.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl'))){const o=el('option',p.name);o.value=p.id;target.append(o);}label.append(target);panel.append(label);
    name=input('Naam','text',packageInfo?.name||'');
    const cl=el('label','Categorie','field');category=el('select');for(const c of state.categories.filter(c=>c.name!=='Home')){const o=el('option',c.name);o.value=c.id;category.append(o);}cl.append(category);panel.append(cl);
    target.onchange=()=>{name.disabled=category.disabled=!!target.value;};
   }
   const quantity=input('Aantal extra stuks','number',1);quantity.min='1';quantity.max='200';quantity.step='1';
   panel.append(btn('Toevoegen als gepakt',()=>{
    if(code.value.trim()!==value)return;
    if(saveBlocked){status.textContent='Opslaan geblokkeerd. Herstel eerst je gegevens via Beheer.';return;}
    const count=Number(quantity.value);if(!Number.isInteger(count)||count<1||count>200){status.textContent='Kies een heel aantal van 1 tot 200.';return;}
    let p=rawProduct(known?.id)||rawProduct(target?.value);
    if(!p&&!name.value.trim()){status.textContent='Vul een productnaam in.';name.focus();return;}
    if(!p)p=state.products.find(x=>norm(x.name)===norm(name.value.trim()));
    if(!p&&!category?.value){status.textContent='Maak eerst een categorie via Beheer.';return;}
    const before=structuredClone({products:state.products,categories:state.categories,items:scanList.items});
    if(!p){p={id:uid(),name:name.value.trim(),categoryId:category.value,barcodes:[],input:'plain'};state.products.push(p);cat(category.value).entries.push({type:'product',id:p.id});}
    rememberPackage(p,value,packageInfo);addPickedExtra(scanList,p.id,count,value);
    p.purchaseCount=(p.purchaseCount||0)+1;p.lastPurchased=Date.now();
    if(!save()){state.products=before.products;state.categories=before.categories;scanList.items=before.items;status.textContent='Niet opgeslagen. Maak ruimte vrij en probeer opnieuw.';return;}
    render();status.textContent=p.name+' · '+count+' × extra meegenomen en opgeslagen.';result.replaceChildren();code.value='';proposal=null;request++;options();start.textContent='Scan volgend product';
   }));
  }));
 };
 const inspect=async()=>{
  const value=code.value.trim(),token=++request;proposal=null;result.replaceChildren();select.value='';
  if(!/^\d{8,14}$/.test(value)){status.textContent='Scan de streepjescode of vul 8 tot 14 cijfers in.';return;}
  const known=state.products.find(p=>prod(p.id).barcodes.includes(value)&&scanList.items.some(i=>i.productId===p.id&&!i.done))||state.products.find(p=>prod(p.id).barcodes.includes(value));
  if(known){const item=scanList.items.find(i=>!i.done&&i.productId===known.id);if(item){commit(item);return;}status.textContent=known.name+(scanList.items.some(i=>i.productId===known.id)?' is al afgevinkt.':' staat niet op deze lijst.');offerExtra(known);return;}
  status.textContent='Barcode '+value+' herkend. Opzoeken in Open Food Facts…';
  try{
   const found=await lookupBarcode(value);if(token!==request||!code.isConnected||!$('#modal').open||code.value.trim()!==value)return;proposal=found;
   if(!found){status.textContent='Barcode niet gevonden in Open Food Facts. Kies hieronder het product om de code te bewaren en af te strepen, of voeg een extra product toe.';offerExtra();return;}
   status.textContent=[found.name,found.brand,found.quantity].filter(Boolean).join(' · ')+' — '+(found.central?'gevonden in de productbibliotheek.':'gevonden in Open Food Facts.');
   const words=norm(found.name+' '+found.brand).split(/[^\p{L}\p{N}]+/u);
   const suggestions=scanList.items.filter(i=>!i.done).filter(i=>{const name=norm(prod(i.productId).name);return name===norm(found.name)||name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).every(w=>words.includes(w))||name.split(/[^\p{L}\p{N}]+/u).some(w=>w.length>=5&&words.includes(w));});
   for(const item of suggestions.slice(0,5))result.append(btn('Koppel aan '+prod(item.productId).name+' & streep af',()=>commit(item)));
   result.append(el('p','Kies het bijbehorende lijstproduct. De volgende scan van deze barcode werkt automatisch.','hint'));offerExtra();
  }catch{if(token===request&&code.isConnected&&code.value.trim()===value){status.textContent='Open Food Facts is nu niet bereikbaar. Koppel een lijstproduct of voeg zelf een extra product toe.';offerExtra();}}
 };
 openModal('Scan en streep af',()=>{
  $('#modalBody').append(el('p','Richt op de streepjescode. Een bekende code streept het volledige aantal af. Een nieuwe code koppel je één keer.','hint'));
  code=field('Barcode (of handmatig invoeren)','text');code.inputMode='numeric';code.oninput=()=>{request++;proposal=null;result.replaceChildren();select.value='';};
  start=cameraControl($('#modalBody'),value=>{code.value=value;inspect();});
  $('#modalBody').append(btn('Barcode opzoeken',inspect));status=el('p','Camera openen…','hint');status.setAttribute('role','status');result=el('div',undefined,'scanMatches');$('#modalBody').append(status,result);
  const label=el('label','Welk product op je lijst?','field');select=el('select');select.setAttribute('aria-label','Koppel aan lijstregel');label.append(select);$('#modalBody').append(label);options();
  const source=el('a','Productherkenning: Open Food Facts · ODbL');source.href='https://world.openfoodfacts.org';source.target='_blank';source.rel='noopener';$('#modalBody').append(source,el('p','Alleen de barcode wordt online opgezocht. Koppelingen blijven op dit apparaat bewaard.','hint'));
 },()=>{if(select.value){const item=scanList.items.find(i=>i.id===select.value&&!i.done);if(!/^\d{8,14}$/.test(code.value.trim())){status.textContent='Scan of vul eerst een geldige barcode in.';return false;}if(item)commit(item);}else inspect();return false;},'Koppelen & afstrepen');start.textContent='Open camera en scan';start.click();
}
function loadBarcodeWriter(){
 if(window.JsBarcode)return Promise.resolve();
 return new Promise((resolve,reject)=>{const script=el('script');script.src='./vendor/jsbarcode-3.12.1.min.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Barcodeweergave niet geladen'));};document.head.append(script);});
}
async function checkoutBoards(){
 const items=list()?.items.filter(i=>i.done)||[];if(!items.length){toast('Scan of vink eerst de producten af die je hebt gepakt.');return;}
 try{await loadBarcodeWriter();}catch(e){toast(e.message);return;}
 const cards=[];
 for(const i of items){
  const product=prod(i.productId);if(!product||![...(product.barcodes||[]),...(i.scannedCodes||[])].some(code=>typeof code==='string'&&code.trim()))continue;
  if(!Number.isInteger(i.quantity)||i.quantity>200){cards.push({item:i,product:prod(i.productId),issue:'Controleer dit artikel apart bij de kassa: hoeveelheid is geen ondersteund aantal stuks.'});continue;}
  for(let n=0;n<i.quantity;n++){const p=prod(i.productId),code=i.scannedCodes?.[n]||(p.barcodes.length===1?p.barcodes[0]:null);if(!code&&!p.barcodes.some(value=>value.trim()))continue;cards.push({item:i,product:p,n:n+1,code});}
 }
 if(!cards.length){toast('Geen barcodes beschikbaar voor de afgevinkte producten.');return;}
 let index=0,alive=true,stream,context,tick,revision=0,gate=createBeepGate(),profile=null,learning=false,listening=false,pending=null,autoMoves=new Map(),feedbackTimer,corrections=0,uncorrected=0,minPurity=.45,readyAt=0;
 let board,status,audioStatus,listen,learn,confirmTone,prev,next,feedback,chainInput,locationInput,scopeInput,profileStatus;
 const profiles=Array.isArray(state.beepProfiles)?state.beepProfiles:(state.beepProfiles=[]);
 let savedProfile=null,candidate=null;
 const persistFeedback=()=>{if(savedProfile){Object.assign(savedProfile,{minPurity,corrections,uncorrected,updatedAt:new Date().toISOString()});save();}};
 const selectProfile=()=>{
  settle();stopMic();autoMoves.clear();pending=null;clearTimeout(feedbackTimer);candidate=null;confirmTone.hidden=true;
  state.checkoutStore={chain:chainInput.value.trim(),location:locationInput.value.trim()};save();
  savedProfile=findBeepProfile(profiles,chainInput.value,locationInput.value);profile=savedProfile;
  minPurity=savedProfile?.minPurity||.45;corrections=savedProfile?.corrections||0;uncorrected=savedProfile?.uncorrected||0;
  profileStatus.textContent=savedProfile?'Opgeslagen piep: '+savedProfile.chain+(savedProfile.location?' · '+savedProfile.location:' · alle vestigingen'):'Nog geen opgeslagen piep voor deze winkel.';
  audioStatus.textContent=savedProfile?'Profiel geladen. Druk op Luisteren naar piep.':'Leer de kassapiep en bevestig hem om hem te bewaren.';feedbackText();
 };
 const stopMic=()=>{revision++;clearInterval(tick);stream?.getTracks().forEach(t=>t.stop());stream=null;context?.close().catch(()=>{});context=null;listening=false;learning=false;if(listen)listen.textContent='Luisteren naar piep';};
 const cleanup=()=>{alive=false;stopMic();clearTimeout(feedbackTimer);document.removeEventListener('visibilitychange',hide);$('#modal').classList.remove('checkoutModal');stopDeck=()=>{};};
 const hide=()=>{if(document.hidden){stopMic();audioStatus.textContent='Luisteren gepauzeerd omdat de app niet in beeld is.';}};
 const feedbackText=()=>{feedback.textContent=uncorrected+' piepen zonder terug-swipe · '+corrections+' correcties. Dit meet bediening, geen kassaregistratie.';};
 const settle=()=>{if(pending){uncorrected++;pending.counted=true;pending=null;persistFeedback();feedbackText();}};
 const draw=()=>{
  board.replaceChildren();prev.disabled=index===0;next.disabled=index>=cards.length;
  if(index>=cards.length){board.append(el('h2','Alle kaarten getoond.'),el('p','Controleer producten en aantallen op het kassascherm voordat je betaalt.'));status.textContent='Einde van de reeks';stopMic();return;}
  const card=cards[index];status.textContent='Kaart '+(index+1)+' van '+cards.length;board.append(el('p','STUK '+(card.n||1)+' VAN '+card.item.quantity,'eyebrow'),el('h2',card.product.name));
  const format=barcodeFormat(card.code||'');
  if(format){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Barcode '+card.code);board.append(svg);window.JsBarcode(svg,card.code,{format,width:3,height:115,margin:24,displayValue:true,fontSize:20,background:'#fff',lineColor:'#000'});}
  else{board.append(el('p',card.issue||'Geen eenduidige, geldige EAN/UPC-barcode. Scan het artikel zelf bij de kassa.','barcodeIssue'));}
  if(!card.code&&card.product.barcodes.length>1){const select=el('select');select.setAttribute('aria-label','Kies de verpakking');const blank=el('option','Kies de exacte verpakking');blank.value='';select.append(blank);card.product.barcodes.forEach(code=>{const o=el('option',code);o.value=code;select.append(o);});select.onchange=()=>{card.code=select.value;draw();};board.append(select);}
  readyAt=performance.now()+1200;
 };
 const move=(direction,automatic=false)=>{
  if(direction<0&&index===0||direction>0&&index>=cards.length)return;
  if(direction<0&&autoMoves.has(index)){const record=autoMoves.get(index);if(record.counted)uncorrected=Math.max(0,uncorrected-1);autoMoves.delete(index);corrections++;minPurity=Math.min(.8,minPurity+.04);persistFeedback();if(pending===record){pending=null;clearTimeout(feedbackTimer);}audioStatus.textContent='Correctie onthouden. Herkenning is iets strenger gezet.';}
  else if(direction>0)settle();
  index+=direction;index=Math.max(0,Math.min(cards.length,index));
  if(automatic){pending={index,counted:false};autoMoves.set(index,pending);clearTimeout(feedbackTimer);feedbackTimer=setTimeout(settle,5000);audioStatus.textContent='Piep gehoord → volgende kaart. Swipe terug als dit te vroeg was.';}
  feedbackText();draw();
 };
 const startMic=async(calibrate=false)=>{
  stopMic();const token=revision;learning=calibrate;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Microfoon niet ondersteund');
   const Audio=window.AudioContext||window.webkitAudioContext;context=new Audio();await context.resume();
   const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   if(!alive||token!==revision){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;context.createMediaStreamSource(stream).connect(analyser);
   const data=new Float32Array(analyser.frequencyBinCount),bin=context.sampleRate/analyser.fftSize;gate=createBeepGate();listening=true;listen.textContent='Luisteren pauzeren';audioStatus.textContent=calibrate?'Laat één kassapiep horen. De kaarten blijven nog staan.':'Luistert lokaal naar de bevestigde pieptoon.';
   tick=setInterval(()=>{
    if(!alive||document.hidden)return;analyser.getFloatFrequencyData(data);let peak=-Infinity,k=0,total=0;
    for(let j=Math.ceil(700/bin);j<Math.min(data.length,Math.floor(6000/bin));j++){const power=10**(data[j]/10);total+=power;if(data[j]>peak){peak=data[j];k=j;}}
    let band=0;for(let j=Math.max(0,k-2);j<=Math.min(data.length-1,k+2);j++)band+=10**(data[j]/10);
    const frequency=k*bin,purity=total?band/total:0,match=!profile||Math.abs(frequency-profile.frequency)<Math.max(150,profile.frequency*.12);
    const event=gate(performance.now(),peak>-45&&purity>=minPurity&&(learning||match),frequency);
    if(!event)return;
    if(learning){candidate=event;stopMic();confirmTone.hidden=false;audioStatus.textContent='Piep gevonden rond '+Math.round(event.frequency)+' Hz. Was dit jouw kassapiep?';return;}
    if(performance.now()>=readyAt&&index<cards.length&&barcodeFormat(cards[index].code||''))move(1,true);
   },30);
  }catch(e){if(token!==revision||!alive)return;stopMic();audioStatus.textContent='Microfoon niet beschikbaar of toestemming geweigerd. Swipen en knoppen blijven werken.';}
 };
 openModal('Barcodes bij de kassa',()=>{
  $('#modal').classList.add('checkoutModal');$('#modalBody').append(el('p','Experimentele luisterstand. Controleer de registratie op de kassa. Geluid blijft op je telefoon en wordt niet opgenomen.','hint'));
  status=el('p',undefined,'deckCounter');status.setAttribute('role','status');board=el('div',undefined,'barcodeBoard');board.tabIndex=0;board.setAttribute('aria-label','Barcodekaart. Swipe links voor volgende, rechts voor vorige.');
  let start=null;board.onpointerdown=e=>{if(e.target.closest('select')||!e.isPrimary)return;start=[e.clientX,e.clientY];board.setPointerCapture(e.pointerId);};board.onpointerup=e=>{if(start){const dx=e.clientX-start[0],dy=e.clientY-start[1];if(Math.abs(dx)>60&&Math.abs(dy)<45)move(dx<0?1:-1);}start=null;};board.onpointercancel=()=>start=null;board.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}};
  const nav=el('div',undefined,'deckNav');prev=btn('← Vorige',()=>move(-1));next=btn('Volgende →',()=>move(1));nav.append(prev,next);
  const controls=el('div',undefined,'toolbar');learn=btn('Kassapiep leren',()=>{if(!chainInput.value.trim()){audioStatus.textContent='Vul eerst de winkelketen in.';return;}if(scopeInput.value==='location'&&!locationInput.value.trim()){audioStatus.textContent='Vul eerst de vestiging in.';return;}confirmTone.hidden=true;startMic(true);},'secondary');listen=btn('Luisteren naar piep',()=>{if(listening){stopMic();audioStatus.textContent='Luisteren gepauzeerd.';}else if(!profile){audioStatus.textContent='Leer eerst de piep van jouw kassa.';}else startMic();},'secondary');confirmTone=btn('Dit is de juiste piep',()=>{if(!candidate)return;settle();savedProfile=saveBeepProfile(profiles,chainInput.value,scopeInput.value==='location'?locationInput.value:'',candidate);save();selectProfile();startMic();});confirmTone.hidden=true;controls.append(learn,listen,confirmTone);
  audioStatus=el('p','Leer eerst de kassapiep, of swipe handmatig door de kaarten.','hint');audioStatus.setAttribute('role','status');feedback=el('p',undefined,'hint');const settings=el('details');settings.append(el('summary','Winkel en piepprofiel'));
  const makeInput=(label,value,choices)=>{const wrap=el('label',label,'field'),input=el('input'),dl=el('datalist');input.value=value;dl.id=uid();input.setAttribute('list',dl.id);[...new Set(choices)].filter(Boolean).forEach(name=>{const o=el('option');o.value=name;dl.append(o);});wrap.append(input,dl);settings.append(wrap);input.onchange=selectProfile;return input;};
  chainInput=makeInput('Winkelketen',state.checkoutStore?.chain||'Jumbo',profiles.map(p=>p.chain));
  locationInput=makeInput('Vestiging (optioneel)',state.checkoutStore?.location||'',profiles.map(p=>p.location));
  const scopeLabel=el('label','Nieuwe piep bewaren voor','field');scopeInput=el('select');[['chain','De hele winkelketen'],['location','Alleen deze vestiging']].forEach(([value,label])=>{const o=el('option',label);o.value=value;scopeInput.append(o);});scopeLabel.append(scopeInput);settings.append(scopeLabel);
  profileStatus=el('p',undefined,'hint');$('#modalBody').append(settings,profileStatus,status,board,nav,controls,audioStatus,feedback);selectProfile();draw();
 },()=>{},'Sluiten');stopDeck=cleanup;document.addEventListener('visibilitychange',hide);
}
$('#pickScan').onclick=pickScan;
$('#checkoutBoards').onclick=checkoutBoards;

function matchesProduct(p,q,note=''){return fuzzyMatch([p?.name,...(p?.aliases||[]),...(p?.packages||[]).flatMap(x=>[x.name,x.brand]),note].join(' '),q);}
function removeListItem(item,row){
 const l=list(),position=l.items.indexOf(item);if(position<0)return;l.items.splice(position,1);save();row.remove();renderContext();if(view==='lists')updatePickedRows();
 const undo=btn('Ongedaan maken',()=>{if(!l.items.some(i=>i.id===item.id)){l.items.splice(Math.min(position,l.items.length),0,item);save();render();}$('#toast').style.display='none';},'quiet');toast(prod(item.productId).name+' verwijderd.');$('#toast').append(' ',undo);
}
function renderHomeList(target){
 const filters=el('div',undefined,'productSort');filters.setAttribute('aria-label','Thuisfilter');
 for(const [value,label]of [['needed','Nog nodig'],['all','Alles'],['done','In de tas']]){const b=btn(label,()=>{homeFilter=value;renderHome();});b.setAttribute('aria-pressed',String(homeFilter===value));b.classList.toggle('active',homeFilter===value);filters.append(b);}target.append(filters);
 const items=(list()?.items||[]).filter(i=>(homeFilter==='all'||(homeFilter==='done'?i.done:!i.done))&&matchesProduct(prod(i.productId),$('#quickName').value,i.note));
 if(!items.length)target.append(el('p','Geen producten in deze weergave. Kies Producten om je lijst aan te vullen.','empty'));
 for(const i of items){const p=prod(i.productId),row=el('div',undefined,'row homeListRow'+(i.done?' done':''));row.dataset.homeItem=i.id;
 const text=btn('',()=>chooseProduct(p,i),'text');text.append(el('strong',p.name));if(i.note)text.append(el('small',i.note));
 const amount=el('output',String(i.quantity));amount.setAttribute('aria-label','Aantal '+p.name);
 const minus=btn('−',()=>{if(i.quantity>1){i.quantity=Math.max(1,i.quantity-1);save();amount.textContent=i.quantity;renderContext();}else removeListItem(i,row);},'quiet');minus.setAttribute('aria-label',p.name+' verminderen');
 const plus=btn('+',()=>{i.quantity++;save();amount.textContent=i.quantity;renderContext();},'quiet');plus.setAttribute('aria-label',p.name+' verhogen');
 row.append(text,minus,amount,plus);target.append(row);}
}

function reviewSimilarProducts(){
 const pairs=similarProductPairs(state.products).filter(pair=>!(state.ignoredProductPairs||[]).includes([pair.a,pair.b].sort().join('|')));
 let position=0,name,info,skip;
 const draw=()=>{const pair=pairs[position];if(!pair){info.textContent='Geen verdere vergelijkbare producten gevonden.';name.hidden=true;skip.hidden=true;$('#modalSave').textContent='Sluiten';return;}const a=prod(pair.a),b=prod(pair.b);info.textContent=a.name+'  ↔  '+b.name;name.hidden=false;name.value=pair.name;$('#modalSave').textContent='Samenvoegen';};
 openModal('Vergelijkbare producten',()=>{info=el('p');$('#modalBody').append(info,el('p','Controleer of dit hetzelfde product is. Barcodes, oude zoeknamen en lijstverwijzingen blijven bewaard.','hint'));name=field('Gezamenlijke productnaam','text');skip=btn('Apart houden',()=>{const pair=pairs[position];state.ignoredProductPairs=state.ignoredProductPairs||[];state.ignoredProductPairs.push([pair.a,pair.b].sort().join('|'));save();position++;draw();});$('#modalBody').append(skip);draw();},()=>{const pair=pairs[position];if(!pair)return;mergeProductVariants(state,[pair.a,pair.b],name.value);save();render();closeModal();reviewSimilarProducts();return false;},'Samenvoegen');
}

function markCloudChanges(){
 for(const l of state.lists){if(!l.cloud)continue;const payload=snapshot(state,l),json=JSON.stringify(payload);if(l.cloud.role==='read'){if(json!==l.cloud.base){const oldId=l.id;l.id=uid();l.name+=' (eigen kopie)';delete l.cloud;if(activeList===oldId)activeList=l.id;toast('Alleen leesrechten: je wijziging is als eigen kopie bewaard.');}continue;}if(json!==l.cloud.base&&json!==l.cloud.pending?.json)l.cloud.pending={json,operation:crypto.randomUUID()};}
}
function syncCloud(){
 if(openingList)return cloudQueue.current;
 return cloudQueue.request();
}
function hasPendingCloudChanges(){
 const snapshot=catalogSnapshot(state),base=state.catalogSync?.base||{categories:[],products:[],recipes:[]};
 return state.lists.some(l=>!l.archived&&(!l.cloud||l.cloud.pending||l.cloud.conflict)) ||
  !!state.catalogSync?.pending || JSON.stringify(snapshot)!==JSON.stringify(base);
}
async function returnToSharon(){
 if(returningToSharon)return;
 if(!embedded){location.href=launch.returnUrl;return;}
 returningToSharon=true;const back=$('#returnSharon');if(back)back.disabled=true;
 try{
  if(openingList||launchPending){
   if(hasPendingCloudChanges())throw Error('Je lokale wijzigingen wachten nog op synchronisatie. Probeer teruggaan na het openen opnieuw.');
   window.parent.postMessage({type:'shop:return'},launch.hostOrigin);return;
  }
  if(saveBlocked)throw Error('Je lokale gegevens konden niet worden opgeslagen. Herstel eerst je opslag.');
  await flushBeforeReturn({sync:syncCloud,hasPending:hasPendingCloudChanges,leave:()=>window.parent.postMessage({type:'shop:return'},launch.hostOrigin)});
 }catch(error){$('#saveStatus').textContent=error.message;toast(error.message);}
 finally{returningToSharon=false;if(back)back.disabled=false;}
}
window.addEventListener('message',event=>{
 if(embedded&&event.source===window.parent&&event.origin===launch.hostOrigin&&event.data?.type==='shop:prepare-return')returnToSharon();
});
if(embedded)window.parent.postMessage({type:'shop:return-ready'},launch.hostOrigin);
async function runCloudSync(){
 if(cloudBusy||saveBlocked||document.hidden||launchPending)return;cloudBusy=true;updateCloudStatus();let syncingList,connected=false;
 try{
  if(!embedded&&!identity.saved()?.confirmed)return;
  const api=await connectSharon();
  connected=true;
  try{
   await syncAccountCatalog(state,api,identity.saved()?.self?.personId,()=>localStorage.setItem(KEY,JSON.stringify(state)));
   catalogError='';
  }catch(error){
   const messages={
    invalid_catalog:'Sharon heeft de catalogus geweigerd. De catalogus bevat ongeldige gegevens of is te groot.',
    catalog_conflict:'De catalogus is ondertussen elders gewijzigd. Synchroniseer opnieuw. Je lokale keuzes blijven bewaard.',
    unknown_action:'De opslagserver van Sharon ondersteunt deze catalogusfunctie nog niet. Werk connections.php bij.'
   };
   const message=messages[error.code]||error.message;
   if(catalogError!==message)toast(message);
   catalogError=message;
  }
  await refreshLibrary(api);
  const remote=await api.index();
  // Resolve membership before uploads, so a removed list cannot be recreated.
  for(const l of [...state.lists.filter(l=>l.cloud)]){
   const row=remote.lists.find(r=>r.id===l.id);
   if(!row){
    if(l.cloud.pending){const copy=structuredClone(l);copy.id=uid();copy.name+=' (lokale wijzigingen)';delete copy.cloud;copy.archived=true;state.lists.push(copy);}
    state.lists=state.lists.filter(r=>r!==l);
   }else {l.archived=!!row.archived;l.cloud.role=row.role;}
  }
  for(const row of remote.lists){if(state.lists.some(l=>l.id===row.id))continue;const response=await api.read(row.id),payload=response.list.payload;validate({schemaVersion:1,...payload,recipes:[],lists:[payload.list]});installSnapshot(state,payload,{revision:response.list.revision,role:response.role,base:JSON.stringify(payload),confirmedAt:Date.now()}).archived=!!row.archived;}
  // Linking makes every local list available to this identity; sharing stays explicit.
  for(const l of state.lists.filter(l=>!l.cloud&&!l.archived)){
   const payload=snapshot(state,l);let response;
   try{response=await api.write(payload,0,crypto.randomUUID(),true);}catch(e){if(e.code!=='list_exists')throw e;response=await api.read(l.id);if(JSON.stringify(response.list.payload)!==JSON.stringify(payload)){const oldId=l.id;l.id=uid();if(activeList===oldId)activeList=l.id;continue;}}
   l.cloud={revision:response.list.revision,role:response.role||'owner',base:JSON.stringify(payload),confirmedAt:Date.now()};markCloudChanges();
   localStorage.setItem(KEY,JSON.stringify(state));
  }
  if(!state.lists.some(l=>l.id===activeList&&!l.archived))activeList=launch.compact?undefined:state.lists.find(l=>!l.archived)?.id;
  localStorage.setItem(KEY,JSON.stringify(state));render();
  const linked=state.lists.filter(l=>l.cloud&&!l.archived);
  for(const l of linked){
   syncingList=l;
   if(l.cloud.conflict)continue;
   const pending=l.cloud.pending;
   if(pending){
    const response=await api.write(JSON.parse(pending.json),l.cloud.revision,pending.operation);
    l.cloud.revision=response.list.revision;l.cloud.base=pending.json;l.cloud.confirmedAt=Date.now();delete l.cloud.error;
    if(l.cloud.pending===pending)delete l.cloud.pending;
    localStorage.setItem(KEY,JSON.stringify(state));
   }else if(!$('#modal').open){
    const response=await api.read(l.id);if(l.cloud.pending||!state.lists.includes(l))continue;l.cloud.role=response.role;l.cloud.confirmedAt=Date.now();delete l.cloud.error;
    if(response.list.revision!==l.cloud.revision){
     const payload=response.list.payload;
     validate({schemaVersion:1,...payload,recipes:[],lists:[payload.list]});
     installSnapshot(state,payload,{revision:response.list.revision,role:response.role,base:JSON.stringify(payload),confirmedAt:Date.now()}).archived=l.archived;
     localStorage.setItem(KEY,JSON.stringify(state));render();
    }else localStorage.setItem(KEY,JSON.stringify(state));
   }
  }

 }catch(error){if(!connected)catalogError=error.message;for(const l of state.lists.filter(l=>l.cloud)){if(!syncingList||l===syncingList)l.cloud.error=error.message;}if(syncingList?.cloud&&/gedeelde lijst is gewijzigd|geen toegang|alleen bekijken/.test(error.message)){syncingList.cloud.conflict=true;localStorage.setItem(KEY,JSON.stringify(state));}$('#saveStatus').textContent='Lokaal bewaard · synchronisatie wacht';}
 finally{cloudBusy=false;updateCloudStatus();}
}
async function openSharonLists({fromLink=false}={}){
 if(openingList)return;openingList=true;updateCloudStatus();
 try{
  await cloudQueue.current;
  if(saveBlocked)throw Error('Herstel eerst je bestaande opslag voordat je een online lijst opent.');
  const api=await connectSharon(),remote=await api.index();
  const requested=fromLink?new URLSearchParams(location.search).get('shoplist'):null;
  if(requested){
   if(!remote.lists.some(row=>row.id===requested&&!row.archived))throw Error('Deze lijst is niet beschikbaar. Open het Sharon-lijstenmenu om je toegang en archief te bekijken.');
   await fetchSelectedList(state,api,requested);activeList=requested;
   if(!save())throw Error('De lijst kon niet blijvend worden opgeslagen.');
   launchPending=false;document.querySelector('main').inert=false;closeModal();homeSection='mylist';switchView(launch.view);
   const url=new URL(location.href);url.searchParams.delete('shoplist');history.replaceState(history.state,'',url.pathname+url.search+url.hash);return;
  }
  openModal('ShopList · Sharon',()=>{
   $('#modalBody').append(el('p','Deelrechten beheer je in Sharon. Bij een versieconflict blijft je lokale wijziging bewaard.','hint'));
   const current=list();
   if(current&&!current.cloud)$('#modalBody').append(btn('Deze lijst verbinden',async()=>{
    try{const payload=snapshot(state,current);const response=await api.write(payload,0,crypto.randomUUID(),true);current.cloud={revision:response.list.revision,role:'owner',base:JSON.stringify(payload),confirmedAt:Date.now()};save();closeModal();toast('Lijst verbonden met Sharon');}catch(e){toast(e.message);}
   }));
   for(const saved of state.lists.filter(l=>!launch.compact&&l.archived&&!l.cloud))$('#modalBody').append(btn(saved.name+' · lokale archiefkopie terugzetten',()=>{saved.archived=false;activeList=saved.id;save();closeModal();render();}));
   for(const row of remote.lists.filter(r=>!launch.compact&&r.archived))$('#modalBody').append(btn(row.name+' · terugzetten uit archief',async()=>{try{await api.archive(row.id,false);closeModal();await syncCloud();}catch(e){toast(e.message);}}));
   if(!launch.compact&&current?.cloud)$('#modalBody').append(btn('Deze lijst archiveren',async()=>{try{await api.archive(current.id,true);closeModal();await syncCloud();}catch(e){toast(e.message);}}));
   for(const row of remote.lists.filter(r=>!r.archived&&(!launch.compact||r.id===activeList)))$('#modalBody').append(btn(row.name+' · openen / online versie ophalen',async()=>{
    try{
     const existing=state.lists.find(l=>l.id===row.id);const response=await api.read(row.id),payload=response.list.payload;
     validate({schemaVersion:1,...payload,recipes:[],lists:[payload.list]});
     if(existing&&JSON.stringify(snapshot(state,existing))!==JSON.stringify(payload)){const copy=structuredClone(existing);copy.id=uid();copy.name+=' (lokale wijzigingen)';delete copy.cloud;state.lists.push(copy);}
     installSnapshot(state,payload,{revision:response.list.revision,role:response.role,base:JSON.stringify(payload),confirmedAt:Date.now()});activeList=row.id;save();closeModal();render();
    }catch(e){toast(e.message);}
   }));
   const link=el('a','Delen en toegang beheren in Sharon');link.href='https://stefan-van-dijk.github.io/sharon/';$('#modalBody').append(link);
  },()=>true,'Sluiten');
 }catch(e){if(embedded||identity.saved()?.confirmed)openModal('Lijst openen',()=>{$('#modalBody').append(el('p',e.message));if(launchPending)$('#modalBody').append(btn('Opnieuw proberen',()=>{closeModal();openSharonLists({fromLink:true});}));},()=>true,'Sluiten');else openPairing(e.message);}
 finally{openingList=false;updateCloudStatus();if(embedded&&!launchPending)queueMicrotask(()=>syncCloud());}
}
function pairingLabel(){
 const saved=identity.saved();if(embedded){$('#sharonConnection').hidden=true;$('#pairFromClipboard').hidden=true;return;}$('#sharonConnection').hidden=!saved?.confirmed;$('#sharonConnection').textContent='Sharon · verbinding beheren';$('#pairFromClipboard').hidden=!!saved?.confirmed;
}
function openPairing(message=''){
 openModal('Verbinding met Sharon',()=>{
  const body=$('#modalBody');body.append(el('p',message||'Kopieer in Sharon een koppelcode en kies in het menu ‘Koppelen met Sharon’. Je lokale lijsten worden niet automatisch gedeeld.','hint'));
  const link=el('a','Open Sharon → Notities en lijsten → Shop verbinden');link.href='https://stefan-van-dijk.github.io/sharon/';link.target='_blank';link.rel='noopener';body.append(link);
  if(identity.saved())body.append(btn('Deze Shop loskoppelen',async()=>{try{if(identity.saved()?.confirmed)await identity.request('shop-device-revoke');identity.forget();pairingLabel();closeModal();toast('Shop werkt zelfstandig. Je lijsten zijn bewaard.');}catch(e){toast(e.message);}}));
 },()=>true,'Sluiten');
}
$('#sharonConnection').onclick=()=>openPairing();pairingLabel();
$('#sharonLists').onclick=openSharonLists;

window.addEventListener('online',updateCloudStatus);
if(new URLSearchParams(location.search).has('shoplist'))openSharonLists({fromLink:true});

function updateCloudStatus(){
 const busy=cloudBusy||catalogLoading||openingList||pairingLoading;
 for(const logo of [$('#manageLogo'),$('#returnSharon')].filter(Boolean)){logo.classList.toggle('is-loading',busy);logo.classList.toggle('needs-sync',!!list()?.cloud?.pending);logo.setAttribute('aria-busy',String(busy));logo.title=busy?'Laden en synchroniseren…':logo.id==='returnSharon'?'Terug naar Sharon':'Menu openen en synchroniseren';}
 const button=$('#listSyncStatus');if(!button)return;
 const status=listSyncStatus(list(),{online:navigator.onLine,busy:cloudBusy});button.textContent=status.label;button.dataset.state=status.state;button.title=status.detail;button.setAttribute('aria-label',status.label+'. '+status.detail);
}
$('#listSyncStatus').onclick=()=>{if(!list()?.cloud||list().cloud.conflict)openSharonLists();else syncCloud();};
window.addEventListener('offline',updateCloudStatus);
document.addEventListener('visibilitychange',updateCloudStatus);
setInterval(updateCloudStatus,10000);
setInterval(()=>{if(!document.hidden&&!$('#modal').open)syncCloud();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncCloud();});
updateCloudStatus();syncCloud();

const clipboardPairing=new ClipboardPairing(identity,{
 show:(label,error)=>{const item=$('#pairFromClipboard');item.hidden=!!identity.saved()?.confirmed;item.textContent='Koppelen met Sharon';item.title=error||'';$('#pairClipboardMessage').textContent=error||(!label&&!identity.saved()?.confirmed?'Geen geldige koppelcode gevonden. Kopieer eerst een code in Sharon.':'');},
 success:self=>{pairingLabel();toast('Verbonden met Sharon · '+self.name);if(new URLSearchParams(location.search).has('shoplist'))openSharonLists({fromLink:true});else syncCloud();}
});
$('#pairFromClipboard').onclick=async()=>{pairingLoading=true;updateCloudStatus();try{await clipboardPairing.connect();}finally{pairingLoading=false;updateCloudStatus();}};
const menuTrigger=$('#shopMenuBrand')||$('#manageLogo');
menuTrigger.onclick=()=>{
 const opening=$('#appMenu').hidden;$('#appMenu').hidden=!opening;menuTrigger.setAttribute('aria-expanded',String(opening));pairingLabel();
 if(opening&&(embedded||identity.saved()?.confirmed))syncCloud();
};

document.addEventListener('click',event=>{if(!event.target.closest('#appMenu,#manageLogo,#shopMenuBrand'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#appMenu').hidden){closeMenu();menuTrigger.focus();}});
$('#appMenu').addEventListener('click',event=>{if(event.target.closest('#sharonLists,#sharonConnection'))closeMenu();});

if(launch.view==='catalog'){
 switchView('catalog');
 if(launch.collectionId)openRequestedCollection(launch.collectionId);
}

function openRequestedCollection(id){
 libraryAction(async api=>{
  await cloudQueue.current;
  const {collections}=await api.library('index');
  const collection=collections.find(row=>row.id===id);
  if(!collection)throw Error('Deze gedeelde catalogus is niet beschikbaar.');
  if(view==='catalog'&&!$('#modal').open)openSharedCollection(collection);
 });
}

function shareCatalog(categoryId=null,collectionId=null){
 libraryAction(async()=>{
  await syncCloud();
  if(catalogError)throw Error(catalogError);
  if(saveBlocked)throw Error('ShopList kan je wijzigingen niet lokaal bewaren. Herstel eerst de lokale opslag en probeer opnieuw.');
  if(state.catalogSync?.pending||JSON.stringify(catalogSnapshot(state))!==JSON.stringify(state.catalogSync?.base||{}))throw Error('De catalogus is nog niet opgeslagen in Sharon. Probeer opnieuw zodra de synchronisatie is voltooid.');
  if(embedded){
   window.parent.postMessage({type:'shop:catalog-share',categoryId,collectionId},launch.hostOrigin);
  }else{
   const target=new URL(launch.returnUrl);target.searchParams.set('catalog','share');
   if(categoryId)target.searchParams.set('category',categoryId);
   if(collectionId)target.searchParams.set('collection',collectionId);
   location.href=target.href;
  }
 });
}
function renderCatalog(){
 const target=$('#catalogContent');target.replaceChildren();
 const category=state.categories.find(row=>!row.remoteId&&row.id===catalogSelection&&row.name!=='Home');
 const tools=el('div',undefined,'toolbar');
 tools.append(btn('+ Product',()=>editProduct()),btn('+ Categorie',()=>$('#newCategory').click(),'secondary'),btn('Delen via Sharon',()=>shareCatalog(category?.id||null),'secondary'));
 target.append(tools);
 const layout=el('div',undefined,'catalogLayout'),tree=el('aside',undefined,'catalogTree');tree.setAttribute('aria-label','Categorieboom');
 const select=(id)=>{catalogSelection=id;renderCatalog();};
 const all=btn('Alle producten',()=>select(''),'quiet');all.setAttribute('aria-pressed',String(!catalogSelection));tree.append(all);
 function draw(nodes,parent){for(const {category,children}of nodes){const item=el('div',undefined,'catalogBranch');const choice=btn(category.name,()=>select(category.id),'quiet');choice.setAttribute('aria-pressed',String(catalogSelection===category.id));if(children.length){const details=el('details'),summary=el('summary',category.name);details.open=true;details.append(summary,choice);draw(children,details);item.append(details);}else item.append(choice);parent.append(item);}}
 draw(categoryTree(state.categories),tree);
 const content=el('div',undefined,'catalogProducts');content.append(el('h2',category?.name||(catalogSelection?'Categorie ophalen':'Alle producten')));
 if(category)content.append(btn('Categorie indelen',()=>editCategoryParents(category),'quiet'));
 else if(catalogSelection)content.append(el('p','De gekozen categorie is nog niet beschikbaar in ShopList.','muted'));
 const search=el('input');search.type='search';search.placeholder='Zoek in de catalogus…';search.setAttribute('aria-label','Zoek in de catalogus');search.value=catalogQuery;
 const rows=el('div');const paint=()=>{rows.replaceChildren();const source=catalogSelection?branchProducts(state,catalogSelection):state.products.filter(p=>!p.remoteId);const filtered=source.filter(p=>matchesProduct(p,norm(catalogQuery))).sort((a,b)=>a.name.localeCompare(b.name,'nl'));rows.append(el('p',filtered.length+' producten','muted'));for(const p of filtered){const row=el('div',undefined,'row');row.append(el('span',p.name,'text'),btn('Bewerken',()=>editProduct(p),'quiet'));rows.append(row);}};
 search.oninput=()=>{catalogQuery=search.value;paint();};content.append(search,rows);paint();layout.append(tree,content);target.append(layout);
 if(embedded||identity.saved()?.confirmed)target.append(btn('Gedeelde catalogi',openCollections,'secondary'));
}
