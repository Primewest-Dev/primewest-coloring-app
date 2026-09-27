/* The Last Ember Post · Coloring (prototype). Plain JS, no dependencies, works offline and from file://. */
(()=>{
'use strict';
const SC=(window.EP_SCENES=window.EP_SCENES||{});
/* chapters: data-driven from data/story.js; falls back to whatever scene files were loaded statically */
const STORY=window.EP_STORY||{chapters:Object.keys(SC).map(Number).sort((a,b)=>a-b).map(n=>({n,title:SC[n].title,teaser:SC[n].caption,story:SC[n].caption,data:null,thumb:SC[n].thumb}))};
const CH=STORY.chapters, CHM={}; CH.forEach(c=>CHM[c.n]=c);
const PLAY=CH.filter(c=>c.data||SC[c.n]);           // chapters that have art in this build, in story order
const IDS=PLAY.map(c=>c.n);
/* ---------- persistence (localStorage, all keys prefixed ep.v1.) ---------- */
const LS={get(k,d){try{const v=localStorage.getItem('ep.v1.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('ep.v1.'+k,JSON.stringify(v));return true;}catch(e){console.warn('save failed',k,e);return false;}},
  del(k){try{localStorage.removeItem('ep.v1.'+k);}catch(e){}},
  wipe(){try{Object.keys(localStorage).filter(k=>k.startsWith('ep.v1.')).forEach(k=>localStorage.removeItem(k));}catch(e){}}};
const settings=Object.assign({story:true},LS.get('settings',{}));
const prog=Object.assign({unlocked:[],done:[],current:null},LS.get('progress',{}));
if(IDS.length&&!prog.unlocked.includes(IDS[0]))prog.unlocked.unshift(IDS[0]);
const saveProg=()=>LS.set('progress',prog);
const isUnlocked=n=>!settings.story||prog.unlocked.includes(n);
const isDone=n=>prog.done.includes(n);
const nextOf=n=>{const i=IDS.indexOf(n);return i>=0&&i<IDS.length-1?CHM[IDS[i+1]]:null;};
const W=1600,H=900;
const EXTRA=['#1f1d22','#2b2320','#5a3a2a','#8b5a3c','#c47f4a','#e3b36b','#f2d38a','#f6e7c1','#ffcf9f','#e98a6a','#c9473d','#8e1f2c',
             '#6b2a4f','#a0579a','#6c5ba7','#3b3f8f','#2f6db5','#5aa7d6','#9fd3e0','#2f8a7e','#4c9a5b','#9cc36b','#3e5b34','#7d8c96'];
const PENCIL_R=[3,6.5,12], ERASER_R=[8,16,30];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const app=$('#app'), stage=$('#stage'), zoomer=$('#zoomer'), layers=$('#layers'), lineImg=$('#line');
const strokeC=$('#stroke'), dimC=$('#dim'), glowC=$('#glow'), numC=$('#nums');
const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c};
[strokeC,dimC,glowC,numC].forEach(c=>{c.width=W;c.height=H});
const sctx=strokeC.getContext('2d'), dctx=dimC.getContext('2d'), gctx=glowC.getContext('2d'), nctx=numC.getContext('2d');
const covC=mk(), cov=covC.getContext('2d'), maskC=mk(), mctx=maskC.getContext('2d');
let mode='cbn', tool='pencil', sizeIdx=1, clip=settings.lineLock!==false, color=EXTRA[10], S=null, selNum=1;
const cache={};
const hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

/* ---------- pencil textures ---------- */
const tip=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return c})();
const grain=(()=>{const n=256,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');const im=x.createImageData(n,n);
  let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const row=new Float32Array(n*n);for(let i=0;i<n*n;i++)row[i]=rnd();
  for(let y=0;y<n;y++)for(let X=0;X<n;X++){ // paper tooth: noise smeared along a slight diagonal
    const i=y*n+X, j=((y+1)%n)*n+((X+1)%n), k=((y+2)%n)*n+((X+3)%n);
    const v=(row[i]*.5+row[j]*.3+row[k]*.2); const a=Math.min(1,Math.max(0,(v-.18)*1.55));
    im.data[i*4+3]=Math.round(60+195*a*a);}
  x.putImageData(im,0,0);return c})();
let grainPat=null;
/* ---------- premium inks (metallic, glitter, neon) + brushes ---------- */
const PREMIUM=[
  {id:'m-gold',kind:'metal',hex:'#d4af37',name:'Gold'},{id:'m-silver',kind:'metal',hex:'#c4c8ce',name:'Silver'},
  {id:'m-copper',kind:'metal',hex:'#b87333',name:'Copper'},{id:'m-rose',kind:'metal',hex:'#d19a92',name:'Rose gold'},
  {id:'m-bronze',kind:'metal',hex:'#a0703c',name:'Bronze'},
  {id:'g-gold',kind:'glitter',hex:'#e2b54a',name:'Gold glitter'},{id:'g-silver',kind:'glitter',hex:'#c9ced6',name:'Silver glitter'},
  {id:'g-rose',kind:'glitter',hex:'#e7729f',name:'Rose glitter'},{id:'g-emerald',kind:'glitter',hex:'#27a178',name:'Emerald glitter'},
  {id:'g-sapphire',kind:'glitter',hex:'#3a6ad6',name:'Sapphire glitter'},{id:'g-amethyst',kind:'glitter',hex:'#9a5ae3',name:'Amethyst glitter'},
  {id:'n-pink',kind:'neon',hex:'#ff3cac',name:'Neon pink'},{id:'n-cyan',kind:'neon',hex:'#22e4ff',name:'Neon cyan'},
  {id:'n-lime',kind:'neon',hex:'#a6ff3a',name:'Neon lime'},{id:'n-orange',kind:'neon',hex:'#ff9d2a',name:'Neon orange'},
  {id:'n-violet',kind:'neon',hex:'#b44bff',name:'Neon violet'},
  {id:'c-silver',kind:'chrome',hex:'#d9dde3',name:'Chrome silver'},{id:'c-gold',kind:'chrome',hex:'#e8c25a',name:'Chrome gold'},
  {id:'c-blue',kind:'chrome',hex:'#5b8fe0',name:'Chrome blue'},{id:'c-rose',kind:'chrome',hex:'#e89aa8',name:'Chrome rose'},
  {id:'c-black',kind:'chrome',hex:'#3a3f48',name:'Black chrome'},
  {id:'w-amber',kind:'glow',hex:'#ffb347',name:'Lantern glow'},{id:'w-rose',kind:'glow',hex:'#ff7a9c',name:'Rose glow'},
  {id:'w-mint',kind:'glow',hex:'#7dffc4',name:'Mint glow'},{id:'w-sky',kind:'glow',hex:'#7cc8ff',name:'Sky glow'},
  {id:'w-violet',kind:'glow',hex:'#c79bff',name:'Violet glow'},
  {id:'p-ember',kind:'pulse',hex:'#ff7b2e',name:'Ember pulse'},{id:'p-gold',kind:'pulse',hex:'#ffd257',name:'Gold pulse'},
  {id:'p-aqua',kind:'pulse',hex:'#3fe0d0',name:'Aqua pulse'},{id:'p-magenta',kind:'pulse',hex:'#ff4fd8',name:'Magenta pulse'},
  {id:'p-ice',kind:'pulse',hex:'#a9d8ff',name:'Ice pulse'},
  {id:'airbrush',kind:'brush',name:'Soft airbrush'},{id:'watercolor',kind:'brush',name:'Watercolor wash'}];
const PREM={};PREMIUM.forEach(p=>PREM[p.id]=p);
let ink={kind:'plain',hex:color,id:null};
const grainA=(()=>{const d=grain.getContext('2d').getImageData(0,0,256,256).data,a=new Uint8Array(65536);for(let i=0;i<65536;i++)a[i]=d[i*4+3];return a;})();
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const WHITE=[255,255,255];
function metalRamp(rgb){return {dark:rgb.map(v=>v*.38),mid:rgb,light:mix(rgb,WHITE,.55)};}
function metalAt(rgb,v){const m=metalRamp(rgb);let c=v<.5?mix(m.dark,m.mid,v*2):mix(m.mid,m.light,(v-.5)*2);const sp=Math.max(0,v-.84)/.16;return mix(c,WHITE,sp*.85);}
function chromeAt(rgb,t){t=((t%1)+1)%1; // mirror-like: sky gradient, bright rim, sharp dark horizon, ground bounce
  const K=[[0,rgb.map(v=>v*.22)],[.28,rgb.map(v=>v*.9)],[.44,mix(rgb,WHITE,.8)],[.49,WHITE],[.505,rgb.map(v=>v*.08)],[.62,rgb.map(v=>v*.35)],[.86,mix(rgb,WHITE,.35)],[.94,mix(rgb,WHITE,.9)],[1,rgb.map(v=>v*.22)]];
  for(let i=1;i<K.length;i++)if(t<=K[i][0]){const a=K[i-1],b=K[i];return mix(a[1],b[1],(t-a[0])/(b[0]-a[0]));}return K[0][1];}
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967295;}
/* 256px seamless tile used to "paint through" the stroke coverage (anchored to the page, like paper tooth) */
function inkTile(k,hex,style){
  const n=256,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');const rgb=hex2rgb(hex);
  if(k==='plain'&&!style){x.fillStyle=hex;x.fillRect(0,0,n,n);x.globalCompositeOperation='destination-in';x.drawImage(grain,0,0);return c;}
  const im=x.createImageData(n,n),D=im.data,T=Math.PI*2;
  const vn=new Float32Array(17*17);for(let i=0;i<vn.length;i++)vn[i]=hash2(i*7+3,i*13+1);   // low-frequency noise (watercolor)
  for(let i=0;i<17;i++){vn[i*17+16]=vn[i*17];vn[16*17+i]=vn[i];}
  for(let yy=0;yy<n;yy++)for(let xx=0;xx<n;xx++){const i=yy*n+xx,j=i*4,g=grainA[i]/255;let col=rgb,a=255;
    if(style==='water'){const fx=xx/16,fy=yy/16,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,q=(u,v)=>vn[v*17+u];
      const v=(q(ix,iy)*(1-tx)+q(ix+1,iy)*tx)*(1-ty)+(q(ix,iy+1)*(1-tx)+q(ix+1,iy+1)*tx)*ty; col=rgb.map(c=>c*(.88+.14*v));a=110+110*v;}
    else if(style==='air'){a=255;}
    else if(k==='metal'){let v=.55*(.5+.5*Math.sin(T*(xx+yy)/n))+.45*(.5+.5*Math.sin(T*2*(xx-yy)/n+1.3));v=Math.pow(v,1.25);
      col=metalAt(rgb,v);a=205+50*g;}
    else if(k==='glitter'){const h=hash2(xx,yy);col=rgb.map(c=>c*(.78+.18*g));a=200+40*g;
      if(h<.075){col=mix(rgb,WHITE,.7+.3*hash2(yy,xx));a=255;}else if(h<.11){col=rgb.map(c=>c*.45);a=255;}}
    else if(k==='neon'){col=mix(rgb,WHITE,.28);a=225+30*g;}
    else if(k==='chrome'){const t=(xx*.35+yy)/n*2+.06*Math.sin(T*xx/n*2);col=chromeAt(rgb,t);a=235+20*g;}
    else if(k==='glow'){col=mix(rgb,WHITE,.18);a=230+25*g;}
    else if(k==='pulse'){col=mix(rgb,WHITE,.1*g);a=225+30*g;}
    D[j]=col[0];D[j+1]=col[1];D[j+2]=col[2];D[j+3]=a;}
  x.putImageData(im,0,0);
  if(k==='glitter'&&!style){x.fillStyle='rgba(255,255,255,.95)';  // star glints
    for(let s=0;s<22;s++){const gx=12+hash2(s,91)*(n-24),gy=12+hash2(91,s)*(n-24),L=2+hash2(s,s)*4;x.fillRect(gx-L,gy-.6,2*L,1.2);x.fillRect(gx-.6,gy-L,1.2,2*L);}}
  return c;}
function setGrainColor(hex){grainPat=sctx.createPattern(inkTile('plain',hex),'repeat');}
function strokeStyle(){return tool==='airbrush'?'air':tool==='watercolor'?'water':null;}
function setInkPattern(){const st=strokeStyle();grainPat=sctx.createPattern(inkTile(st?'plain':ink.kind,ink.hex,st),'repeat');}
/* fill shading for the tap-to-fill tool (premium inks get a metallic gradient + highlight, sparkle, or a neon core) */
function shader(bx,by,bw,bh){const rgb=hex2rgb(ink.hex);
  if(ink.kind==='metal'){const hx=bx+bw*.3,hy=by+bh*.26,sx=Math.max(8,bw*.24),sy=Math.max(8,bh*.18);
    return (x,y)=>{const u=((x-bx)/bw+(y-by)/bh)/2;let v=.5+.45*Math.sin(u*Math.PI*2.1-.5);let c=metalAt(rgb,v);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,hl*.55);};}
  if(ink.kind==='chrome'){const hx=bx+bw*.28,hy=by+bh*.22,sx=Math.max(4,bw*.08),sy=Math.max(4,bh*.05);
    return (x,y)=>{const t=((y-by)/(bh||1))*.95+((x-bx)/(bw||1))*.18+.03*Math.sin(x*.05);let c=chromeAt(rgb,t);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,Math.min(1,hl*1.2));};}
  if(ink.kind==='glow'){const cx=bx+bw/2,cy=by+bh/2;const core=mix(rgb,WHITE,.35);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,d);};}
  if(ink.kind==='glitter')return (x,y)=>{const h=hash2(x,y),g=grainA[(y&255)*256+(x&255)]/255;
    return h<.06?mix(rgb,WHITE,.75+.25*hash2(y,x)):h<.1?rgb.map(c=>c*.5):rgb.map(c=>c*(.8+.18*g));};
  if(ink.kind==='neon'){const cx=bx+bw/2,cy=by+bh/2,R=Math.max(bw,bh)/2||1;const core=mix(rgb,WHITE,.45);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,Math.pow(d,.8));};}
  return ()=>rgb;}
