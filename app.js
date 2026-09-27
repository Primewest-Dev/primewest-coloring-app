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
let mode='cbn', tool='pencil', sizeIdx=1, clip=true, color=EXTRA[10], S=null, selNum=1;
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
  {id:'airbrush',kind:'brush',name:'Soft airbrush'},{id:'watercolor',kind:'brush',name:'Watercolor wash'}];
const PREM={};PREMIUM.forEach(p=>PREM[p.id]=p);
let ink={kind:'plain',hex:color,id:null};
const grainA=(()=>{const d=grain.getContext('2d').getImageData(0,0,256,256).data,a=new Uint8Array(65536);for(let i=0;i<65536;i++)a[i]=d[i*4+3];return a;})();
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const WHITE=[255,255,255];
function metalRamp(rgb){return {dark:rgb.map(v=>v*.38),mid:rgb,light:mix(rgb,WHITE,.55)};}
function metalAt(rgb,v){const m=metalRamp(rgb);let c=v<.5?mix(m.dark,m.mid,v*2):mix(m.mid,m.light,(v-.5)*2);const sp=Math.max(0,v-.84)/.16;return mix(c,WHITE,sp*.85);}
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
  if(ink.kind==='glitter')return (x,y)=>{const h=hash2(x,y),g=grainA[(y&255)*256+(x&255)]/255;
    return h<.06?mix(rgb,WHITE,.75+.25*hash2(y,x)):h<.1?rgb.map(c=>c*.5):rgb.map(c=>c*(.8+.18*g));};
  if(ink.kind==='neon'){const cx=bx+bw/2,cy=by+bh/2,R=Math.max(bw,bh)/2||1;const core=mix(rgb,WHITE,.45);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,Math.pow(d,.8));};}
  return ()=>rgb;}
/* entitlement: demo unlock, codes, and a hook for Stripe / license servers (see premium-config.js) */
const PCFG=Object.assign({productId:'premium',productName:'Premium Pencils',price:'$2.99',mode:'demo',stripePaymentLink:'',verifyUrl:'',
  licenseCheckUrl:'',demoCodes:[],storageKey:'ep.premium.v1'},window.EP_PREMIUM_CONFIG||{});
