export class AppInstallation {
 constructor({window:win,navigator:nav,onChange=()=>{}}){
  this.win=win;this.nav=nav;this.onChange=onChange;this.pending=null;this.installed=false;this.busy=false;
  this.capture=e=>{e.preventDefault();this.pending=e;this.notify();};
  this.complete=()=>{this.installed=true;this.pending=null;this.notify();};
  win.addEventListener('beforeinstallprompt',this.capture);win.addEventListener('appinstalled',this.complete);
 }
 get mode(){return this.installed||this.nav.standalone===true||this.win.matchMedia?.('(display-mode: standalone)').matches?'installed':this.pending?'prompt':/iPad|iPhone|iPod/.test(this.nav.userAgent)||this.nav.platform==='MacIntel'&&this.nav.maxTouchPoints>1?'ios':'manual';}
 notify(){this.onChange(this.mode);}
 async check(){try{const apps=await this.nav.getInstalledRelatedApps?.();const manifest=new URL('manifest.webmanifest',this.win.location.href).href;if(apps?.some(a=>a.platform==='webapp'&&a.url===manifest))this.installed=true;}catch{}this.notify();}
 async install(){if(this.busy||!this.pending)return;this.busy=true;const event=this.pending;this.pending=null;try{await event.prompt();const result=await event.userChoice;return result.outcome;}finally{this.busy=false;this.notify();}}
 destroy(){this.win.removeEventListener('beforeinstallprompt',this.capture);this.win.removeEventListener('appinstalled',this.complete);}
}

if(typeof document!=='undefined'){
 const panel=document.createElement('dialog');panel.className='installPanel';panel.setAttribute('aria-label','ShopList op je beginscherm');
 const heading=document.createElement('h2');heading.textContent='ShopList. Altijd bij de hand.';
 const copy=document.createElement('p'),status=document.createElement('p');status.setAttribute('role','status');
 const install=document.createElement('button');install.type='button';install.textContent='Installeer ShopList';
 const close=document.createElement('button');close.type='button';close.textContent='Verder met mijn boodschappen';close.onclick=()=>panel.close();
 panel.append(heading,copy,install,status,close);document.body.append(panel);
 const menu=document.createElement('button');menu.type='button';menu.textContent='ShopList op je beginscherm';menu.onclick=()=>{panel.showModal();controller.check();};document.querySelector('#appMenu')?.append(menu);
 const controller=new AppInstallation({window,navigator,onChange:mode=>{menu.hidden=mode==='installed';install.hidden=mode!=='prompt';copy.textContent=mode==='installed'?'ShopList is klaar voor gebruik. Open de app voortaan via het icoon op je beginscherm.':mode==='prompt'?'Voeg ShopList toe voor snelle toegang tot je boodschappen.':mode==='ios'?'Open deze pagina in Safari. Tik op Delen, kies Zet op beginscherm en bevestig met Voeg toe. Kies Open als webapp als die optie verschijnt.':'Open het menu van je browser en kies App installeren of Toevoegen aan beginscherm. Open ShopList daarna via het nieuwe icoon.';}});
 install.onclick=async()=>{install.disabled=true;try{const outcome=await controller.install();status.textContent=outcome==='accepted'?'De installatie is aangevraagd.':outcome==='dismissed'?'Je kunt ShopList later toevoegen.':'';}catch{status.textContent='Open het browsermenu om ShopList toe te voegen.';}finally{install.disabled=false;}};
 controller.notify();controller.check();if(new URLSearchParams(location.search).get('install')==='1')panel.showModal();
}