/* entitlement: demo unlock, codes, and a hook for Stripe / license servers (see premium-config.js) */
const RAWCFG=window.EP_PREMIUM_CONFIG||{};
const PCFG=Object.assign({mode:'demo',verifyUrl:'',licenseCheckUrl:''},RAWCFG);
PCFG.products=Object.assign({
  pencils:{productId:RAWCFG.productId||'emberpost-premium-pencils',productName:RAWCFG.productName||'Premium Pencils',price:RAWCFG.price||'$2.99',
    stripePaymentLink:RAWCFG.stripePaymentLink||'',demoCodes:RAWCFG.demoCodes||[],storageKey:RAWCFG.storageKey||'ep.premium.v1'},
  palettes:{productId:'emberpost-all-palettes',productName:'All Palettes',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.palettes.v1'},
  effects3d:{productId:'emberpost-effects-3d',productName:'3D Pop',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.effects3d.v1'}},RAWCFG.products||{});
PCFG.ownerCodes=RAWCFG.ownerCodes||[];
PCFG.price=PCFG.products.pencils.price;
const ENT={};
function makeEntitlement(key){const P=PCFG.products[key];
  return ENT[key]={key,P,
    state(){try{return JSON.parse(localStorage.getItem(P.storageKey)||'null');}catch(e){return null;}},
    unlocked(){const s=this.state();return !!(s&&s.unlocked);},
    grant(source){try{localStorage.setItem(P.storageKey,JSON.stringify({unlocked:true,source,product:P.productId,at:new Date().toISOString()}));}catch(e){}onEntitlement(key);},
    revoke(){try{localStorage.removeItem(P.storageKey);}catch(e){}onEntitlement(key,true);},
    async buy(){
      if(PCFG.mode==='stripe-link'&&P.stripePaymentLink){location.href=P.stripePaymentLink;return {ok:false,msg:'Opening secure checkout…'};}
      if(PCFG.mode==='demo'){this.grant('demo-buy');return {ok:true,msg:'Demo unlock (no payment taken)'};}
      return {ok:false,msg:'Purchases are not available in this build.'};},
    async check(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();return !!j.valid;}};}
const Premium=makeEntitlement('pencils'), Palettes=makeEntitlement('palettes'), Effects3D=makeEntitlement('effects3d');
/* a code can unlock any product: the one whose code it is (demo codes, or the license server per product) */
async function redeemCode(raw,prefer){const code=String(raw||'').trim().toUpperCase();if(!code)return {ok:false,msg:'Type your code first.'};
  const keys=[prefer,...Object.keys(ENT).filter(k=>k!==prefer)];
  if(PCFG.licenseCheckUrl){try{for(const k of keys){if(await ENT[k].check(PCFG.licenseCheckUrl,{code,product:ENT[k].P.productId})){ENT[k].grant('code');return {ok:true,key:k,msg:`Code accepted. ${ENT[k].P.productName} unlocked.`};}}
      return {ok:false,msg:'That code isn\u2019t valid.'};}catch(e){return {ok:false,msg:'Couldn\u2019t check the code. Are you online?'};}}
  if(PCFG.mode==='demo'&&PCFG.ownerCodes.map(c=>String(c).toUpperCase()).includes(code)){Object.values(ENT).forEach(e=>e.grant('owner-code'));
    return {ok:true,key:'all',msg:'Owner code accepted: everything is unlocked on this device (no payment taken).'};}
  if(PCFG.mode==='demo')for(const k of keys)if((ENT[k].P.demoCodes||[]).map(c=>String(c).toUpperCase()).includes(code)){ENT[k].grant('demo-code');
      return {ok:true,key:k,msg:`Demo code accepted: ${ENT[k].P.productName} unlocked (no payment taken).`};}
  return {ok:false,msg:'That code isn\u2019t valid.'};}
Object.values(ENT).forEach(e=>e.redeem=raw=>redeemCode(raw,e.key));
async function handleReturn(){ // Stripe Payment Link success URL -> ?premium=return&product=...&session_id=... ; verified by YOUR server only
  const q=new URLSearchParams(location.search);if(PCFG.mode!=='stripe-link'||q.get('premium')!=='return'||!PCFG.verifyUrl)return;
  const e=ENT[q.get('product')||'pencils'];
  try{if(e&&await e.check(PCFG.verifyUrl,{session_id:q.get('session_id'),product:e.P.productId})){e.grant('stripe');toast(e.P.productName+' unlocked. Thank you!');}}catch(err){}
  history.replaceState(null,'',location.pathname);}
function onEntitlement(key,revoked){if(key==='effects3d'){refreshPremiumUI();return;}
  if(key==='pencils'){if(revoked){if(ink.id){ink={kind:'plain',hex:EXTRA[10],id:null};color=ink.hex;}if(PREM[tool])setTool('pencil');setInkPattern();}refreshPremiumUI();}
  else{buildPalette();refreshPremiumUI();}}

/* ---------- scene loading ---------- */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;})}
function needData(n){return new Promise((res,rej)=>{
  if(SC[n])return res(SC[n]); const c=CHM[n]; if(!c||!c.data)return rej(new Error('no data for scene '+n));
  const sc=document.createElement('script');sc.src=c.data;sc.onload=()=>SC[n]?res(SC[n]):rej(new Error('bad data '+n));sc.onerror=rej;document.head.appendChild(sc);});}
async function loadScene(n){
  if(cache[n])return cache[n];
  await needData(n);
  const d=SC[n]; const img=await loadImg(d.labels);
  const t=mk().getContext('2d',{willReadFrequently:true}); t.drawImage(img,0,0); const px=t.getImageData(0,0,W,H).data;
  const lab=new Int32Array(W*H); let N=0;
  for(let i=0,j=0;i<W*H;i++,j+=4){const v=px[j]|(px[j+1]<<8);lab[i]=v;if(v>N)N=v;} N++;
  const cnt=new Int32Array(N), bb=new Int32Array(N*4);
  for(let r=0;r<N;r++){bb[r*4]=W;bb[r*4+1]=H;bb[r*4+2]=-1;bb[r*4+3]=-1;}
  for(let i=0;i<W*H;i++){const r=lab[i];cnt[r]++;const x=i%W,y=(i/W)|0,b=r*4;
    if(x<bb[b])bb[b]=x;if(y<bb[b+1])bb[b+1]=y;if(x>bb[b+2])bb[b+2]=x;if(y>bb[b+3])bb[b+3]=y;}
  const off=new Int32Array(N+1);for(let r=0;r<N;r++)off[r+1]=off[r]+cnt[r];
  const fillp=off.slice(0,N), pix=new Int32Array(W*H);for(let i=0;i<W*H;i++)pix[fillp[lab[i]]++]=i;
  const num=new Uint8Array(N), tgt=new Uint8Array(N), fs=new Uint8Array(N), cx=new Float32Array(N), cy=new Float32Array(N);
  for(const [id,k,x,y,f,tg] of d.regions){num[id]=k;cx[id]=x;cy[id]=y;fs[id]=f;tg&&(tgt[id]=1);}
  const K=d.palette.length, pal=d.palette.map(hex2rgb), totT=new Int32Array(K+1);
  for(let k=1;k<=K;k++){ // every colour needs at least one tappable region: promote its largest region
    let best=0;for(let r=1;r<N;r++)if(num[r]===k){if(tgt[r]){best=-1;break;}if(!best||cnt[r]>cnt[best])best=r;}
    if(best>0)tgt[best]=1;}
  let total=0; for(let r=1;r<N;r++)if(num[r]&&tgt[r]){totT[num[r]]++;total++;}
  const cbnC=mk(), freeC=mk();
  const st={n,d,lab,N,cnt,bb,off,pix,num,tgt,fs,cx,cy,K,pal,totT,total,
    cbn:{c:cbnC,ctx:cbnC.getContext('2d'),img:null,filled:new Uint8Array(N),doneT:new Int32Array(K+1),done:0,hist:[],complete:false},
    free:{c:freeC,ctx:freeC.getContext('2d',{willReadFrequently:true}),undo:[]}};
  st.cbn.img=st.cbn.ctx.createImageData(W,H);
  await restoreScene(st);
  return cache[n]=st;
}

/* ---------- UI build ---------- */
const LOCK='<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function thumbOf(n){return LS.get('thumb.'+n,null)||(CHM[n]&&CHM[n].thumb)||(SC[n]&&SC[n].thumb)||'';}
function buildScenes(){const nav=$('#scenes');nav.innerHTML='';
  IDS.forEach(n=>{const c=CHM[n],lk=!isUnlocked(n),b=document.createElement('button');
    b.className='scene'+(lk?' locked':'')+(isDone(n)&&settings.story?' done':'');b.dataset.n=n;b.title=lk?'Locked: '+c.teaser:c.title;
    b.innerHTML=`<div class="th"><img src="${thumbOf(n)}" alt="">${lk?LOCK:''}</div><div class="tx"><b>Chapter ${n}</b><span>${esc(lk?c.teaser:c.title)}</span></div>`;
    b.onclick=()=>showScene(n);nav.appendChild(b);});
  const sc=document.createElement('button');sc.className='scene showcase';sc.title='See the premium effects';
  sc.innerHTML=`<div class="th"><img id="showThumb" alt="">${''}</div><div class="tx"><b>✦ Effects</b><span>3D Pop + gold</span></div>`;
  sc.onclick=openShowcase;nav.appendChild(sc);if(showcaseURL)sc.querySelector('img').src=showcaseURL;
  if(S)$$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===S.n));}
function storyStrip(){
  const c=CHM[S.n]||{title:S.d.title,teaser:S.d.caption,story:S.d.caption}, reveal=!settings.story||isDone(S.n);
  $('#stitle').textContent=`Chapter ${S.n} · ${c.title}`;
  $('#scap').textContent=reveal?c.story:c.teaser+(c.teaser!==c.story?' \u2026':'');
  app.classList.toggle('teaser',!reveal); app.classList.toggle('storyon',!!settings.story);}
function pencilSVG(c){return `<svg viewBox="0 0 30 74"><path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${c}"/>
 <rect x="8.5" y="19" width="13" height="47" fill="${c}"/><rect x="10.5" y="19" width="2.5" height="47" fill="#fff" opacity=".22"/>
 <rect x="18" y="19" width="3.5" height="47" fill="#000" opacity=".18"/><rect x="8.5" y="64" width="13" height="9" rx="1.5" fill="#c8ad80"/></svg>`}