const Premium={
  state(){try{return JSON.parse(localStorage.getItem(PCFG.storageKey)||'null');}catch(e){return null;}},
  unlocked(){const s=this.state();return !!(s&&s.unlocked);},
  grant(source){try{localStorage.setItem(PCFG.storageKey,JSON.stringify({unlocked:true,source,product:PCFG.productId,at:new Date().toISOString()}));}catch(e){}refreshPremiumUI();},
  revoke(){try{localStorage.removeItem(PCFG.storageKey);}catch(e){}if(ink.id){ink={kind:'plain',hex:EXTRA[10],id:null};color=ink.hex;}if(PREM[tool])setTool('pencil');setInkPattern();refreshPremiumUI();},
  async buy(){
    if(PCFG.mode==='stripe-link'&&PCFG.stripePaymentLink){location.href=PCFG.stripePaymentLink;return {ok:false,msg:'Opening secure checkout…'};}
    if(PCFG.mode==='demo'){this.grant('demo-buy');return {ok:true,msg:'Demo unlock (no payment taken)'};}
    return {ok:false,msg:'Purchases are not available in this build.'};},
  async check(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();return !!j.valid;},
  async redeem(raw){const code=String(raw||'').trim().toUpperCase();if(!code)return {ok:false,msg:'Type your code first.'};
    if(PCFG.licenseCheckUrl){try{if(await this.check(PCFG.licenseCheckUrl,{code,product:PCFG.productId})){this.grant('code');return {ok:true,msg:'Code accepted. Premium Pencils unlocked.'};}
        return {ok:false,msg:'That code isn\u2019t valid.'};}catch(e){return {ok:false,msg:'Couldn\u2019t check the code. Are you online?'};}}
    if(PCFG.mode==='demo'&&PCFG.demoCodes.map(c=>String(c).toUpperCase()).includes(code)){this.grant('demo-code');return {ok:true,msg:'Demo code accepted: Premium Pencils unlocked (no payment taken).'};}
    return {ok:false,msg:'That code isn\u2019t valid.'};},
  async handleReturn(){ // Stripe Payment Link success URL -> ?premium=return&session_id=... ; verified by YOUR server only
    const q=new URLSearchParams(location.search);if(PCFG.mode!=='stripe-link'||q.get('premium')!=='return'||!PCFG.verifyUrl)return;
    try{if(await this.check(PCFG.verifyUrl,{session_id:q.get('session_id'),product:PCFG.productId})){this.grant('stripe');toast('Premium Pencils unlocked. Thank you!');}}catch(e){}
    history.replaceState(null,'',location.pathname);}
};

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
  const body=p.kind==='metal'?`url(#${id})`:c;
  const defs=p.kind==='metal'?`<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="rgb(${dk})"/><stop offset=".38" stop-color="rgb(${lt})"/><stop offset=".55" stop-color="#fff"/><stop offset=".75" stop-color="${c}"/><stop offset="1" stop-color="rgb(${dk})"/></linearGradient></defs>`:'';
  const sparkle=p.kind==='glitter'?[[11,26],[17,33],[13,41],[19,47],[12,55],[17,60],[15,29],[10,48]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${.7+((x*y)%3)*.35}" fill="#fff" opacity=".9"/>`).join(''):'';
  return `<svg viewBox="0 0 30 74">${defs}<path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${p.kind==='metal'?`url(#${id})`:c}"/>
    <rect x="8.5" y="19" width="13" height="47" fill="${body}"/>${sparkle}<rect x="8.5" y="64" width="13" height="9" rx="1.5" fill="${p.kind==='metal'?`url(#${id})`:'#c8ad80'}"/></svg>`;}
function buildPremiumGroup(){
  let g=$('#pgroup');if(!g){g=document.createElement('div');g.id='pgroup';g.className='pgroup';$('#freerow').appendChild(g);}
  g.innerHTML=`<div class="plabel"><span class="plock">${LOCK}</span><span class="ptxt">Premium</span></div><div class="pitems"></div>`;
  const it=g.querySelector('.pitems');
  PREMIUM.forEach((p,i)=>{if(i&&PREMIUM[i-1].kind!==p.kind){const s=document.createElement('i');s.className='psep';it.appendChild(s);}
    const b=document.createElement('button');b.className='pencil premium '+p.kind;b.dataset.p=p.id;b.title=p.name;b.innerHTML=premiumIcon(p);
    b.onclick=()=>Premium.unlocked()?pickPremium(p):openUpgrade(p.id);it.appendChild(b);});
  refreshPremiumUI();}
function refreshPremiumUI(){const on=Premium.unlocked(),g=$('#pgroup');if(g){g.classList.toggle('locked',!on);g.querySelector('.ptxt').textContent=on?'Premium ✓':'Premium';}
  const b=$('#setPremiumBtn');if(b){b.textContent=on?'Lock again (demo)':'Unlock';$('#setPremiumSub').textContent=on?`Unlocked on this device (${(Premium.state()||{}).source||'demo'})`:'Metallics, glitter, neon, airbrush and watercolor';}
  markColor();}
function pickPremium(p){
  if(p.kind==='brush'){setTool(p.id);} else {ink={kind:p.kind,hex:p.hex,id:p.id};color=p.hex;if(tool==='eraser')setTool('pencil');}
  setInkPattern();$$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});markColor();}
function buildColors(){
  const nr=$('#numrow');nr.innerHTML='';
  S.d.palette.forEach((h,i)=>{const k=i+1,b=document.createElement('button');b.className='sw';b.dataset.k=k;b.style.background=h;
    b.innerHTML=`<span class="n">${k}</span><span class="left"></span>`;b.onclick=()=>pickNum(k);nr.appendChild(b);});
  const fr=$('#freerow');if(!fr.childElementCount){fr.innerHTML='<div class="sep"></div>';
    EXTRA.forEach(h=>{const b=document.createElement('button');b.className='pencil';b.dataset.c=h;b.title=h;b.innerHTML=pencilSVG(h);b.onclick=()=>pickColor(h);fr.appendChild(b);});
    const sp=document.createElement('div');sp.className='sep';fr.appendChild(sp);buildPremiumGroup();}
  markColor();
}
function markColor(){
  $$('#numrow .sw').forEach(b=>b.classList.toggle('on',mode==='cbn'?+b.dataset.k===selNum:S.d.palette[b.dataset.k-1]===color));
  $$('#freerow .pencil:not(.premium)').forEach(b=>b.classList.toggle('on',mode==='free'&&ink.kind==='plain'&&b.dataset.c===color));
  $$('#freerow .premium').forEach(b=>b.classList.toggle('on',mode==='free'&&(b.dataset.p===tool||b.dataset.p===ink.id)));
}
function pickNum(k){ if(mode==='free'){pickColor(S.d.palette[k-1]);return;} selNum=k;markColor();highlight();drawNums();}
function pickColor(h){color=h;ink={kind:'plain',hex:h,id:null};if(tool==='eraser')setTool('pencil');setInkPattern();markColor();
  $$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});}
function setTool(t){tool=t;$$('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));setInkPattern();if(S)markColor();}

async function showScene(n){
  if(!isUnlocked(n)){const i=IDS.indexOf(n),prev=IDS[i-1];toast(`Locked · finish Chapter ${prev} to unlock`);
    const b=$(`.scene[data-n="${n}"]`);if(b){b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');}return;}
  if(S&&S.n!==n)saveNow();
  S=await loadScene(n); resetZoom(); prog.current=n; saveProg();
  $$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  storyStrip();
  lineImg.src=S.d.line; layers.innerHTML=''; layers.appendChild(S.cbn.c); layers.appendChild(S.free.c);
  selNum=firstOpen()||1; buildColors(); setMode(mode,true);
}
function setMode(m,force){
  if(m===mode&&!force)return; mode=m; app.classList.toggle('cbn',m==='cbn'); app.classList.toggle('free',m==='free');
  $$('.mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  S.cbn.c.style.display=m==='cbn'?'':'none'; S.free.c.style.display=m==='free'?'':'none';
  if(m==='cbn'){highlight();drawNums();progress();} markColor();
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
  nctx.clearRect(0,0,W,H);nctx.textAlign='center';nctx.textBaseline='middle';
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
function snap(){const f=S.free;f.undo.push(f.ctx.getImageData(0,0,W,H));if(f.undo.length>15)f.undo.shift();}
function fillFree(x,y){
  const r=S.lab[(y|0)*W+(x|0)]; if(!r)return; snap();
  const b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;
  const im=S.free.ctx.getImageData(bx,by,bw,bh),D=im.data,sh=shader(bx,by,bw,bh);
  for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],x=i%W,y=(i/W)|0,j=(y-by)*bw*4+(x-bx)*4,c=sh(x,y);D[j]=c[0];D[j+1]=c[1];D[j+2]=c[2];D[j+3]=255;}
  S.free.ctx.putImageData(im,bx,by); dirty('free');
}
let stroke=null;
function beginStroke(x,y,pr){
  snap(); const r=S.lab[(y|0)*W+(x|0)];
  stroke={last:[x,y],region:(tool!=='eraser'&&clip)?r:0,er:tool==='eraser',st:strokeStyle(),neon:ink.kind==='neon'&&!strokeStyle(),dirty:null};
  strokeC.style.filter=stroke.neon?`drop-shadow(0 0 3px ${ink.hex}) drop-shadow(0 0 9px ${ink.hex})`:'';
  if(stroke.region){mctx.clearRect(0,0,W,H);const m=mctx.createImageData(W,H),D=m.data;for(let p=S.off[r];p<S.off[r+1];p++)D[S.pix[p]*4+3]=255;mctx.putImageData(m,0,0);}
  stamp(x,y,pr); flush();
}
function stamp(x,y,pr){
  const p=(pr>0&&pr!==.5)?pr:.5;
  if(stroke.er){const R=ERASER_R[sizeIdx];const c=S.free.ctx;c.save();c.globalCompositeOperation='destination-out';c.globalAlpha=.85;c.drawImage(tip,x-R,y-R,2*R,2*R);c.restore();return;}
  let R=PENCIL_R[sizeIdx]*(.65+.7*p);
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
  const step=Math.max(1,(stroke.er?ERASER_R:PENCIL_R)[sizeIdx]*(stroke.st?.45:.3)), n=Math.floor(dist/step);
  for(let i=1;i<=n;i++)stamp(lx+dx*i/n,ly+dy*i/n,pr);
  if(n)stroke.last=[x,y]; flush();
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
function endStroke(){ if(!stroke)return;
  if(!stroke.er){const c=S.free.ctx;c.save();
    if(stroke.neon){c.shadowColor=ink.hex;c.shadowBlur=18;c.drawImage(strokeC,0,0);c.shadowBlur=6;c.drawImage(strokeC,0,0);c.shadowBlur=0;}
    else if(stroke.st==='water'){c.globalCompositeOperation='multiply';c.globalAlpha=.9;}
    c.drawImage(strokeC,0,0);c.restore();}
  dirty('free'); strokeC.style.filter='';
  cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);stroke=null;}
function cancelStroke(){ if(!stroke)return; cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);strokeC.style.filter='';
  const u=S.free.undo.pop(); if(u)S.free.ctx.putImageData(u,0,0); stroke=null;}

/* ---------- zoom / pan (pinch, wheel) ---------- */
let Z={z:1,x:0,y:0};
function applyZoom(){const r=stage.getBoundingClientRect();Z.z=Math.min(4,Math.max(1,Z.z));
  Z.x=Math.min(0,Math.max(r.width-r.width*Z.z,Z.x));Z.y=Math.min(0,Math.max(r.height-r.height*Z.z,Z.y));
  zoomer.style.transform=`translate(${Z.x}px,${Z.y}px) scale(${Z.z})`;}
function resetZoom(){Z={z:1,x:0,y:0};applyZoom();}
stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const z0=Z.z,z1=Math.min(4,Math.max(1,z0*Math.exp(-e.deltaY*.0015)));Z.x=mx-(mx-Z.x)*z1/z0;Z.y=my-(my-Z.y)*z1/z0;Z.z=z1;applyZoom();},{passive:false});

/* ---------- pointer input ---------- */
const ptrs=new Map(); let pinch=null, down=null;
function toCanvas(e){const r=zoomer.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];}
stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return; stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){cancelStroke();down=null;const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,z:Z.z,x:Z.x,y:Z.y};return;}
  if(ptrs.size>2)return;
  const [x,y]=toCanvas(e); down={x:e.clientX,y:e.clientY,cx:x,cy:y,t:performance.now(),id:e.pointerId};
  if(mode==='free'&&(tool==='pencil'||tool==='eraser'||tool==='airbrush'||tool==='watercolor'))beginStroke(x,y,e.pressure);
});
stage.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top,z=Math.min(4,Math.max(1,pinch.z*d/pinch.d));
    Z.z=z;Z.x=mx-(pinch.mx-pinch.x)*z/pinch.z;Z.y=my-(pinch.my-pinch.y)*z/pinch.z;applyZoom();return;}
  if(stroke&&down&&e.pointerId===down.id){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of (evs.length?evs:[e])){const [x,y]=toCanvas(ev);moveStroke(x,y,ev.pressure);}}
});
function up(e){
  if(!ptrs.has(e.pointerId))return; ptrs.delete(e.pointerId);
  if(pinch){if(ptrs.size===0)pinch=null;return;}
  if(!down||e.pointerId!==down.id)return;
  const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);
  if(stroke)endStroke();
  else if(e.type==='pointerup'&&moved<14){ if(mode==='cbn')tapCBN(down.cx,down.cy); else if(tool==='fill')fillFree(down.cx,down.cy); }
  down=null;
}
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
stage.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- actions ---------- */
function undo(){
  if(mode==='cbn'){const c=S.cbn,b=c.hist.pop();if(!b)return;
    for(const r of b){c.filled[r]=0;paintRegion(r,[0,0,0],0);if(S.tgt[r]){c.doneT[S.num[r]]--;c.done--;}}
    c.complete=false;highlight();drawNums();progress();dirty('cbn');}
  else{const u=S.free.undo.pop();if(u){S.free.ctx.putImageData(u,0,0);dirty('free');}}
}
let armT=0;
function clearAll(){const b=$('#clear');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('span').textContent='Tap again';clearTimeout(armT);
    armT=setTimeout(()=>{b.classList.remove('arm');b.querySelector('span').textContent='Clear';},2500);return;}
  b.classList.remove('arm');b.querySelector('span').textContent='Clear';
  if(mode==='cbn'){const c=S.cbn;c.filled.fill(0);c.doneT.fill(0);c.done=0;c.hist=[];c.complete=false;c.img.data.fill(0);c.ctx.clearRect(0,0,W,H);
    selNum=1;markColor();highlight();drawNums();progress();dirty('cbn');}
  else{snap();S.free.ctx.clearRect(0,0,W,H);dirty('free');}
}
function save(){
  const c=mk(),x=c.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,W,H);
  x.drawImage(mode==='cbn'?S.cbn.c:S.free.c,0,0);x.drawImage(lineImg,0,0,W,H);
  const name=`EmberPost_scene${String(S.n).padStart(2,'0')}_${mode==='cbn'?'by-number':'free'}.png`;
  c.toBlob(b=>{const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Saved '+name);},'image/png');
}
$$('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$$('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$$('.size').forEach(b=>b.onclick=()=>{sizeIdx=+b.dataset.size;$$('.size').forEach(s=>s.classList.toggle('on',s===b));});
$('#clip').onclick=()=>{clip=!clip;$('#clip').classList.toggle('on',clip);};
$('#undo').onclick=undo;$('#clear').onclick=clearAll;$('#save').onclick=save;
$('#celebrate').onclick=()=>{$('#celebrate').hidden=true;};
window.addEventListener('resize',applyZoom);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}});

/* ---------- saving each scene's coloring ---------- */
const pend={};let saveT=0;
function dirty(kind){if(!S)return;pend[S.n]=pend[S.n]||{};pend[S.n][kind]=1;clearTimeout(saveT);saveT=setTimeout(saveNow,700);}
function saveNow(){clearTimeout(saveT);
  for(const k of Object.keys(pend)){const st=cache[k];if(!st){delete pend[k];continue;}const p=pend[k];
    if(p.cbn){const ids=[];for(let r=1;r<st.N;r++)if(st.cbn.filled[r])ids.push(r);ids.length?LS.set('cbn.'+k,ids.join(',')):LS.del('cbn.'+k);}
    if(p.free){let any=false;const d=st.free.ctx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
      if(any){let url=st.free.c.toDataURL('image/webp',.9);if(!url.startsWith('data:image/webp'))url=st.free.c.toDataURL('image/png');
      if(!LS.set('free.'+k,url))toast('Storage is full: free coloring not saved');}else LS.del('free.'+k);}
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
$('#rvNext').onclick=()=>{const n=+$('#reveal').dataset.next;closeReveal();if(n)showScene(n);};
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
function applySettingsUI(){$('#setStory').classList.toggle('on',!!settings.story);app.classList.toggle('storyon',!!settings.story);}
$('#setBtn').onclick=()=>{$('#settings').hidden=false;};
$('#setClose').onclick=()=>{$('#settings').hidden=true;};
$('#settings').onclick=e=>{if(e.target.id==='settings')$('#settings').hidden=true;};
$('#setStory').onclick=()=>{settings.story=!settings.story;LS.set('settings',settings);applySettingsUI();buildScenes();if(S)storyStrip();};
let rArm=0;
$('#setReset').onclick=()=>{const b=$('#setReset');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('b').textContent='Tap again to reset';clearTimeout(rArm);
    rArm=setTimeout(()=>{b.classList.remove('arm');b.querySelector('b').textContent='Reset';},3000);return;}
  clearTimeout(saveT);for(const k in pend)delete pend[k];LS.wipe();window.__resetting=true;location.reload();};
window.addEventListener('pagehide',()=>{if(window.__resetting)LS.wipe();});

/* ---------- upgrade sheet ---------- */
function drawPreview(){
  const cv=$('#upPreview'),x=cv.getContext('2d'),Wp=cv.width,Hp=cv.height;x.clearRect(0,0,Wp,Hp);
  const g=x.createLinearGradient(0,0,0,Hp);g.addColorStop(0,'#fffdf8');g.addColorStop(1,'#f3ece0');x.fillStyle=g;x.fillRect(0,0,Wp,Hp);
  const samples=[['m-gold'],['m-silver'],['m-rose'],['g-sapphire'],['g-rose'],['n-pink'],['n-cyan'],['airbrush','#3a6ad6'],['watercolor','#c9473d']];
  const cw=Wp/samples.length;
  samples.forEach(([id,bh],i)=>{const p=PREM[id],k=p.kind==='brush'?'plain':p.kind,hex=bh||p.hex,st=id==='airbrush'?'air':id==='watercolor'?'water':null;
    const c=document.createElement('canvas');c.width=Wp;c.height=Hp;const cx=c.getContext('2d');
    const R=st?20:13, x0=i*cw+cw*.18, x1=(i+1)*cw-cw*.18;
    for(let t=0;t<=1;t+=.01){const px=x0+(x1-x0)*t,py=Hp*.5+Math.sin(t*9+i)*Hp*.28*(1-.3*Math.abs(t-.5));
      if(st==='air'){cx.globalAlpha=.16;for(let k2=0;k2<10;k2++){const a=Math.random()*6.283,d=R*Math.random(),rr=1+Math.random()*2;cx.drawImage(tip,px+Math.cos(a)*d-rr,py+Math.sin(a)*d-rr,2*rr,2*rr);}}
      else{cx.globalAlpha=st?.09:.8;cx.drawImage(tip,px-R,py-R,2*R,2*R);}}
    cx.globalAlpha=1;cx.globalCompositeOperation='source-in';cx.fillStyle=cx.createPattern(inkTile(st?'plain':k,hex,st),'repeat');cx.fillRect(0,0,Wp,Hp);
    x.save();if(p.kind==='neon'){x.shadowColor=hex;x.shadowBlur=18;x.drawImage(c,0,0);x.shadowBlur=0;}if(st==='water')x.globalCompositeOperation='multiply';x.drawImage(c,0,0);x.restore();});
}
function openUpgrade(from){$('#upPrice').textContent=PCFG.price;$('#upMsg').textContent='';$('#upMsg').className='up-msg';
  const demo=PCFG.mode==='demo';$('#upBuy').querySelector('.demo-tag').hidden=!demo;
  $('#upNote').textContent=demo?'Demo build: no payment is taken. The unlock is saved on this device only.':'Secure checkout opens in a new page.';
  $('#upgrade').dataset.from=from||'';$('#upgrade').hidden=false;drawPreview();}
function upMsg(r){const m=$('#upMsg');m.textContent=r.msg;m.className='up-msg '+(r.ok?'ok':'bad');}
$('#upClose').onclick=()=>{$('#upgrade').hidden=true;};
$('#upgrade').onclick=e=>{if(e.target.id==='upgrade')$('#upgrade').hidden=true;};
$('#upBuy').onclick=async()=>{const r=await Premium.buy();upMsg(r);if(r.ok){celebrateUnlock();}};
$('#upRedeem').onclick=async()=>{const r=await Premium.redeem($('#upCode').value);upMsg(r);if(r.ok)celebrateUnlock();};
$('#upCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#upRedeem').click();});
function celebrateUnlock(){const c=$('.up-card');c.classList.remove('glow');void c.offsetWidth;c.classList.add('glow');
  const from=PREM[$('#upgrade').dataset.from];setTimeout(()=>{$('#upgrade').hidden=true;if(from){if(mode!=='free')setMode('free');pickPremium(from);}toast('Premium Pencils unlocked ✦');},1500);}
$('#setPremium').onclick=()=>{if(Premium.unlocked()){Premium.revoke();toast('Premium Pencils locked again (demo)');}else{$('#settings').hidden=true;openUpgrade();}};

/* ---------- test / debug hooks (read-only helpers) ---------- */
window.EP={
  state:()=>({scene:S&&S.n,mode,tool,selNum,done:S&&S.cbn.done,total:S&&S.total,complete:S&&S.cbn.complete}),
  targetsAll:(k)=>{const o=[];for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r])o.push([S.cx[r],S.cy[r],r]);return o;},
  lsBytes:()=>Object.keys(localStorage).filter(k=>k.startsWith('ep.v1.')).reduce((a,k)=>a+k.length+localStorage.getItem(k).length,0),
  targets:(k)=>{const o=[];for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r]&&S.fs[r])o.push([S.cx[r],S.cy[r],r]);return o;},
  wrongTarget:(k)=>{for(let r=1;r<S.N;r++)if(S.num[r]&&S.num[r]!==k&&S.fs[r]&&!S.cbn.filled[r])return [S.cx[r],S.cy[r],r];return null;},
  largest:(i=0)=>{const o=[];for(let r=1;r<S.N;r++)if(S.fs[r])o.push([S.cnt[r],r]);o.sort((a,b)=>b[0]-a[0]);const r=o[i][1];return [S.cx[r],S.cy[r],r];},
  regionAt:(x,y)=>S.lab[(y|0)*W+(x|0)],
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
setInkPattern(); buildScenes(); applySettingsUI(); Premium.handleReturn();
{const start=(prog.current&&isUnlocked(prog.current)&&IDS.includes(prog.current))?prog.current:IDS[0];
 if(start)showScene(start); else $('#scap').textContent='No scene data found.';}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW not registered',err)));}
})();