function premiumIcon(p){
  if(p.kind==='brush')return p.id==='airbrush'
    ?`<svg viewBox="0 0 30 74"><defs><radialGradient id="ab" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#9aa3ad"/></radialGradient></defs>
      <circle cx="15" cy="9" r="7" fill="${ink.hex}" opacity=".35"/><circle cx="15" cy="9" r="3.5" fill="${ink.hex}" opacity=".7"/><rect x="11" y="18" width="8" height="10" rx="2" fill="#6f7780"/>
      <rect x="8" y="27" width="14" height="42" rx="5" fill="url(#ab)"/><rect x="12" y="34" width="6" height="14" rx="2" fill="#3f454c"/></svg>`
    :`<svg viewBox="0 0 30 74"><path d="M15 2c4 6 6 10 6 14a6 6 0 01-12 0c0-4 2-8 6-14z" fill="${ink.hex}" opacity=".8"/>
      <rect x="11" y="22" width="8" height="8" fill="#c9c9c9"/><path d="M11 30h8l-1 40h-6z" fill="#6b4a2f"/><rect x="11" y="22" width="8" height="2" fill="#fff" opacity=".5"/></svg>`;
  const id='pg-'+p.id,c=p.hex,rgb=hex2rgb(c),lt=mix(rgb,WHITE,.6).map(Math.round),dk=rgb.map(v=>Math.round(v*.45));
  const grad=p.kind==='metal'||p.kind==='chrome';const body=grad?`url(#${id})`:c;
  const defs=p.kind==='chrome'?`<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgb(${dk})"/><stop offset=".3" stop-color="rgb(${lt})"/><stop offset=".47" stop-color="#fff"/><stop offset=".5" stop-color="rgb(${rgb.map(v=>Math.round(v*.1))})"/><stop offset=".7" stop-color="rgb(${dk})"/><stop offset=".92" stop-color="rgb(${lt})"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>`
    :p.kind==='metal'?`<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="rgb(${dk})"/><stop offset=".38" stop-color="rgb(${lt})"/><stop offset=".55" stop-color="#fff"/><stop offset=".75" stop-color="${c}"/><stop offset="1" stop-color="rgb(${dk})"/></linearGradient></defs>`:'';
  const sparkle=p.kind==='glitter'?[[11,26],[17,33],[13,41],[19,47],[12,55],[17,60],[15,29],[10,48]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${.7+((x*y)%3)*.35}" fill="#fff" opacity=".9"/>`).join(''):'';
  return `<svg viewBox="0 0 30 74">${defs}<path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${grad?`url(#${id})`:c}"/>
    <rect x="8.5" y="19" width="13" height="47" fill="${body}"/>${sparkle}<rect x="8.5" y="64" width="13" height="9" rx="1.5" fill="${grad?`url(#${id})`:'#c8ad80'}"/>${p.kind==='chrome'?'<rect x="10" y="22" width="2.2" height="40" fill="#fff" opacity=".8"/>':''}</svg>`;}
/* ---------- pencil sets: Book (free) → themed palettes (All Palettes) → premium ink sets + brushes (Premium Pencils) ---------- */
const THEMES=[
 {id:'sunset',name:'Sunset',colors:['#2b1b3d','#4a2352','#7a2e5c','#a8365e','#d0455a','#e8664f','#f28a4a','#f7a94b','#fbc766','#fde29a','#f5b7a5','#c98aa0','#8e6a9e','#5a4a7d','#ff9e7a','#ffd3b5']},
 {id:'ocean',name:'Ocean',colors:['#06202e','#0b3a52','#0f5470','#12708e','#1a8fae','#2fb0c9','#5fcbd9','#98e0e6','#cdf2f0','#0e6b6b','#1f8f86','#43b3a0','#86d1b8','#f2e7c9','#d9c49a','#ffffff']},
 {id:'forest',name:'Forest',colors:['#14231a','#1f3a26','#2b5234','#3b6b40','#50864c','#6ea35a','#93bd6e','#c0d88f','#e6ecb8','#4a3a26','#6b5234','#8c6d45','#b08a5a','#d4b07a','#7a7f5a','#a3a878','#5e6b4a','#2e4a3f']},
 {id:'pastel',name:'Pastel Dreams',colors:['#fbd3e0','#f8b6cc','#f2a0c0','#e6b3f0','#cfb8f5','#b8c6fa','#a8d8f8','#a6ecea','#b3f0cf','#d6f5b0','#f7f3a8','#ffe0a8','#ffc9a8','#f5f0ea','#dcd4e8','#c2d8e0']},
 {id:'jewel',name:'Jewel Tones',colors:['#0f1c4d','#1a2f8a','#2b4fd1','#0b5d5b','#0f8a6e','#10b07e','#4b0f5e','#7a1a8c','#a52aa3','#7a0f2b','#b0173d','#d9254f','#a86a0b','#d99a1a','#f2c14a','#20252b']},
 {id:'autumn',name:'Autumn',colors:['#3b1a0e','#5c2410','#8a3312','#b3461a','#d4622a','#e8833a','#f0a54a','#f5c46a','#e6d38a','#7a5a1a','#9c7a2a','#6b4a2a','#8a2a1a','#a83a2a','#5a6b2a','#3a4a1e']},
 {id:'neonnight',name:'Neon Night',colors:['#0a0620','#1a0f3d','#2e1266','#ff2bd6','#ff5ea8','#ff8a3d','#ffe14d','#b6ff3b','#3bffb0','#29e6ff','#3b8bff','#8a3bff','#c23bff','#ffffff','#1e1e2e','#46465e']},
 {id:'earth',name:'Earth & Clay',colors:['#2a1d16','#4a3226','#6b4a36','#8c6247','#a97a57','#c4956e','#d8b08c','#e8ccab','#f3e4cf','#9c5a3c','#b86e4a','#7a3e2a','#5a5a4a','#7a7a64','#a3a086','#c9c4a8']}];
const SETS=[{id:'book',name:'Book palette',product:null,type:'plain',colors:EXTRA}]
  .concat(THEMES.map(t=>({id:t.id,name:t.name,product:'palettes',type:'plain',colors:t.colors})))
  .concat([['metal','Metallic'],['chrome','Chrome'],['glitter','Glitter'],['neon','Neon'],['glow','Glow'],['pulse','Pulse'],['brush','Brushes']]
    .map(([k,n])=>({id:k,name:n,product:'pencils',type:'ink',items:PREMIUM.filter(p=>p.kind===k)})));
const SETI={};SETS.forEach((t,i)=>SETI[t.id]=i);
let setIdx=Math.max(0,SETI[settings.pset]??0);
/* free samples (kept outside ep.v1 so "Reset progress" doesn't refill them). Owner code bypasses everything. */
const TRY_BUDGET=3;          // per premium set: 3 strokes, or 1 fill (a fill costs 3)
const Trials={k:'ep.trials.v1',get(){try{return JSON.parse(localStorage.getItem(this.k)||'{}');}catch(e){return {};}},
  put(o){try{localStorage.setItem(this.k,JSON.stringify(o));}catch(e){}},
  left(setId){const o=this.get();return Math.max(0,TRY_BUDGET-((o.sets||{})[setId]||0));},
  spend(setId,n){const o=this.get();o.sets=o.sets||{};o.sets[setId]=(o.sets[setId]||0)+n;this.put(o);},
  palScene(){return this.get().palScene??null;}, setPalScene(n){const o=this.get();o.palScene=n;this.put(o);},
  popsLeft(){return Math.max(0,3-(this.get().pops||0));}, spendPop(){const o=this.get();o.pops=(o.pops||0)+1;this.put(o);}};
const owned=set=>!set.product||ENT[set.product].unlocked();
function setOfInk(){if(ink.kind==='plain')return null;const p=PREM[ink.id];return p?SETS[SETI[p.kind]]:null;}
function setOfTool(){return PREM[tool]?SETS[SETI.brush]:null;}
function buildPalette(){
  const set=SETS[setIdx],own=owned(set),fr=$('#freerow');if(!fr)return;fr.innerHTML='';
  const bar=$('#setbar');
  bar.querySelector('.sname').textContent=set.name;
  bar.querySelector('.scount').textContent=`${set.type==='plain'?set.colors.length:set.items.length} ${set.id==='brush'?'brushes':'pencils'}`;
  let state='';if(!own){if(set.product==='palettes'){const ps=Trials.palScene();state=(ps==null||(S&&ps===S.n))?'Preview on this page':'Locked';}
    else{const l=Trials.left(set.id);state=l?`Free try: ${l} left`:'Locked';}}
  bar.querySelector('.sstate').textContent=own?(set.product?'Owned':''):state;
  bar.classList.toggle('locked',!own);bar.querySelector('.slock').hidden=own;
  bar.querySelector('.sdots').innerHTML=SETS.map((t,i)=>`<i class="${i===setIdx?'on':''} ${owned(t)?'':'lk'}"></i>`).join('');
  let host=fr;
  if(set.product){const g=document.createElement('div');g.id='pgroup';g.className='pgroup'+(own?'':' locked');
    g.innerHTML=`<div class="plabel"><span class="plock">${LOCK}</span><span class="ptxt">${esc(set.name)}${own?' ✓':''}</span></div><div class="pitems"></div>`;fr.appendChild(g);host=g.querySelector('.pitems');}
  if(set.type==='plain')set.colors.forEach(h=>{const b=document.createElement('button');b.className='pencil'+(own?'':' dim');b.dataset.c=h;b.title=h;b.innerHTML=pencilSVG(h);
      b.onclick=()=>usePlain(set,h);host.appendChild(b);});
  else set.items.forEach(p=>{const b=document.createElement('button');b.className='pencil premium '+p.kind+(p.kind==='neon'||p.kind==='glow'?' n-'+p.id.slice(2):'')+(own?'':' dim');
      b.dataset.p=p.id;b.title=p.name;b.innerHTML=premiumIcon(p);b.onclick=()=>usePremium(set,p);host.appendChild(b);});
  if(set.id==='book'){const t=document.createElement('button');t.className='moresets';t.innerHTML='<b>✦ More sets</b><span>Palettes, metallic, chrome, glow…</span>';
    t.onclick=()=>flipSet(1);fr.appendChild(t);}
  markColor();}
function flipSet(d){setIdx=(setIdx+d+SETS.length)%SETS.length;settings.pset=SETS[setIdx].id;LS.set('settings',settings);buildPalette();$('#colors').scrollLeft=$('#numrow').offsetWidth;}
function usePlain(set,h){
  if(!owned(set)){const ps=Trials.palScene();
    if(ps!=null&&S&&ps!==S.n){openUpgrade(null,'palettes');return;}
    if(ps==null){Trials.setPalScene(S.n);toast(`Preview: themed palettes are free on this page`);buildPalette();}}
  pickColor(h);}
function usePremium(set,p){
  if(!owned(set)&&Trials.left(set.id)<=0){openUpgrade(p.id,'pencils');return;}
  if(!owned(set))toast(`Free try: ${p.name} · ${Trials.left(set.id)} ${Trials.left(set.id)===1?'stroke':'strokes'} left (a fill uses 3)`);
  pickPremium(p);}
/* called when a stroke/fill starts with a premium ink/brush: spend a free try or open the upgrade sheet. returns false to block */
function allowPremiumUse(cost){
  const set=tool==='eraser'?null:(setOfTool()||setOfInk());if(!set||owned(set))return true;
  if(Trials.left(set.id)<cost){openUpgrade(PREM[tool]?tool:ink.id,'pencils');return false;}
  Trials.spend(set.id,Math.min(cost,Trials.left(set.id)));buildPalette();
  if(Trials.left(set.id)===0)setTimeout(()=>toast(`That was your last free ${set.name} try ✦`),300);return true;}
function refreshPremiumUI(){buildPalette();
  for(const [key,sub] of [['pencils','Metallic, chrome, glitter, neon, glow, pulse + brushes'],['palettes','Sunset, Ocean, Forest and 5 more palettes'],['effects3d','3D Pop: raise any area off the page']]){
    const on=ENT[key].unlocked(),b=$(`#set_${key} b`),sm=$(`#set_${key} small`);if(b){b.textContent=on?'Lock again (demo)':'Unlock';sm.textContent=on?`Unlocked on this device (${(ENT[key].state()||{}).source||'demo'})`:sub;}}
  const pt=$('#popTries');if(pt)pt.textContent=ENT.effects3d.unlocked()?'':`Free tries: ${Trials.popsLeft()} left`;
  markColor();}
function pickPremium(p){
  if(p.kind==='brush'){setTool(p.id);} else {ink={kind:p.kind,hex:p.hex,id:p.id};color=p.hex;if(tool==='eraser')setTool('pencil');}
  setInkPattern();$$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});markColor();}
function buildColors(){
  const nr=$('#numrow');nr.innerHTML='';
  S.d.palette.forEach((h,i)=>{const k=i+1,b=document.createElement('button');b.className='sw';b.dataset.k=k;b.style.background=h;
    b.innerHTML=`<span class="n">${k}</span><span class="left"></span>`;b.onclick=()=>pickNum(k);nr.appendChild(b);});
  buildPalette();
}
function markColor(){const sl=$('#saveLoop');if(sl)sl.hidden=!(S&&S.pulseUsed&&mode==='free');
  $$('#numrow .sw').forEach(b=>b.classList.toggle('on',mode==='cbn'?+b.dataset.k===selNum:S.d.palette[b.dataset.k-1]===color));
  $$('#freerow .pencil:not(.premium)').forEach(b=>b.classList.toggle('on',mode==='free'&&ink.kind==='plain'&&b.dataset.c===color));
  $$('#freerow .premium').forEach(b=>b.classList.toggle('on',mode==='free'&&(b.dataset.p===tool||b.dataset.p===ink.id)));
}
function pickNum(k){ if(mode==='free'){pickColor(S.d.palette[k-1]);return;} selNum=k;markColor();highlight();drawNums();}
function pickColor(h){color=h;ink={kind:'plain',hex:h,id:null};if(tool==='eraser')setTool('pencil');setInkPattern();markColor();
  $$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});}
function setTool(t){tool=t;$$('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));app.classList.toggle('tool-pop',t==='pop');
  if(t==='pop'){enableTilt();refreshPremiumUI();}setInkPattern();if(S)markColor();}

async function showScene(n){
  if(!isUnlocked(n)){const i=IDS.indexOf(n),prev=IDS[i-1];toast(`Locked · finish Chapter ${prev} to unlock`);
    const b=$(`.scene[data-n="${n}"]`);if(b){b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');}return;}
  if(S&&S.n!==n)saveNow();
  S=await loadScene(n); resetZoom(); prog.current=n; saveProg();
  $$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  storyStrip();
  lineImg.src=S.d.line; layers.innerHTML=''; layers.appendChild(S.cbn.c); layers.appendChild(S.free.c); if(S.pulse)layers.appendChild(S.pulse.c);
  renderPops(); loadVectorLines(n);
  selNum=firstOpen()||1; buildColors(); setMode(mode,true);
}
function setMode(m,force){
  if(m===mode&&!force)return; mode=m; app.classList.toggle('cbn',m==='cbn'); app.classList.toggle('free',m==='free');
  $$('.mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  S.cbn.c.style.display=m==='cbn'?'':'none'; S.free.c.style.display=m==='free'?'':'none';
  if(m==='cbn'){highlight();drawNums();progress();} markColor(); scheduleNums();
  if(m==='free')setTimeout(showLLTip,400);
}

/* ---------- color by number ---------- */
function firstOpen(from=0){for(let j=0;j<S.K;j++){const k=((from+j)%S.K)+1;if(S.cbn.doneT[k]<S.totT[k])return k;}return 0}
let hlDim=null,hlGlow=null;
function highlight(){
  const {lab,num}=S,f=S.cbn.filled; if(!hlDim){hlDim=dctx.createImageData(W,H);hlGlow=gctx.createImageData(W,H);}
  const D=hlDim.data,G=hlGlow.data;
  for(let i=0,j=0;i<W*H;i++,j+=4){const r=lab[i];
    if(f[r]){D[j+3]=0;G[j+3]=0;}
    else if(num[r]===selNum){D[j+3]=0;G[j]=255;G[j+1]=196;G[j+2]=120;G[j+3]=255;}
    else{D[j]=24;D[j+1]=18;D[j+2]=14;D[j+3]=34;G[j+3]=0;}}
  dctx.putImageData(hlDim,0,0);gctx.putImageData(hlGlow,0,0);
}
function drawNums(){
  scheduleNums(); nctx.clearRect(0,0,W,H);nctx.textAlign='center';nctx.textBaseline='middle';
  const f=S.cbn.filled;
  for(let r=1;r<S.N;r++){if(!S.fs[r]||f[r])continue;const on=S.num[r]===selNum;
    nctx.font=`${on?600:400} ${S.fs[r]}px Poppins, sans-serif`;nctx.fillStyle=on?'#a8500c':'rgba(110,104,98,.95)';
    nctx.fillText(S.num[r],S.cx[r],S.cy[r]+S.fs[r]*.04);}
}
function paintRegion(r,rgb,a){ // CBN layer
  const D=S.cbn.img.data,{off,pix,bb}=S;
  for(let p=off[r];p<off[r+1];p++){const j=pix[p]*4;D[j]=rgb[0];D[j+1]=rgb[1];D[j+2]=rgb[2];D[j+3]=a;}
  const b=r*4; if(bb[b+2]>=0)S.cbn.ctx.putImageData(S.cbn.img,0,0,bb[b],bb[b+1],bb[b+2]-bb[b]+1,bb[b+3]-bb[b+1]+1);
}
function clearHL(r){const {off,pix}=S,D=hlDim.data,G=hlGlow.data;for(let p=off[r];p<off[r+1];p++){const j=pix[p]*4+3;D[j]=0;G[j]=0;}}
function fillCBN(r){
  const c=S.cbn; const k=S.num[r]; const batch=[r];
  c.filled[r]=1; paintRegion(r,S.pal[k-1],255); clearHL(r);
  if(S.tgt[r]){c.doneT[k]++;c.done++;}
  let colorDone=false;
  if(S.tgt[r]&&c.doneT[k]===S.totT[k]){colorDone=true; // auto-fill the tiny un-numbered bits of this colour
    for(let q=1;q<S.N;q++)if(S.num[q]===k&&!c.filled[q]){c.filled[q]=1;paintRegion(q,S.pal[k-1],255);clearHL(q);batch.push(q);}}
  c.hist.push(batch); if(c.hist.length>400)c.hist.shift(); dirty('cbn');
  dctx.putImageData(hlDim,0,0);gctx.putImageData(hlGlow,0,0);drawNums();progress();
  if(colorDone){const sw=$(`#numrow .sw[data-k="${k}"]`);sw.classList.remove('flash');void sw.offsetWidth;sw.classList.add('flash');
    if(c.done===S.total){c.complete=true;
      if(settings.story){const n=S.n;setTimeout(()=>completeChapter(n),650);}
      else{toast('Picture complete ✦');setTimeout(()=>{$('#celebrate').hidden=false;},500);}}
    else{toast(`Color ${k} complete ✦`);const nx=firstOpen(k);if(nx)setTimeout(()=>{if(mode==='cbn'&&selNum===k)pickNum(nx);},900);}}
}
function progress(){
  const c=S.cbn;$('#pdone').textContent=c.done;$('#ptotal').textContent=S.total;$('#progress').classList.toggle('done',c.done===S.total&&S.total>0);
  $$('#numrow .sw').forEach(b=>{const k=+b.dataset.k,left=S.totT[k]-c.doneT[k];b.querySelector('.left').textContent=left||'';b.classList.toggle('done',left===0);});
}
function tapCBN(x,y){
  const r=S.lab[(y|0)*W+(x|0)]; if(!r||S.cbn.filled[r])return;
  if(S.num[r]===selNum)fillCBN(r); else shake();
}
function shake(){stage.classList.remove('shake');void stage.offsetWidth;stage.classList.add('shake');}
let toastT=0;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),1600);}

/* ---------- free color ---------- */
function snap(){const f=S.free;f.undo.push({f:f.ctx.getImageData(0,0,W,H),p:S.pulseUsed?S.pulse.ctx.getImageData(0,0,W,H):null});if(f.undo.length>15)f.undo.shift();}
function unsnap(u){S.free.ctx.putImageData(u.f,0,0);if(S.pulse){if(u.p)S.pulse.ctx.putImageData(u.p,0,0);else S.pulse.ctx.clearRect(0,0,W,H);dirty('pulse');}}
/* glow inks: soft light halo spilling around the colour (committed with blurred shadows in 'screen') */
function haloDraw(c,src,hex){c.save();c.shadowColor=hex;c.shadowBlur=34;c.globalAlpha=.9;c.drawImage(src,0,0);c.shadowBlur=14;c.globalAlpha=1;c.drawImage(src,0,0);
  c.globalCompositeOperation='screen';c.shadowBlur=0;c.globalAlpha=.35;c.drawImage(src,0,0);c.restore();}
/* pulse inks live on their own layer, which breathes (CSS animation) in the app and is flattened into saved PNGs */
function pulseLayer(){if(!S.pulse){const c=mk();c.className='pulse-layer';S.pulse={c,ctx:c.getContext('2d',{willReadFrequently:true})};
    c.style.setProperty('--pc','#ffb35c');layers.appendChild(c);}return S.pulse;}
function fillFree(x,y){
  const r=S.lab[(y|0)*W+(x|0)]; if(!r)return; if(!allowPremiumUse(3))return; snap();
  const b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;
  showTry(r); const pulse=ink.kind==='pulse', halo=ink.kind==='glow', tc=pulse?pulseLayer().ctx:S.free.ctx;
  const im=halo?new ImageData(bw,bh):tc.getImageData(bx,by,bw,bh),D=im.data,sh=shader(bx,by,bw,bh);
  for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],x=i%W,y=(i/W)|0,j=(y-by)*bw*4+(x-bx)*4,c=sh(x,y);D[j]=c[0];D[j+1]=c[1];D[j+2]=c[2];D[j+3]=255;}
  if(halo){const t=document.createElement('canvas');t.width=W;t.height=H;t.getContext('2d').putImageData(im,bx,by);haloDraw(tc,t,ink.hex);}
  else tc.putImageData(im,bx,by);
  if(pulse){S.pulseUsed=true;dirty('pulse');} dirty('free'); helperAfterColor(r);
}
/* ---------- Line Lock: soft resistance ----------
   The stroke is clipped to the region it started in. When the pointer crosses a line the colour braces at the edge
   (stamps are pulled magnetically to the nearest inside pixel). Pushing on past the line by BREAK_PX screen px into a
   neighbouring region, or pressing a stylus harder than PRESSURE, breaks through: that region becomes the clip region. */
const LINE_LOCK={BREAK_PX:20,PRESSURE:.75,MAGNET_PX:16,SNAP_START:24};
const labAt=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:S.lab[(y|0)*W+(x|0)];
function nearestPx(x,y,rad,ok){x|=0;y|=0;if(ok(labAt(x,y),x,y))return [x,y];let best=null,bd=1e9;
  for(let d=1;d<=rad;d++){for(let i=-d;i<=d;i++){for(const [u,v] of [[x+i,y-d],[x+i,y+d],[x-d,y+i],[x+d,y+i]]){
      if(ok(labAt(u,v),u,v)){const q=(u-x)*(u-x)+(v-y)*(v-y);if(q<bd){bd=q;best=[u,v];}}}}
    if(best&&Math.sqrt(bd)<=d)return best;}return best;}
function inkMap(){ // 1 where the line art is dark ink (computed once per scene)
  if(S.ink)return S.ink; if(!lineImg.complete||!lineImg.naturalWidth)return null;
  const c=mk(),x=c.getContext('2d');x.drawImage(lineImg,0,0,W,H);const d=x.getImageData(0,0,W,H).data,m=new Uint8Array(W*H);
  for(let i=0,j=0;i<m.length;i++,j+=4)m[i]=(d[j+3]>110&&d[j]+d[j+1]+d[j+2]<360)?1:0; return (S.ink=m);}
const isInk=(x,y)=>{const m=inkMap();return !!(m&&x>=0&&y>=0&&x<W&&y<H&&m[(y|0)*W+(x|0)]);};
const scrScale=()=>zoomer.getBoundingClientRect().width/W;   // screen px per canvas px
function setMask(r){mctx.clearRect(0,0,W,H);const m=mctx.createImageData(W,H),D=m.data;for(let p=S.off[r];p<S.off[r+1];p++)D[S.pix[p]*4+3]=255;mctx.putImageData(m,0,0);}
let lastStroke=null;
let stroke=null;
function beginStroke(x,y,pr,ptype){
  if(tool!=='eraser'&&!allowPremiumUse(1))return;
  snap(); let r=labAt(x,y);
  const locked=tool!=='eraser'&&clip, onInk=locked&&(!r||isInk(x,y));
  if(onInk){const q=nearestPx(x,y,LINE_LOCK.SNAP_START,(v,u,w)=>v>0&&!isInk(u,w));if(q){r=labAt(q[0],q[1]);x=q[0]+.5;y=q[1]+.5;}}  // started on a line: snap
  stroke={last:[x,y],region:locked?r:0,er:tool==='eraser',st:strokeStyle(),neon:(ink.kind==='neon'||ink.kind==='glow')&&!strokeStyle(),pulse:ink.kind==='pulse'&&!strokeStyle()&&tool!=='eraser',dirty:null,
    pen:ptype==='pen',inPt:[x,y],exit:null,brace:null};
  lastStroke={snapped:onInk,start:r,regions:locked&&r?[r]:[],breaks:0,locked};
  strokeC.style.filter=stroke.neon?(ink.kind==='glow'?`drop-shadow(0 0 8px ${ink.hex}) drop-shadow(0 0 18px ${ink.hex})`:`drop-shadow(0 0 3px ${ink.hex}) drop-shadow(0 0 9px ${ink.hex})`):'';
  if(stroke.region)setMask(r);
  if(!stroke.er)showTry(r||labAt(x,y));
  stamp(x,y,pr); flush();
}
function stamp(x,y,pr){
  const p=(pr>0&&pr!==.5)?pr:.5;
  if(stroke.er){const R=ERASER_R[sizeIdx]/zoomSizeDiv();for(const c of S.pulse?[S.free.ctx,S.pulse.ctx]:[S.free.ctx]){c.save();c.globalCompositeOperation='destination-out';c.globalAlpha=.85;c.drawImage(tip,x-R,y-R,2*R,2*R);c.restore();}if(S.pulse)dirty('pulse');return;}
  let R=PENCIL_R[sizeIdx]*(.65+.7*p)/zoomSizeDiv();
  if(stroke.st==='air'){R*=2.4;cov.globalAlpha=.16;for(let k=0;k<16;k++){const a=Math.random()*6.283,d=R*Math.sqrt(-2*Math.log(Math.random()+1e-6))*.42,rr=1+Math.random()*1.8;
      cov.drawImage(tip,x+Math.cos(a)*d-rr,y+Math.sin(a)*d-rr,2*rr,2*rr);}}
  else if(stroke.st==='water'){R*=2.3;cov.globalAlpha=.09;cov.drawImage(tip,x-R,y-R,2*R,2*R);}
  else{const j=R*.15,rich=ink.kind==='metal'||ink.kind==='glitter'||ink.kind==='neon';
    cov.globalAlpha=rich?.75+.25*p:.45+.4*p; cov.drawImage(tip,x-R+(Math.random()-.5)*j,y-R+(Math.random()-.5)*j,2*R,2*R);}
  const d=stroke.dirty,a=[x-R-2,y-R-2,x+R+2,y+R+2];
  stroke.dirty=d?[Math.min(d[0],a[0]),Math.min(d[1],a[1]),Math.max(d[2],a[2]),Math.max(d[3],a[3])]:a;
}
function moveStroke(x,y,pr){
  const [lx,ly]=stroke.last,dx=x-lx,dy=y-ly,dist=Math.hypot(dx,dy);
  const step=Math.max(.5,(stroke.er?ERASER_R:PENCIL_R)[sizeIdx]*(stroke.st?.45:.3)/zoomSizeDiv()), n=Math.floor(dist/step);
  for(let i=1;i<=n;i++){const px=lx+dx*i/n,py=ly+dy*i/n; stroke.region?lockedStamp(px,py,pr):stamp(px,py,pr);}
  if(n)stroke.last=[x,y]; flush();
}
function lockedStamp(x,y,pr){
  const r=labAt(x,y);
  if(r===stroke.region){stroke.exit=null;stroke.brace=null;stroke.inPt=[x,y];return stamp(x,y,pr);}
  if(!stroke.exit)stroke.exit=stroke.inPt;
  const sc=scrScale(), far=Math.hypot(x-stroke.exit[0],y-stroke.exit[1])*sc;
  if(r&&(far>=LINE_LOCK.BREAK_PX||(stroke.pen&&pr>LINE_LOCK.PRESSURE)))return breakThrough(r,x,y,pr);
  // brace: pull the stamp to the nearest inside pixel (magnetic edge); never paint outside
  const q=nearestPx(x,y,Math.min(40,Math.ceil(LINE_LOCK.MAGNET_PX/sc)),v=>v===stroke.region);
  const b=q?[q[0]+.5,q[1]+.5]:stroke.inPt;
  if(stroke.brace&&Math.hypot(b[0]-stroke.brace[0],b[1]-stroke.brace[1])<.8)return;   // don't pile up ink on one spot
  stroke.brace=b; stamp(b[0],b[1],pr);
}
function breakThrough(r,x,y,pr){
  flush(); commitPaint(); cov.clearRect(0,0,W,H); sctx.clearRect(0,0,W,H);
  const e=stroke.exit||[x,y]; stroke.region=r; stroke.exit=null; stroke.brace=null; stroke.inPt=[x,y]; setMask(r);
  lastStroke.breaks++; lastStroke.regions.push(r);
  try{navigator.vibrate&&navigator.vibrate(10);}catch(_){}
  const [cx,cy]=EP.canvasToClient(e[0],e[1]),sr=stage.getBoundingClientRect(),d=document.createElement('i');
  d.className='llpulse';d.style.left=(cx-sr.left)+'px';d.style.top=(cy-sr.top)+'px';stage.appendChild(d);setTimeout(()=>d.remove(),600);
  stamp(x,y,pr);
}
function flush(){
  const d=stroke.dirty; if(!d)return; stroke.dirty=null;
  const x=Math.max(0,Math.floor(d[0])),y=Math.max(0,Math.floor(d[1])),w=Math.min(W,Math.ceil(d[2]))-x,h=Math.min(H,Math.ceil(d[3]))-y; if(w<=0||h<=0)return;
  // NB: source-in / destination-in clear everything outside the drawn shape, so confine them with a clip rect
  if(stroke.region){cov.save();cov.beginPath();cov.rect(x,y,w,h);cov.clip();cov.globalAlpha=1;cov.globalCompositeOperation='destination-in';
    cov.drawImage(maskC,x,y,w,h,x,y,w,h);cov.restore();}
  sctx.save();sctx.beginPath();sctx.rect(x,y,w,h);sctx.clip();sctx.clearRect(x,y,w,h);sctx.drawImage(covC,x,y,w,h,x,y,w,h);
  sctx.globalCompositeOperation='source-in';sctx.fillStyle=grainPat;sctx.fillRect(x,y,w,h);sctx.restore();
}
function commitPaint(){
  if(!stroke.er){const c=stroke.pulse?pulseLayer().ctx:S.free.ctx;c.save();if(stroke.pulse){S.pulseUsed=true;dirty('pulse');}
    if(stroke.neon&&ink.kind==='glow'){haloDraw(c,strokeC,ink.hex);}
    else if(stroke.neon){c.shadowColor=ink.hex;c.shadowBlur=18;c.drawImage(strokeC,0,0);c.shadowBlur=6;c.drawImage(strokeC,0,0);c.shadowBlur=0;}
    else if(stroke.st==='water'){c.globalCompositeOperation='multiply';c.globalAlpha=.9;}
    c.drawImage(strokeC,0,0);c.restore();}
}
function endStroke(){ if(!stroke)return; flush(); commitPaint();
  dirty('free'); strokeC.style.filter='';
  cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);stroke=null;}
function cancelStroke(){ if(!stroke)return; cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);strokeC.style.filter='';
  const u=S.free.undo.pop(); if(u)unsnap(u); stroke=null;}

/* ---------- deep zoom (to 8x): pinch + two-finger pan, wheel toward cursor, space/middle-drag pan, + / − / fit ----------
   Lines switch to a vector overlay (data/scene_NN_line.js, traced from the app's own line art) once zoomed in, so they stay crisp.
   Numbers are redrawn on a screen-resolution overlay; small unnumbered regions get their number once they are big enough on screen. */
const MAXZ=8, VEC_FROM=1.35, NUM_FROM=1.5;
let Z={z:1,x:0,y:0};
const vline=$('#vline'), numO=$('#numsO'), nox=numO.getContext('2d');
function stageSize(){return [stage.clientWidth||1,stage.clientHeight||1];}
function zoomSizeDiv(){return settings.sizeZoom===false?1:Z.z;}
function applyZoom(){const [sw,sh]=stageSize();Z.z=Math.min(MAXZ,Math.max(1,Z.z));
  Z.x=Math.min(0,Math.max(sw-sw*Z.z,Z.x));Z.y=Math.min(0,Math.max(sh-sh*Z.z,Z.y));
  zoomer.style.transform=`translate(${Z.x}px,${Z.y}px) scale(${Z.z})`;
  $('#zoomPct').textContent=Math.round(Z.z*100)+'%';$('#zoomOut').disabled=Z.z<=1.001;$('#zoomIn').disabled=Z.z>=MAXZ-.001;
  const k=sw/W*Z.z; vline.setAttribute('viewBox',`${(-Z.x/k).toFixed(2)} ${(-Z.y/k).toFixed(2)} ${(W/Z.z).toFixed(2)} ${(H/Z.z).toFixed(2)}`);
  const vec=Z.z>=VEC_FROM&&vline.dataset.n==(S&&S.n); app.classList.toggle('vec',vec);
  app.classList.toggle('zoomnums',Z.z>=NUM_FROM); scheduleNums(); popParallax();}
function resetZoom(){Z={z:1,x:0,y:0};applyZoom();}
function zoomAt(z1,mx,my){const [sw,sh]=stageSize();if(mx==null){mx=sw/2;my=sh/2;}const z0=Z.z;z1=Math.min(MAXZ,Math.max(1,z1));
  Z.x=mx-(mx-Z.x)*z1/z0;Z.y=my-(my-Z.y)*z1/z0;Z.z=z1;applyZoom();}
stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();
  if(e.ctrlKey||Math.abs(e.deltaY)>=Math.abs(e.deltaX))zoomAt(Z.z*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY-r.top);
  else{Z.x-=e.deltaX;applyZoom();}},{passive:false});
$('#zoomIn').onclick=()=>zoomAt(Z.z*1.6);$('#zoomOut').onclick=()=>zoomAt(Z.z/1.6);$('#zoomFit').onclick=resetZoom;
let spaceDown=false;
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){spaceDown=true;stage.classList.add('panready');e.preventDefault();}
  if(!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){if(e.key==='+'||e.key==='=')zoomAt(Z.z*1.6);else if(e.key==='-')zoomAt(Z.z/1.6);else if(e.key==='0')resetZoom();}});
document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;stage.classList.remove('panready');}});
/* vector line overlay, lazy-loaded per scene */
function loadVectorLines(n){const c=CHM[n];vline.dataset.n='';vline.innerHTML='';if(!c||!c.lines)return applyZoom();
  const done=()=>{const L=(window.EP_LINES||{})[n];if(!L||!S||S.n!==n)return;
    vline.innerHTML=`<path fill="#141414" fill-rule="evenodd" d="${L.d}"/>`;vline.dataset.n=n;applyZoom();};
  if((window.EP_LINES||{})[n])return done();
  const sc=document.createElement('script');sc.src=c.lines;sc.onload=done;sc.onerror=()=>{};document.head.appendChild(sc);}
/* screen-resolution numbers when zoomed in */
let numsQ=0;function scheduleNums(){if(!numsQ)numsQ=requestAnimationFrame(()=>{numsQ=0;drawNumsO();});}
function drawNumsO(){const [sw,sh]=stageSize(),dpr=Math.min(3,window.devicePixelRatio||1);
  if(numO.width!==Math.round(sw*dpr)||numO.height!==Math.round(sh*dpr)){numO.width=Math.round(sw*dpr);numO.height=Math.round(sh*dpr);}
  nox.setTransform(1,0,0,1,0,0);nox.clearRect(0,0,numO.width,numO.height);
  if(!S||mode!=='cbn'||Z.z<NUM_FROM)return; nox.setTransform(dpr,0,0,dpr,0,0);nox.textAlign='center';nox.textBaseline='middle';
  const k=sw/W*Z.z,f=S.cbn.filled;let shown=0,extra=0;
  for(let r=1;r<S.N;r++){if(!S.num[r]||f[r])continue;const X=Z.x+S.cx[r]*k,Y=Z.y+S.cy[r]*k;if(X<-20||Y<-20||X>sw+20||Y>sh+20)continue;
    let fsz;if(S.fs[r])fsz=Math.min(26,S.fs[r]*k);else{const est=Math.sqrt(S.cnt[r]/Math.PI)*.55*k;if(est<7)continue;fsz=Math.min(20,Math.max(9,est*1.2));extra++;}
    if(fsz<7)continue;const on=S.num[r]===selNum;nox.font=`${on?600:400} ${fsz.toFixed(1)}px Poppins, sans-serif`;
    if(!S.fs[r]){nox.fillStyle='rgba(255,253,248,.8)';nox.beginPath();nox.arc(X,Y,fsz*.62,0,6.283);nox.fill();}
    nox.fillStyle=on?'#a8500c':'rgba(110,104,98,.95)';nox.fillText(S.num[r],X,Y+fsz*.04);shown++;}
  numO.dataset.shown=shown;numO.dataset.extra=extra;}
window.addEventListener('resize',()=>applyZoom());

/* ---------- pointer input ---------- */
const ptrs=new Map(); let pinch=null, down=null;
function toCanvas(e){const r=zoomer.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];}
stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return; if(e.target.closest&&e.target.closest('.zoomui,.tryrow,.nudge'))return;
  stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.button===1||spaceDown){e.preventDefault();down={x:e.clientX,y:e.clientY,id:e.pointerId,pan:true,zx:Z.x,zy:Z.y};stage.classList.add('panning');return;}
  if(ptrs.size===2){cancelStroke();down=null;const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,z:Z.z,x:Z.x,y:Z.y};return;}
  if(ptrs.size>2)return;
  const [x,y]=toCanvas(e); down={x:e.clientX,y:e.clientY,cx:x,cy:y,t:performance.now(),id:e.pointerId,zx:Z.x,zy:Z.y};
  // a one-finger / pen stroke with a drawing tool always draws (never pans); other tools pan when dragged while zoomed
  if(mode==='free'&&(tool==='pencil'||tool==='eraser'||tool==='airbrush'||tool==='watercolor'))beginStroke(x,y,e.pressure,e.pointerType);
});
stage.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top,z=Math.min(MAXZ,Math.max(1,pinch.z*d/pinch.d));
    Z.z=z;Z.x=mx-(pinch.mx-pinch.x)*z/pinch.z;Z.y=my-(pinch.my-pinch.y)*z/pinch.z;applyZoom();return;}
  if(down&&e.pointerId===down.id&&!stroke&&(down.pan||(Z.z>1.01&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10))){
    down.pan=true;stage.classList.add('panning');Z.x=down.zx+(e.clientX-down.x);Z.y=down.zy+(e.clientY-down.y);applyZoom();return;}
  if(stroke&&down&&e.pointerId===down.id){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of (evs.length?evs:[e])){const [x,y]=toCanvas(ev);moveStroke(x,y,ev.pressure);}}
});
function up(e){
  if(!ptrs.has(e.pointerId))return; ptrs.delete(e.pointerId);
  if(pinch){if(ptrs.size===0)pinch=null;return;}
  if(!down||e.pointerId!==down.id)return;
  const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);stage.classList.remove('panning');
  if(down.pan){down=null;return;}
  if(stroke){const r=stroke.region||labAt(down.cx,down.cy);endStroke();helperAfterColor(r);}
  else if(e.type==='pointerup'&&moved<14){ if(mode==='cbn')tapCBN(down.cx,down.cy); else if(tool==='fill')fillFree(down.cx,down.cy); else if(tool==='pop')popTap(down.cx,down.cy); }
  down=null;
}
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
stage.addEventListener('contextmenu',e=>e.preventDefault());


/* ---------- 3D Pop: distance-transform height map -> bevel lighting (top-left light), inner shadow, soft drop shadow ---------- */
const POP={depth:+(settings.popDepth||60),pressed:settings.popMode==='pressed'};
function chamfer(d,w,h){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}}
function popRender(st,pop,sh,li){ // draws one pop into shadow ctx `sh` and light ctx `li` (both W×H)
  const rs0=pop.rs||[pop.r],inG=new Set(rs0),A=adjacency(st),rs=rs0.slice();
  for(const r of rs0)for(const b of A[r])if(!inG.has(b)&&st.cnt[b]<6000&&[...A[b]].every(q=>inG.has(q)||q===b)){inG.add(b);rs.push(b);}  // fill enclosed holes (stars, specks)
  let bx0=W,by0=H,bx1=-1,by1=-1;for(const r of rs){const b=r*4;if(st.bb[b+2]<0)continue;bx0=Math.min(bx0,st.bb[b]);by0=Math.min(by0,st.bb[b+1]);bx1=Math.max(bx1,st.bb[b+2]);by1=Math.max(by1,st.bb[b+3]);}
  if(bx1<0)return;const D=4+pop.depth*.22,M=Math.ceil(D*1.6)+10;
  const x0=Math.max(0,bx0-M),y0=Math.max(0,by0-M),x1=Math.min(W-1,bx1+M),y1=Math.min(H-1,by1+M),w=x1-x0+1,h=y1-y0+1;
  const m=new Uint8Array(w*h);for(const r of rs)for(let p=st.off[r];p<st.off[r+1];p++){const i=st.pix[p],x=i%W-x0,y=((i/W)|0)-y0;m[y*w+x]=1;}
  { // close the mask across thin line ink (rays, outlines between same-group regions) so lines don't read as grooves
    const R=5,cham=(src)=>{const o=new Float32Array(w*h);for(let i=0;i<w*h;i++)o[i]=src(i)?1e9:0;chamfer(o,w,h);return o;};
    const dOut=cham(i=>!m[i]),dil=new Uint8Array(w*h);for(let i=0;i<w*h;i++)dil[i]=dOut[i]<=R;
    const dIn=cham(i=>dil[i]);for(let i=0;i<w*h;i++)if(!m[i]&&dIn[i]>R)m[i]=1;}
  const d=new Float32Array(w*h),INF=1e9;for(let i=0;i<w*h;i++)d[i]=m[i]?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}
  const hg=new Float32Array(w*h);for(let i=0;i<w*h;i++){const t=Math.min(1,d[i]/D);hg[i]=t*t*(3-2*t);}
  const im=new ImageData(w,h),P=im.data,sg=pop.pressed?-1:1,bw=bx1-bx0+1,bh=by1-by0+1;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!m[i])continue;
    const gx=(hg[i+1]-hg[i-1])*.5,gy=(hg[i+w]-hg[i-w])*.5,dot=sg*(gx+gy)*.7071*D*.9;   // light from the top-left
    const j=i*4,u=((x+x0-bx0)/bw+(y+y0-by0)/bh)/2,amb=sg*(.5-u)*.16;       // soft top-left sheen across the face
    const v=dot+amb;
    if(v>0){P[j]=255;P[j+1]=250;P[j+2]=240;P[j+3]=Math.min(175,v*240);}else{P[j]=45;P[j+1]=28;P[j+2]=14;P[j+3]=Math.min(165,-v*230);}}
  const t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').putImageData(im,0,0);li.drawImage(t,x0,y0);
  if(!pop.pressed){ // soft drop shadow outside the region only
    const mk2=document.createElement('canvas');mk2.width=w;mk2.height=h;const mx=mk2.getContext('2d'),mi=mx.createImageData(w,h);
    for(let i=0;i<w*h;i++)if(m[i])mi.data[i*4+3]=255;mx.putImageData(mi,0,0);
    const s2=document.createElement('canvas');s2.width=w;s2.height=h;const sx=s2.getContext('2d');
    sx.shadowColor=`rgba(40,24,10,${.28+pop.depth*.003})`;sx.shadowBlur=D*1.1;sx.shadowOffsetX=D*.35+5000;sx.shadowOffsetY=D*.55;sx.drawImage(mk2,-5000,0);
    sx.globalCompositeOperation='destination-out';sx.drawImage(mk2,0,0);sh.drawImage(s2,x0,y0);}}
function popCanvases(st){if(!st.popSh){st.popSh=mk();st.popLi=mk();st.popSh.className='pop-sh';st.popLi.className='pop-li';}return st;}
function renderPops(st=S){if(!st)return;popCanvases(st);const sh=st.popSh.getContext('2d'),li=st.popLi.getContext('2d');sh.clearRect(0,0,W,H);li.clearRect(0,0,W,H);
  for(const p of st.pops||[])popRender(st,p,sh,li);
  if(st===S&&!st.popSh.isConnected){layers.appendChild(st.popSh);layers.appendChild(st.popLi);}popParallax();}
function savePops(st){(st.pops||[]).length?LS.set('pop.'+st.n,st.pops):LS.del('pop.'+st.n);}
/* the tapped area = the region plus touching regions painted the same colour (e.g. an envelope split by light rays) */
function popGroup(r){const c=S.rc&&S.rc[r];if(!c)return [r];const A=adjacency(),seen=new Set([r]),q=[r];let area=S.cnt[r];
  while(q.length&&seen.size<80){const a=q.shift();for(const b of A[a])if(!seen.has(b)&&S.rc[b]===c&&area+S.cnt[b]<W*H*.45){seen.add(b);area+=S.cnt[b];q.push(b);}}return [...seen];}
function popTap(x,y){const r=labAt(x,y);if(!r)return;S.pops=S.pops||[];const i=S.pops.findIndex(p=>(p.rs||[p.r]).includes(r));
  if(i>=0){S.pops.splice(i,1);renderPops();dirty('pop');toast('Pop removed');return;}
  if(!Effects3D.unlocked()){if(Trials.popsLeft()<=0){openUpgrade(null,'effects3d');return;}Trials.spendPop();refreshPremiumUI();
    const l=Trials.popsLeft();toast(l?`3D Pop · free tries: ${l} left`:'That was your last free 3D Pop ✦');}
  S.pops.push({r,rs:popGroup(r),depth:POP.depth,pressed:POP.pressed});renderPops();dirty('pop');}
function popRestyle(){ // slider / toggle apply to the most recent pop, and to new ones
  if(S&&S.pops&&S.pops.length){const p=S.pops[S.pops.length-1];p.depth=POP.depth;p.pressed=POP.pressed;renderPops();dirty('pop');}}
let tilt={x:0,y:0};
function popParallax(){if(!S||!S.popSh)return;const k=Math.min(4,1+Z.z*.3);S.popSh.style.transform=`translate(${(-tilt.x*k).toFixed(2)}px,${(-tilt.y*k).toFixed(2)}px)`;
  S.popLi.style.transform=`translate(${(tilt.x*.35).toFixed(2)}px,${(tilt.y*.35).toFixed(2)}px)`;}
stage.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!S||!S.pops||!S.pops.length)return;const r=stage.getBoundingClientRect();
  tilt={x:((e.clientX-r.left)/r.width-.5)*2.4,y:((e.clientY-r.top)/r.height-.5)*2.4};popParallax();});
let orientOn=false;
function enableTilt(){if(orientOn)return;const go=()=>{orientOn=true;window.addEventListener('deviceorientation',e=>{if(e.gamma==null)return;
    tilt={x:Math.max(-1,Math.min(1,e.gamma/30))*1.2,y:Math.max(-1,Math.min(1,(e.beta-40)/30))*1.2};popParallax();});};
  try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')DeviceOrientationEvent.requestPermission().then(s=>s==='granted'&&go()).catch(()=>{});
    else if(window.DeviceOrientationEvent)go();}catch(e){}}
function popPreview(x,Wp,Hp){ // upgrade-sheet preview: three raised shapes + one pressed
  const c=document.createElement('canvas');c.width=Wp;c.height=Hp;
  const shapes=[[.16,'#c9473d',0],[.39,'#d4af37',0],[.62,'#2f6db5',1],[.85,'#4c9a5b',0]];
  shapes.forEach(([fx,col,pr],i)=>{const cx=fx*Wp,cy=Hp/2,R=Hp*.33;x.save();x.beginPath();i%2?x.roundRect(cx-R*1.2,cy-R,R*2.4,R*2,R*.35):x.arc(cx,cy,R,0,6.283);
    if(!pr){x.shadowColor='rgba(40,24,10,.45)';x.shadowBlur=18;x.shadowOffsetX=6;x.shadowOffsetY=9;}x.fillStyle=col;x.fill();x.shadowColor='transparent';x.clip();
    const g=x.createLinearGradient(cx-R,cy-R,cx+R,cy+R);g.addColorStop(0,pr?'rgba(40,24,10,.45)':'rgba(255,250,240,.6)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,pr?'rgba(255,250,240,.45)':'rgba(40,24,10,.45)');
    x.fillStyle=g;x.fillRect(cx-R*1.3,cy-R*1.1,R*2.6,R*2.2);x.restore();});
  x.fillStyle='#4a3b2c';x.font='600 20px Poppins';x.textAlign='center';['Raised','Raised','Pressed','Raised'].forEach((t,i)=>x.fillText(t,shapes[i][0]*Wp,Hp-14));}


/* ---------- Color helper (Free Color): 'Try' suggestions, gentle overuse nudges, 'Preview idea' ghost ---------- */
const HINT_GAP_MS=120000;  // at most one nudge per 2 minutes
let lastHint=-1e9, tryT=0, nudgeT=0;
const hintsOn=()=>settings.hints!==false;
function rgb2hsl([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return [h,s,l];}
function hsl2hex(h,s,l){h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));l=Math.max(.06,Math.min(.94,l));const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),
  f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
function colorName(hex){const [h,s,l]=rgb2hsl(hex2rgb(hex));if(s<.12)return l>.8?'white':l<.2?'charcoal':'gray';
  if(l<.22)return 'deep '+(h<45||h>330?'maroon':h<170?'forest':'navy');
  const n=h<12?'red':h<28?'vermilion':h<42?'amber':h<55?'gold':h<70?'yellow':h<95?'lime':h<150?'green':h<185?'teal':h<210?'sky blue':h<245?'blue':h<280?'violet':h<320?'magenta':h<345?'rose':'red';
  return l>.78?'pale '+n:s<.3&&h<50?'tan':n;}
function sceneMood(){if(S.mood)return S.mood;const a=S.pal.reduce((o,c)=>[o[0]+c[0],o[1]+c[1],o[2]+c[2]],[0,0,0]).map(v=>v/S.pal.length);return S.mood=a;}
function suggestFor(r){const out=[],add=h=>{h=h.toLowerCase();if(!out.includes(h))out.push(h);};
  const guide=S.num[r]?S.d.palette[S.num[r]-1]:null;if(guide)add(guide);
  const base=guide||ink.hex||'#c47f4a',[h,s,l]=rgb2hsl(hex2rgb(base)),mood=rgb2hsl(sceneMood());
  const tint=hx=>{const c=hex2rgb(hx),m=sceneMood();return '#'+mix(c,m,.18).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');};
  add(tint(hsl2hex(h+28,s*.95,l)));add(tint(hsl2hex(h-28,s*.95,l+.04)));add(tint(hsl2hex(h+180,Math.max(.25,s*.6),Math.min(.6,l+.02))));
  add(hsl2hex(h,s*1.05,l-.16));add(hsl2hex(h,s*.8,l+.16));return out.slice(0,5);}
function showTry(r){if(!hintsOn()||mode!=='free'||!r||tool==='eraser'||tool==='pop')return;const sw=suggestFor(r),el=$('#tryrow');
  el.querySelector('.tsw').innerHTML=sw.map((h,i)=>`<button style="background:${h}" data-c="${h}" title="${i===0&&S.num[r]?'From the color guide':colorName(h)}">${i===0&&S.num[r]?'<i>★</i>':''}</button>`).join('');
  el.querySelectorAll('.tsw button').forEach(b=>b.onclick=e=>{e.stopPropagation();pickColor(b.dataset.c);el.hidden=true;});
  el.hidden=false;clearTimeout(tryT);tryT=setTimeout(()=>el.hidden=true,8000);}
function adjacency(st=S){if(st.adj)return st.adj;const S=st;const A=Array.from({length:S.N},()=>new Set()),L=S.lab;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,a=L[i];if(x<W-1&&L[i+1]!==a){A[a].add(L[i+1]);A[L[i+1]].add(a);}if(y<H-1&&L[i+W]!==a){A[a].add(L[i+W]);A[L[i+W]].add(a);}}
  return S.adj=A;}
function helperAfterColor(r){if(mode!=='free'||!S||!r)return;S.rc=S.rc||{};
  if(tool==='eraser'){delete S.rc[r];return;} if(tool==='pop')return; S.rc[r]=ink.hex.toLowerCase();
  if(!hintsOn()||performance.now()-lastHint<HINT_GAP_MS)return;
  const c=S.rc[r],use={};let tot=0,n=0;for(const k in S.rc){const a=S.cnt[k];use[S.rc[k]]=(use[S.rc[k]]||0)+a;tot+=a;n++;}
  let why=null;if(n>=4&&tot>20000&&use[c]/tot>.35)why='share';
  if(!why){const A=adjacency(),seen=new Set([r]),q=[r];while(q.length&&seen.size<3){const a=q.shift();for(const b of A[a])if(!seen.has(b)&&S.rc[b]===c){seen.add(b);q.push(b);}}if(seen.size>=3)why='neighbours';}
  if(why)showNudge(c,why);}
function showNudge(c,why){lastHint=performance.now();const [h,s,l]=rgb2hsl(hex2rgb(c));
  const sug=[hsl2hex(h+(h<60?-14:180),Math.max(.35,s*.9),Math.max(.22,l-.2)),hsl2hex(h+150,Math.max(.3,s*.7),Math.min(.62,l)),hsl2hex(h+210,Math.max(.3,s*.7),Math.max(.25,l-.1))];
  const nm=colorName(c),first=colorName(sug[0]);
  const sugN=first===nm?'deeper '+nm:first;$('#nudgeTxt').textContent=`Nice ${nm}! Try ${/^[aeiou]/.test(sugN)?'an':'a'} ${sugN} on the next piece for contrast`;
  $('#nudge .nsw').innerHTML=sug.map(x=>`<button style="background:${x}" data-c="${x}" title="${colorName(x)}"></button>`).join('');
  $$('#nudge .nsw button').forEach(b=>b.onclick=e=>{e.stopPropagation();pickColor(b.dataset.c);$('#nudge').hidden=true;});
  $('#nudge').dataset.why=why;$('#nudge').hidden=false;clearTimeout(nudgeT);nudgeT=setTimeout(()=>$('#nudge').hidden=true,10000);}
function previewIdea(){if(!S)return;const c=$('#ideaC');c.width=W;c.height=H;const x=c.getContext('2d'),im=x.createImageData(W,H),D=im.data;
  const fd=S.free.ctx.getImageData(0,0,W,H).data,unc=new Uint8Array(S.N);S.rc=S.rc||{};
  for(let r=1;r<S.N;r++){if(!S.num[r]||S.rc[r])continue;const i=((S.cy[r]|0)*W+(S.cx[r]|0))*4+3;if(fd[i]<40)unc[r]=1;}
  let any=0;for(let i=0;i<W*H;i++){const r=S.lab[i];if(!unc[r])continue;const c2=S.pal[S.num[r]-1],j=i*4;D[j]=c2[0];D[j+1]=c2[1];D[j+2]=c2[2];D[j+3]=102;any++;}
  x.putImageData(im,0,0);c.classList.remove('fade');c.hidden=false;void c.offsetWidth;c.classList.add('show');
  toast(any?'Idea preview (not saved)':'Everything is colored already ✦');clearTimeout(previewIdea.t);
  previewIdea.t=setTimeout(()=>{c.classList.remove('show');c.classList.add('fade');setTimeout(()=>{c.hidden=true;},600);},2800);return any;}


/* ---------- story cutscene between chapters (canvas, ~9 s, data-driven by story.js chapters[].cut) ----------
   the player's own finished picture -> slow push-in, embers + fireflies, warm light sweep, story subtitles
   -> ghosted colour guide of the next chapter -> its blank line page with the chapter title card.
   Sound (optional, muted by default) is synthesised live with WebAudio: nothing is downloaded. */
const CUT_T={a:5.0,b:6.9,c:8.5,end:9.2};
let cutRun=null, cutMuted=true;
function cutAudio(on){
  if(!on){if(cutRun&&cutRun.ac){try{cutRun.ac.close();}catch(e){}cutRun.ac=null;}return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC||!cutRun||cutRun.ac)return;const ac=new AC(),g=ac.createGain();g.gain.value=0;g.connect(ac.destination);
  g.gain.linearRampToValueAtTime(.16,ac.currentTime+1.2);const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.connect(g);
  [110,164.8,220.5].forEach((f,i)=>{const o=ac.createOscillator();o.type=i?'sine':'triangle';o.frequency.value=f;o.detune.value=(i-1)*6;const og=ac.createGain();og.gain.value=i?.22:.3;o.connect(og);og.connect(lp);o.start();});
  const n=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()<.0009?(Math.random()*2-1):0; // ember crackle
  const ns=ac.createBufferSource();ns.buffer=n;ns.loop=true;const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;const ng=ac.createGain();ng.gain.value=.5;ns.connect(hp);hp.connect(ng);ng.connect(g);ns.start();
  cutRun.ac=ac;}
function playCutscene(from,to){return new Promise(async resolve=>{
  const cf=CHM[from],ct=CHM[to],el=$('#cutscene'),cv=$('#cutC'),x=cv.getContext('2d');
  const own=S&&S.n===from?composite(.5,S.cbn.complete||mode==='cbn'?'cbn':'free'):null;
  const art=await loadImg(ct.cut.art).catch(()=>null);
  let line=null;try{if(ct.data){await needData(to);line=await loadImg(SC[to].line);}else if(ct.thumb)line=await loadImg(ct.thumb);}catch(e){}
  const dpr=Math.min(2,window.devicePixelRatio||1),fit=()=>{cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;};fit();
  $('#cutSub').textContent=cf.story;$('#cutSub').className='cut-sub';$('#cutTitle').innerHTML=`<small>Chapter ${to}</small><b>${esc(ct.title)}</b><span>${esc(ct.teaser)}</span>`;$('#cutTitle').className='cut-title';
  $('#cutMute').classList.toggle('on',!cutMuted);el.hidden=false;
  const mood=hex2rgb((cf.cut&&cf.cut.mood)||'#ffb35c'),P=[];
  for(let i=0;i<70;i++)P.push({ff:i%3===0,x:Math.random(),y:Math.random()*1.1,v:.02+Math.random()*.05,s:.6+Math.random()*1.6,ph:Math.random()*6.28,dr:(Math.random()-.5)*.03});
  const t0=performance.now();cutRun={done:false,t:0};if(!cutMuted)cutAudio(true);
  const finish=()=>{if(!cutRun||cutRun.done)return;cutRun.done=true;cutAudio(false);el.classList.add('out');setTimeout(()=>{el.hidden=true;el.classList.remove('out');cutRun=null;resolve();},350);};
  $('#cutSkip').onclick=finish;el.dataset.phase='a';
  const cover=(img,cx,cy,z,alpha,filter)=>{if(!img)return;const Wc=cv.width,Hc=cv.height,iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight;
    const sc=Math.max(Wc/iw,Hc/ih)*z,dw=iw*sc,dh=ih*sc;let dx=Wc/2-cx*dw,dy=Hc/2-cy*dh;dx=Math.min(0,Math.max(Wc-dw,dx));dy=Math.min(0,Math.max(Hc-dh,dy));
    x.save();x.globalAlpha=alpha;if(filter)x.filter=filter;x.drawImage(img,dx,dy,dw,dh);x.restore();};
  const ease=t=>t<0?0:t>1?1:t*t*(3-2*t);
  const frame=()=>{if(!cutRun||cutRun.done)return;const t=(performance.now()-t0)/1000;cutRun.t=t;const Wc=cv.width,Hc=cv.height;
    x.fillStyle='#120d0a';x.fillRect(0,0,Wc,Hc);
    const c=cf.cut||{from:[.5,.5,1.04],to:[.5,.5,1.18]},u=ease(t/CUT_T.b),cam=[0,1,2].map(i=>c.from[i]+(c.to[i]-c.from[i])*u);
    const aA=1-ease((t-CUT_T.a+.6)/1.2), aB=ease((t-CUT_T.a+.6)/1.2)*(1-ease((t-CUT_T.b+.3)/1.0)), aC=ease((t-CUT_T.b+.3)/1.0);
    if(aA>0)cover(own||art,cam[0],cam[1],cam[2],aA);
    if(aB>0)cover(art,.5,.5,1.06+.05*ease((t-CUT_T.a)/2),aB*.55,'saturate(.75) blur(1px)');
    if(aC>0){x.save();x.globalAlpha=aC;x.fillStyle='#fffdf8';x.fillRect(0,0,Wc,Hc);x.restore();cover(line,.5,.5,1.02,aC);}
    // warm light sweep
    const sw=ease((t-1.0)/2.8);if(sw>0&&sw<1){const gx=-Wc*.4+sw*Wc*1.8,g=x.createLinearGradient(gx-Wc*.25,0,gx+Wc*.25,Hc*.4);
      g.addColorStop(0,'rgba(255,190,110,0)');g.addColorStop(.5,'rgba(255,200,120,.32)');g.addColorStop(1,'rgba(255,190,110,0)');x.save();x.globalCompositeOperation='screen';x.fillStyle=g;x.fillRect(0,0,Wc,Hc);x.restore();}
    // embers + fireflies
    const pa=Math.min(1,t/.8)*(1-ease((t-CUT_T.b)/1.2));if(pa>0){x.save();x.globalCompositeOperation='lighter';
      for(const p of P){const yy=((p.y-p.v*t*(p.ff?.4:1))%1.1+1.1)%1.1,xx=p.x+(p.ff?Math.sin(t*.8+p.ph)*.03:p.dr*t+Math.sin(t*2+p.ph)*.006),fl=.55+.45*Math.sin(t*(p.ff?2.2:7)+p.ph);
        const X=xx*Wc,Y=yy*Hc,R=p.s*dpr*(p.ff?3.2:2.2),col=p.ff?'210,255,140':`${255},${150+(mood[1]>>2)},${60}`,gr=x.createRadialGradient(X,Y,0,X,Y,R*4);
        gr.addColorStop(0,`rgba(${col},${.95*fl*pa})`);gr.addColorStop(.25,`rgba(${col},${.35*fl*pa})`);gr.addColorStop(1,`rgba(${col},0)`);x.fillStyle=gr;x.fillRect(X-R*4,Y-R*4,R*8,R*8);}x.restore();}
    // vignette
    const vg=x.createRadialGradient(Wc/2,Hc/2,Math.min(Wc,Hc)*.35,Wc/2,Hc/2,Math.max(Wc,Hc)*.75);vg.addColorStop(0,'rgba(10,6,4,0)');vg.addColorStop(1,`rgba(10,6,4,${.62*(1-aC*.7)})`);x.fillStyle=vg;x.fillRect(0,0,Wc,Hc);
    const ph=t<CUT_T.a?'a':t<CUT_T.b?'b':'c';if(el.dataset.phase!==ph)el.dataset.phase=ph;
    $('#cutSub').classList.toggle('show',t>.6&&t<CUT_T.a-.2);$('#cutTitle').classList.toggle('show',t>CUT_T.b-.1&&t<CUT_T.end-.2);
    if(t>=CUT_T.end)return finish();requestAnimationFrame(frame);};
  requestAnimationFrame(frame);});}
$('#cutMute').onclick=()=>{cutMuted=!cutMuted;$('#cutMute').classList.toggle('on',!cutMuted);$('#cutMute').title=cutMuted?'Sound off':'Sound on';cutAudio(!cutMuted);};


/* ---------- showcase: a pre-rendered example (scene 4, envelope in chrome gold + 3D Pop) so the effects are visible at once ---------- */
let showcaseURL=null;
async function renderShowcase(){
  const n=IDS.includes(4)?4:IDS[0];let st;try{st=await loadScene(n);}catch(e){return null;}
  const c=mk(),x=c.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,W,H);
  const im=x.getImageData(0,0,W,H),D=im.data;
  for(let i=0;i<W*H;i++){const r=st.lab[i];if(!st.num[r])continue;const col=st.pal[st.num[r]-1],j=i*4;D[j]=col[0];D[j+1]=col[1];D[j+2]=col[2];}
  // envelope: the big guide-colour group under the seal, grown over touching regions of the same guide colour
  const seed=st.lab[300*W+700],A=adjacency(st),grp=new Set([seed]),q=[seed];
  while(q.length){const a=q.shift();for(const b of A[a])if(!grp.has(b)&&st.num[b]===st.num[seed]&&st.cx[b]>380&&st.cx[b]<1250&&st.cy[b]>60&&st.cy[b]<700&&st.cnt[b]>60){grp.add(b);q.push(b);}}
  const rgb=hex2rgb('#e8c25a');let bx0=W,by0=H,bx1=0,by1=0;for(const r of grp){const b=r*4;bx0=Math.min(bx0,st.bb[b]);by0=Math.min(by0,st.bb[b+1]);bx1=Math.max(bx1,st.bb[b+2]);by1=Math.max(by1,st.bb[b+3]);}
  const bw=bx1-bx0+1,bh=by1-by0+1;
  for(const r of grp)for(let p=st.off[r];p<st.off[r+1];p++){const i=st.pix[p],px=i%W,py=(i/W)|0,j=i*4;
    const t=((py-by0)/bh)*.95+((px-bx0)/bw)*.18,cc=metalAt(rgb,.5+.45*Math.sin(t*Math.PI*2.1-.5));D[j]=cc[0];D[j+1]=cc[1];D[j+2]=cc[2];}
  x.putImageData(im,0,0);
  const sh=mk(),li=mk();popRender(st,{rs:[...grp],depth:80,pressed:false},sh.getContext('2d'),li.getContext('2d'));x.drawImage(sh,0,0);x.drawImage(li,0,0);
  const line=await loadImg(st.d.line);x.drawImage(line,0,0,W,H);
  const t=document.createElement('canvas');t.width=480;t.height=270;t.getContext('2d').drawImage(c,0,0,480,270);
  showcaseURL=t.toDataURL('image/jpeg',.85);const th=$('#showThumb');if(th)th.src=showcaseURL;
  return c;}
async function openShowcase(){const el=$('#showcase');el.hidden=false;const cv=$('#showC');
  const c=await renderShowcase();if(c){cv.width=W;cv.height=H;cv.getContext('2d').drawImage(c,0,0);}}
$('#showClose').onclick=()=>$('#showcase').hidden=true;
$('#showcase').onclick=e=>{if(e.target.id==='showcase')$('#showcase').hidden=true;};
$('#showPop').onclick=()=>{$('#showcase').hidden=true;setMode('free');setTool('pop');toast(Effects3D.unlocked()?'Tap an area to pop it':`Tap an area to pop it · ${Trials.popsLeft()} free tries`);};
$('#showSets').onclick=()=>{$('#showcase').hidden=true;setMode('free');setIdx=SETI.chrome-1;flipSet(1);};
setTimeout(()=>renderShowcase(),1200);

/* ---------- actions ---------- */
function undo(){
  if(mode==='cbn'){const c=S.cbn,b=c.hist.pop();if(!b)return;
    for(const r of b){c.filled[r]=0;paintRegion(r,[0,0,0],0);if(S.tgt[r]){c.doneT[S.num[r]]--;c.done--;}}
    c.complete=false;highlight();drawNums();progress();dirty('cbn');}
  else{const u=S.free.undo.pop();if(u){unsnap(u);dirty('free');}}
}
let armT=0;
function clearAll(){const b=$('#clear');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('span').textContent='Tap again';clearTimeout(armT);
    armT=setTimeout(()=>{b.classList.remove('arm');b.querySelector('span').textContent='Clear';},2500);return;}
  b.classList.remove('arm');b.querySelector('span').textContent='Clear';
  if(mode==='cbn'){const c=S.cbn;c.filled.fill(0);c.doneT.fill(0);c.done=0;c.hist=[];c.complete=false;c.img.data.fill(0);c.ctx.clearRect(0,0,W,H);
    selNum=1;markColor();highlight();drawNums();progress();dirty('cbn');}
  else{snap();S.free.ctx.clearRect(0,0,W,H);S.rc={};if(S.pulse){S.pulse.ctx.clearRect(0,0,W,H);dirty('pulse');}dirty('free');}
}
/* flattened picture: paper + colour (+ pulse frame + 3D pops) + line art. phase = pulse animation phase 0..1 */
function composite(phase=.5,m=mode){
  const c=mk(),x=c.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,W,H);
  x.drawImage(m==='cbn'?S.cbn.c:S.free.c,0,0);
  if(m==='free'&&S.pulse&&S.pulseUsed){const b=.5+.5*Math.sin(phase*Math.PI*2);x.save();x.globalAlpha=.7+.3*b;x.drawImage(S.pulse.c,0,0);
    x.globalCompositeOperation='screen';x.globalAlpha=.25+.45*b;x.filter='blur(6px)';x.drawImage(S.pulse.c,0,0);x.restore();}
  if(S.pops&&S.pops.length&&S.popSh){x.drawImage(S.popSh,0,0);x.drawImage(S.popLi,0,0);}
  x.drawImage(lineImg,0,0,W,H);return c;}
async function saveLoop(){ // short looping WebM of the breathing pulse colours (where MediaRecorder is supported)
  if(!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream))return toast('Loop export isn\u2019t supported in this browser');
  const c=mk(),x=c.getContext('2d'),type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)return toast('Loop export isn\u2019t supported here');
  const rec=new MediaRecorder(c.captureStream(30),{mimeType:type,videoBitsPerSecond:4e6}),chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  toast('Recording a 3 s loop…');const t0=performance.now(),D=3000;rec.start();
  await new Promise(res=>{const f=()=>{const t=(performance.now()-t0)/D;x.drawImage(composite((t*1.5)%1),0,0);t<1?requestAnimationFrame(f):res();};f();});
  rec.stop();await new Promise(r=>rec.onstop=r);
  const name=`EmberPost_scene${String(S.n).padStart(2,'0')}_pulse_loop.webm`,u=URL.createObjectURL(new Blob(chunks,{type:'video/webm'})),a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Saved '+name);}
function save(){
  const c=composite(.5);
  const name=`EmberPost_scene${String(S.n).padStart(2,'0')}_${mode==='cbn'?'by-number':'free'}.png`;
  c.toBlob(b=>{const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Saved '+name);},'image/png');
}
$$('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$$('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$$('.size').forEach(b=>b.onclick=()=>{sizeIdx=+b.dataset.size;$$('.size').forEach(s=>s.classList.toggle('on',s===b));});
function syncClip(){const b=$('#clip');b.classList.toggle('on',clip);b.setAttribute('aria-pressed',clip);b.querySelector('.llstate').textContent=clip?'On':'Off';}
$('#clip').onclick=()=>{clip=!clip;settings.lineLock=clip;LS.set('settings',settings);syncClip();hideLLTip();toast(clip?'Line Lock on':'Line Lock off');};
syncClip();
function showLLTip(){if(settings.llTip||mode!=='free')return;const t=$('#lltip');t.hidden=false;
  settings.llTip=true;LS.set('settings',settings);clearTimeout(showLLTip.t);showLLTip.t=setTimeout(hideLLTip,5000);}
function hideLLTip(){$('#lltip').hidden=true;}
$('#lltip').onclick=hideLLTip;
$('#popDepth').value=POP.depth;$('#popMode').textContent=POP.pressed?'Pressed':'Raised';
$('#popDepth').oninput=e=>{POP.depth=+e.target.value;settings.popDepth=POP.depth;LS.set('settings',settings);clearTimeout(popRestyle.t);popRestyle.t=setTimeout(popRestyle,120);};
$('#popMode').onclick=()=>{POP.pressed=!POP.pressed;$('#popMode').textContent=POP.pressed?'Pressed':'Raised';$('#popMode').classList.toggle('on',POP.pressed);settings.popMode=POP.pressed?'pressed':'raised';LS.set('settings',settings);popRestyle();};
$('#idea').onclick=previewIdea;$('#tryrow .tx').onclick=()=>$('#tryrow').hidden=true;$('#nudge .nx').onclick=()=>$('#nudge').hidden=true;
$('#saveLoop').onclick=saveLoop;
$('#setPrev').onclick=()=>flipSet(-1);$('#setNext').onclick=()=>flipSet(1);
$('#undo').onclick=undo;$('#clear').onclick=clearAll;$('#save').onclick=save;
$('#celebrate').onclick=()=>{$('#celebrate').hidden=true;};
window.addEventListener('resize',applyZoom);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}});

/* ---------- saving each scene's coloring ---------- */
const pend={};let saveT=0;
function dirty(kind){if(!S)return;if(kind==='pulse'){const sl=$('#saveLoop');if(sl)sl.hidden=!(S.pulseUsed&&mode==='free');}pend[S.n]=pend[S.n]||{};pend[S.n][kind]=1;clearTimeout(saveT);saveT=setTimeout(saveNow,700);}
function saveNow(){clearTimeout(saveT);
  for(const k of Object.keys(pend)){const st=cache[k];if(!st){delete pend[k];continue;}const p=pend[k];
    if(p.cbn){const ids=[];for(let r=1;r<st.N;r++)if(st.cbn.filled[r])ids.push(r);ids.length?LS.set('cbn.'+k,ids.join(',')):LS.del('cbn.'+k);}
    if(p.free&&st.rc)LS.set('rc.'+k,st.rc);
    if(p.free){let any=false;const d=st.free.ctx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
      if(any){let url=st.free.c.toDataURL('image/webp',.9);if(!url.startsWith('data:image/webp'))url=st.free.c.toDataURL('image/png');
      if(!LS.set('free.'+k,url))toast('Storage is full: free coloring not saved');}else LS.del('free.'+k);}
    if(p.pulse&&st.pulse){let any=false;const d=st.pulse.ctx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
      if(any){let url=st.pulse.c.toDataURL('image/webp',.9);if(!url.startsWith('data:image/webp'))url=st.pulse.c.toDataURL('image/png');LS.set('pulse.'+k,url);}else LS.del('pulse.'+k);}
    if(p.pop)savePops(st);
    const t=document.createElement('canvas');t.width=320;t.height=180;const x=t.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,320,180);
    const cur=S&&S.n==k, src=cur?(mode==='free'?st.free.c:st.cbn.c):(p.free&&!p.cbn?st.free.c:st.cbn.c);
    x.drawImage(src,0,0,320,180); if(cur&&lineImg.complete&&lineImg.naturalWidth)x.drawImage(lineImg,0,0,320,180);
    LS.set('thumb.'+k,t.toDataURL('image/jpeg',.72));delete pend[k];}
  refreshThumbs();}
function refreshThumbs(){$$('.scene').forEach(b=>{const n=+b.dataset.n,i=b.querySelector('img');if(i&&isUnlocked(n))i.src=thumbOf(n);});}
async function restoreScene(st){
  const ids=(LS.get('cbn.'+st.n,'')||'').split(',').map(Number).filter(r=>r>0&&r<st.N);
  if(ids.length){const D=st.cbn.img.data;
    for(const r of ids){if(st.cbn.filled[r])continue;st.cbn.filled[r]=1;const rgb=st.pal[st.num[r]-1];
      for(let p=st.off[r];p<st.off[r+1];p++){const j=st.pix[p]*4;D[j]=rgb[0];D[j+1]=rgb[1];D[j+2]=rgb[2];D[j+3]=255;}
      if(st.tgt[r]){st.cbn.doneT[st.num[r]]++;st.cbn.done++;}}
    st.cbn.ctx.putImageData(st.cbn.img,0,0);st.cbn.complete=st.cbn.done===st.total;}
  const f=LS.get('free.'+st.n,null);
  if(f){try{const im=await loadImg(f);st.free.ctx.drawImage(im,0,0);}catch(e){}}
  const pu=LS.get('pulse.'+st.n,null);
  if(pu){try{const im=await loadImg(pu);const c=mk();c.className='pulse-layer';st.pulse={c,ctx:c.getContext('2d',{willReadFrequently:true})};st.pulse.ctx.drawImage(im,0,0);st.pulseUsed=true;}catch(e){}}
  st.pops=LS.get('pop.'+st.n,[]);st.rc=LS.get('rc.'+st.n,{});
}
window.addEventListener('pagehide',saveNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});

/* ---------- story mode: complete -> reveal -> unlock ---------- */
function completeChapter(n){
  const next=nextOf(n), fresh=!!next&&!prog.unlocked.includes(next.n);
  if(!prog.done.includes(n))prog.done.push(n);
  if(next&&!prog.unlocked.includes(next.n))prog.unlocked.push(next.n);
  saveProg();saveNow();buildScenes();if(S&&S.n===n)storyStrip();
  showReveal(n,next,fresh);
}
function showReveal(n,next,fresh){
  const c=CHM[n];$('#rvKicker').textContent=`Chapter ${n} · colored`;$('#rvTitle').textContent=c.title;$('#rvStory').textContent=c.story;
  $('#rvUnlock').hidden=!next;$('#rvUnlock').classList.toggle('fresh',fresh);
  if(next){$('#rvNextImg').src=thumbOf(next.n);$('#rvNextTitle').textContent=`Chapter ${next.n} · ${next.title}`;$('#rvNextTeaser').textContent=next.teaser;
    $('#rvUnlock .rv-badge').lastChild.textContent=fresh?' Chapter unlocked':' Next chapter';}
  const more=CH.length>PLAY.length;
  $('#rvEnd').hidden=!!next;$('#rvEnd').textContent=more?`That is the last chapter in this preview. The full book continues through all ${CH.length} chapters.`:'The end of the journey. Every chapter is unlocked.';
  $('#rvNext').hidden=!next;
  const r=$('#reveal');r.hidden=false;r.classList.remove('play');void r.offsetWidth;r.classList.add('play');
  stage.classList.remove('revealing');void stage.offsetWidth;stage.classList.add('revealing');
  r.dataset.next=next?next.n:'';
}
function closeReveal(){$('#reveal').hidden=true;stage.classList.remove('revealing');}
$('#rvNext').onclick=async()=>{const n=+$('#reveal').dataset.next,from=S&&S.n;closeReveal();if(!n)return;
  if(settings.cutscenes!==false&&from&&CHM[n]&&CHM[n].cut)await playCutscene(from,n);showScene(n);};
$('#rvStay').onclick=closeReveal;
$('#rvMap').onclick=()=>{closeReveal();openMap();};
$('#done').onclick=()=>{if(!S)return;
  const d=S.free.ctx.getImageData(0,0,W,H).data;let any=false;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
  if(!any){toast('Color a little first, then tap Done');return;}
  completeChapter(S.n);};

/* ---------- journey map ---------- */
function openMap(){
  const un=IDS.filter(isUnlocked).length;
  $('#mapProg').textContent=`${un} of ${IDS.length} chapters unlocked`;
  $('#mapSub').textContent=(CH.length>PLAY.length?`Preview: ${PLAY.length} of the book's ${CH.length} chapters are playable here · `:'')+`${prog.done.filter(n=>IDS.includes(n)).length} colored`;
  $('#mapBar').style.width=(100*un/Math.max(1,IDS.length))+'%';
  const g=$('#mapGrid');g.innerHTML='';
  CH.forEach(c=>{const play=IDS.includes(c.n),lk=play&&!isUnlocked(c.n),dn=play&&isDone(c.n)&&settings.story,cur=S&&S.n===c.n;
    const e=document.createElement('div');e.setAttribute('role','button');e.tabIndex=0;e.className='ch'+(play?'':' ghost')+(lk?' locked':'')+(dn?' done':'')+(cur?' cur':'');e.dataset.n=c.n;
    const th=play?`<img src="${thumbOf(c.n)}" alt="">`:`<span class="num">${c.n}</span>`;
    const state=!play?'In the full book':lk?'Locked':dn?'Story revealed':cur?'Coloring now':'Unlocked';
    e.innerHTML=`<div class="th">${th}${(lk||!play)?LOCK:''}${dn?'<i class="ok">✓</i>':''}</div><div class="tx"><small>Chapter ${c.n} · ${state}</small><b>${esc(c.title)}</b>${lk?`<span>${esc(c.teaser)}</span>`:''}</div>`;
    e.onclick=()=>{if(!play)return toast('This chapter is in the full book');if(lk)return showScene(c.n);closeMap();showScene(c.n);};
    g.appendChild(e);});
  $('#map').hidden=false; const cur=$('#mapGrid .ch.cur');if(cur)cur.scrollIntoView({block:'center'});
}
function closeMap(){$('#map').hidden=true;}
$('#mapBtn').onclick=openMap;$('#mapClose').onclick=closeMap;

/* ---------- settings ---------- */
function applySettingsUI(){$('#setStory').classList.toggle('on',!!settings.story);
  $('#setCut').classList.toggle('on',settings.cutscenes!==false);$('#setHints').classList.toggle('on',settings.hints!==false);$('#setZoomSize').classList.toggle('on',settings.sizeZoom!==false);app.classList.toggle('storyon',!!settings.story);}
$('#setBtn').onclick=()=>{$('#settings').hidden=false;};
$('#setClose').onclick=()=>{$('#settings').hidden=true;};
$('#settings').onclick=e=>{if(e.target.id==='settings')$('#settings').hidden=true;};
$('#setStory').onclick=()=>{settings.story=!settings.story;LS.set('settings',settings);applySettingsUI();buildScenes();if(S)storyStrip();};
for(const [id,k] of [['#setCut','cutscenes'],['#setHints','hints'],['#setZoomSize','sizeZoom']])
  $(id).onclick=()=>{settings[k]=settings[k]===false;LS.set('settings',settings);applySettingsUI();if(k==='hints'&&!hintsOn()){$('#tryrow').hidden=true;$('#nudge').hidden=true;}};
let rArm=0;
$('#setReset').onclick=()=>{const b=$('#setReset');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('b').textContent='Tap again to reset';clearTimeout(rArm);
    rArm=setTimeout(()=>{b.classList.remove('arm');b.querySelector('b').textContent='Reset';},3000);return;}
  clearTimeout(saveT);for(const k in pend)delete pend[k];LS.wipe();window.__resetting=true;location.reload();};
window.addEventListener('pagehide',()=>{if(window.__resetting)LS.wipe();});

/* ---------- upgrade sheet ---------- */
const UPG={
  pencils:{kicker:'✦ Premium Pencils',title:'Unlock Premium Pencils',
    sub:'Metallic sheen, mirror chrome, sparkling glitter, glowing neon and lantern glow, breathing pulse colors, plus a soft airbrush and a watercolor wash. They work with the pencil, the fill tool and saved pictures.',
    list:[['5 metallics','gold, silver, copper, rose gold, bronze'],['5 chromes','mirror bands and sharp highlights'],['6 glitters','with real sparkle'],['5 neons + 5 glows','outer glow and soft light halos'],['5 pulse colors','gently breathe in the app'],['2 brushes','soft airbrush and watercolor wash']]},
  palettes:{kicker:'✦ Palettes',title:'Unlock All Palettes',sub:'Eight themed pencil palettes to flip through with the arrows above your pencils.',
    list:THEMES.map(t=>[t.name,t.colors.length+' pencils'])},
  effects3d:{kicker:'✦ 3D Pop',title:'Unlock 3D Pop',sub:'Tap any area to raise it off the page (or press it in), with soft light, inner shadow and a drop shadow. Works on top of your colors and in saved pictures.',
    list:[['Raised or pressed','one tap per area'],['Depth slider','subtle to bold'],['Parallax tilt','moves with your mouse or device'],['Saved pictures','the depth is baked into PNGs']]}};
function drawPreview(key){
  const cv=$('#upPreview'),x=cv.getContext('2d'),Wp=cv.width,Hp=cv.height;x.clearRect(0,0,Wp,Hp);
  const g=x.createLinearGradient(0,0,0,Hp);g.addColorStop(0,'#fffdf8');g.addColorStop(1,'#f3ece0');x.fillStyle=g;x.fillRect(0,0,Wp,Hp);
  if(key==='palettes'){const cw=Wp/THEMES.length;THEMES.forEach((t,i)=>{const n=t.colors.length,w=(cw-24)/n;
      t.colors.forEach((c,j)=>{x.fillStyle=c;x.fillRect(i*cw+12+j*w,34,w+.5,Hp-92);});x.fillStyle='#4a3b2c';x.font='600 22px Poppins';x.textAlign='center';x.fillText(t.name,i*cw+cw/2,Hp-26);});return;}
  if(key==='effects3d'){popPreview(x,Wp,Hp);return;}
  const samples=[['m-gold'],['c-silver'],['c-blue'],['g-sapphire'],['n-pink'],['w-amber'],['p-magenta'],['airbrush','#3a6ad6'],['watercolor','#c9473d']];
  const cw=Wp/samples.length;
  samples.forEach(([id,bh],i)=>{const p=PREM[id],k=p.kind==='brush'?'plain':p.kind,hex=bh||p.hex,st=id==='airbrush'?'air':id==='watercolor'?'water':null;
    const c=document.createElement('canvas');c.width=Wp;c.height=Hp;const cx=c.getContext('2d');
    const R=st?20:13, x0=i*cw+cw*.18, x1=(i+1)*cw-cw*.18;
    for(let t=0;t<=1;t+=.01){const px=x0+(x1-x0)*t,py=Hp*.5+Math.sin(t*9+i)*Hp*.28*(1-.3*Math.abs(t-.5));
      if(st==='air'){cx.globalAlpha=.16;for(let k2=0;k2<10;k2++){const a=Math.random()*6.283,d=R*Math.random(),rr=1+Math.random()*2;cx.drawImage(tip,px+Math.cos(a)*d-rr,py+Math.sin(a)*d-rr,2*rr,2*rr);}}
      else{cx.globalAlpha=st?.09:.8;cx.drawImage(tip,px-R,py-R,2*R,2*R);}}
    cx.globalAlpha=1;cx.globalCompositeOperation='source-in';cx.fillStyle=cx.createPattern(inkTile(st?'plain':k,hex,st),'repeat');cx.fillRect(0,0,Wp,Hp);
    x.save();if(p.kind==='neon'||p.kind==='glow'||p.kind==='pulse'){x.shadowColor=hex;x.shadowBlur=p.kind==='glow'?30:18;x.drawImage(c,0,0);x.shadowBlur=0;}if(st==='water')x.globalCompositeOperation='multiply';x.drawImage(c,0,0);x.restore();});
}
function openUpgrade(from,key='pencils'){const P=ENT[key].P,U=UPG[key];
  $('#upKicker').textContent=U.kicker;$('#upTitle').textContent=U.title;$('#upSub').textContent=U.sub;
  $('#upList').innerHTML=U.list.map(([b,t])=>`<li><b>${esc(b)}</b> ${esc(t)}</li>`).join('');
  $('#upPrice').textContent=P.price;$('#upMsg').textContent='';$('#upMsg').className='up-msg';$('#upCode').value='';
  const demo=PCFG.mode==='demo';$('#upBuy').querySelector('.demo-tag').hidden=!demo;
  $('#upNote').textContent=demo?'Demo build: no payment is taken. The unlock is saved on this device only.':'Secure checkout opens in a new page.';
  $('#upgrade').dataset.from=from||'';$('#upgrade').dataset.product=key;$('#upgrade').hidden=false;drawPreview(key);}
function upMsg(r){const m=$('#upMsg');m.textContent=r.msg;m.className='up-msg '+(r.ok?'ok':'bad');}
$('#upClose').onclick=()=>{$('#upgrade').hidden=true;};
$('#upgrade').onclick=e=>{if(e.target.id==='upgrade')$('#upgrade').hidden=true;};
const upKey=()=>$('#upgrade').dataset.product||'pencils';
$('#upBuy').onclick=async()=>{const r=await ENT[upKey()].buy();upMsg(r);if(r.ok){celebrateUnlock(upKey());}};
$('#upRedeem').onclick=async()=>{const r=await redeemCode($('#upCode').value,upKey());upMsg(r);if(r.ok)celebrateUnlock(r.key);};
$('#upCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#upRedeem').click();});
function celebrateUnlock(key){const c=$('.up-card');c.classList.remove('glow');void c.offsetWidth;c.classList.add('glow');
  const from=PREM[$('#upgrade').dataset.from];setTimeout(()=>{$('#upgrade').hidden=true;
    if(from&&(key==='pencils'||key==='all')){if(mode!=='free')setMode('free');pickPremium(from);}
    toast((key==='all'?'Everything':ENT[key].P.productName)+' unlocked ✦');},1500);}
for(const key of ['pencils','palettes','effects3d'])$(`#set_${key}`).onclick=()=>{const e=ENT[key];
  if(e.unlocked()){e.revoke();toast(e.P.productName+' locked again (demo)');}else{$('#settings').hidden=true;openUpgrade(null,key);}};

/* ---------- test / debug hooks (read-only helpers) ---------- */
window.EP={
  isInk:(x,y)=>isInk(x,y),
  lineLock:()=>({on:clip,saved:settings.lineLock,...LINE_LOCK,tipShown:!!settings.llTip}),
  lastStroke:()=>lastStroke,
  state:()=>({scene:S&&S.n,mode,tool,selNum,done:S&&S.cbn.done,total:S&&S.total,complete:S&&S.cbn.complete}),
  targetsAll:(k)=>{const o=[];for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r])o.push([S.cx[r],S.cy[r],r]);return o;},
  lsBytes:()=>Object.keys(localStorage).filter(k=>k.startsWith('ep.v1.')).reduce((a,k)=>a+k.length+localStorage.getItem(k).length,0),
  targets:(k)=>{const o=[];for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r]&&S.fs[r])o.push([S.cx[r],S.cy[r],r]);return o;},
  wrongTarget:(k)=>{for(let r=1;r<S.N;r++)if(S.num[r]&&S.num[r]!==k&&S.fs[r]&&!S.cbn.filled[r])return [S.cx[r],S.cy[r],r];return null;},
  largest:(i=0)=>{const o=[];for(let r=1;r<S.N;r++)if(S.fs[r])o.push([S.cnt[r],r]);o.sort((a,b)=>b[0]-a[0]);const r=o[i][1];return [S.cx[r],S.cy[r],r];},
  regionAt:(x,y)=>S.lab[(y|0)*W+(x|0)],
  _S:()=>S,
  premiumCount:()=>PREMIUM.length,
  sets:()=>SETS.map(t=>({id:t.id,name:t.name,product:t.product,owned:owned(t),n:t.type==='plain'?t.colors.length:t.items.length})),
  setIndex:()=>setIdx, trials:()=>Trials.get(), zoom:()=>({...Z}), zoomTo:(z,cx,cy)=>{const [sw,sh]=stageSize();const k=sw/W;Z.z=z;Z.x=sw/2-cx*k*z;Z.y=sh/2-cy*k*z;applyZoom();},
  ents:()=>Object.fromEntries(Object.entries(ENT).map(([k,e])=>[k,e.unlocked()])),
  cutscene:(a,b)=>playCutscene(a,b), cutState:()=>cutRun&&{t:cutRun.t,phase:$('#cutscene').dataset.phase},
  pops:()=>S.pops,
  canvasToClient:(x,y)=>{const r=zoomer.getBoundingClientRect();return [r.left+x*r.width/W,r.top+y*r.height/H];},
  leakCheck:()=>{ // every filled CBN pixel must belong to a filled region
    const D=S.cbn.img.data;let bad=0;for(let i=0;i<W*H;i++)if(D[i*4+3]&&!S.cbn.filled[S.lab[i]])bad++;return bad;},
  premium:()=>({unlocked:Premium.unlocked(),state:Premium.state(),mode:PCFG.mode,ink:Object.assign({},ink),tool}),
  progress:()=>JSON.parse(JSON.stringify(prog)), settings:()=>Object.assign({},settings),
  saved:(n)=>({cbn:(LS.get('cbn.'+n,'')||'').split(',').filter(Boolean).length,free:!!LS.get('free.'+n,null)}),
  paintedFree:()=>{const d=S.free.ctx.getImageData(0,0,W,H).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;},
  fillAllOf:(k)=>{for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r])fillCBN(r);},
};

/* ---------- boot ---------- */
setInkPattern(); buildScenes(); applySettingsUI(); handleReturn();
{const start=(prog.current&&isUnlocked(prog.current)&&IDS.includes(prog.current))?prog.current:IDS[0];
 if(start)showScene(start); else $('#scap').textContent='No scene data found.';}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW not registered',err)));}
})();
