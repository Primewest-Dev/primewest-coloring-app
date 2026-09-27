/* The Last Ember Post · Coloring (prototype). Plain JS, no dependencies, works offline and from file://. */
(()=>{
'use strict';
/* ---------- build check: index.html, app.js and the config must come from the same release. If an old cached page is
   paired with this script (or the reverse), clear the offline cache once and reload fresh instead of breaking. ---------- */
const EP_BUILD=10;
function epHeal(why){try{if(sessionStorage.getItem('ep.heal'))return false;sessionStorage.setItem('ep.heal',why);}catch(e){return false;}
  console.warn('Refreshing app files:',why);
  const go=()=>{const u=new URL(location.href);u.searchParams.set('_r',Date.now().toString(36));location.replace(u.toString());};
  const jobs=[];try{if(window.caches)jobs.push(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('emberpost')).map(n=>caches.delete(n)))));}catch(e){}
  try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.update().catch(()=>0)))));}catch(e){}
  Promise.all(jobs).catch(()=>0).then(go);setTimeout(go,2500);return true;}
try{const u=new URL(location.href);if(u.searchParams.has('_r')){u.searchParams.delete('_r');history.replaceState(null,'',u.toString());}}catch(e){}
if(window.EP_BUILD_HTML!==EP_BUILD&&/^https?:$/.test(location.protocol)&&epHeal('page build '+window.EP_BUILD_HTML+' vs script '+EP_BUILD))return;
window.addEventListener('error',e=>{if(!window.EP_OK&&/^https?:$/.test(location.protocol))epHeal('startup error: '+(e.message||''));});
const SC=(window.EP_SCENES=window.EP_SCENES||{});
/* chapters: data-driven from data/story.js; falls back to whatever scene files were loaded statically */
const STORY=window.EP_STORY||{chapters:Object.keys(SC).map(Number).sort((a,b)=>a-b).map(n=>({n,title:SC[n].title,teaser:SC[n].caption,story:SC[n].caption,data:null,thumb:SC[n].thumb}))};
const CH=STORY.chapters, CHM={}; CH.forEach(c=>CHM[c.n]=c);
const PLAY=CH.filter(c=>c.data||SC[c.n]);           // chapters that have art in this build, in story order
const IDS=PLAY.map(c=>c.n);
/* ---------- persistence (localStorage, all keys prefixed ep.v1.) ---------- */
const LSMEM={};   // values that did not fit in localStorage (kept for this session and in the IndexedDB autosave)
const LS={get(k,d){try{let v=localStorage.getItem('ep.v1.'+k);if(v==null&&('ep.v1.'+k) in LSMEM)v=LSMEM['ep.v1.'+k];return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){const s=JSON.stringify(v);try{localStorage.setItem('ep.v1.'+k,s);delete LSMEM['ep.v1.'+k];return true;}catch(e){console.warn('localStorage full, keeping in autosave',k);LSMEM['ep.v1.'+k]=s;return true;}},
  del(k){try{localStorage.removeItem('ep.v1.'+k);}catch(e){}delete LSMEM['ep.v1.'+k];},
  wipe(){try{Object.keys(localStorage).filter(k=>k.startsWith('ep.v1.')).forEach(k=>localStorage.removeItem(k));}catch(e){}for(const k in LSMEM)delete LSMEM[k];try{IDB.clear();}catch(e){}}};
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
  {id:'j-ruby',kind:'jewel',hex:'#c8123c',name:'Ruby'},{id:'j-emerald',kind:'jewel',hex:'#0f9d6e',name:'Emerald'},
  {id:'j-sapphire',kind:'jewel',hex:'#1f4fd1',name:'Sapphire'},{id:'j-amethyst',kind:'jewel',hex:'#8a2be2',name:'Amethyst'},
  {id:'j-topaz',kind:'jewel',hex:'#f2a81d',name:'Topaz'},
  {id:'s-charcoal',kind:'smoke',hex:'#4a4d55',name:'Charcoal smoke'},{id:'s-ash',kind:'smoke',hex:'#a9a9b2',name:'Ash smoke'},
  {id:'s-ember',kind:'smoke',hex:'#c77a4a',name:'Ember smoke'},{id:'s-violet',kind:'smoke',hex:'#8e7ab8',name:'Violet smoke'},
  {id:'s-teal',kind:'smoke',hex:'#5aa5a0',name:'Teal smoke'},
  {id:'k-white',kind:'cloud',hex:'#f7f9ff',name:'White cloud'},{id:'k-dawn',kind:'cloud',hex:'#f6c9d4',name:'Dawn cloud'},
  {id:'k-storm',kind:'cloud',hex:'#8f9bb0',name:'Storm cloud'},{id:'k-sky',kind:'cloud',hex:'#a9d4f5',name:'Sky cloud'},
  {id:'k-gold',kind:'cloud',hex:'#f5d68a',name:'Golden cloud'},
  {id:'airbrush',kind:'brush',name:'Soft airbrush'},{id:'watercolor',kind:'brush',name:'Watercolor wash'}];
/* gradient ramps (idea from the pop-pencils prototype): colour runs along the stroke, and slowly shifts (ping-pong) */
const RAMPS={...{},tropical:['#22c55e','#facc15','#fb923c','#ec4899','#a855f7'],ocean:['#e0f7fa','#4dd0e1','#0891b2','#1e40af','#0b1f4d'],
  fire:['#fef3c7','#fbbf24','#f97316','#dc2626','#7f1d1d'],sunset:['#fbbf24','#fb923c','#f43f5e','#a855f7','#3730a3'],aurora:['#06b6d4','#10b981','#84cc16','#facc15','#f43f5e'],
  cyber:['#a7f3d0','#06b6d4','#3b82f6','#a855f7','#ec4899'],vaporwave:['#fb7185','#a855f7','#3b82f6','#06b6d4','#a7f3d0'],rainbow:['#ef4444','#f59e0b','#facc15','#22c55e','#06b6d4','#a855f7'],
  miami:['#06b6d4','#a855f7','#ec4899','#f59e0b'],gold:['#fffbe6','#ffe066','#d4a015','#7c5810','#d4a015','#ffe066'],chrome:['#ffffff','#d4d8e0','#9098a8','#5a6478','#9098a8','#d4d8e0'],
  copper:['#fff1e6','#f4a261','#c5651e','#6b3210','#c5651e','#f4a261']};
// Depth Studio ideas: auto-animated wave curves, metal reflection ramps, travelling light pulses
const WAVES={sine:(t,f)=>Math.sin(t*f),triangle:(t,f)=>{const o=(t*f/Math.PI)%2;return (o<1?o:2-o)*2-1;},pulse:(t,f)=>Math.pow(Math.sin(t*f),3),
  smooth:(t,f)=>{const o=Math.sin(t*f);return o*Math.abs(o);},sawtooth:(t,f)=>((t*f/Math.PI)%2)-1};
const METAL={chrome:['#ffffff','#d4d8e0','#9098a8','#5a6478','#9098a8','#d4d8e0'],silver:['#f8f9fb','#c9d0db','#8e96a6','#525a6e','#8e96a6','#c9d0db'],
  gold:['#fffbe6','#ffe066','#d4a015','#7c5810','#d4a015','#ffe066'],copper:['#fff1e6','#f4a261','#c5651e','#6b3210','#c5651e','#f4a261'],gunmetal:['#dde0e6','#8a92a2','#4a525e','#1f242c','#4a525e','#8a92a2']};
function metalOf(hex){const [r,g,b]=hex2rgb(hex),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx<90)return 'gunmetal';if(mx-mn<40)return mx>215?'chrome':'silver';if(r>g&&g>b&&r-b>70)return g>150?'gold':'copper';return 'chrome';}
function lightPulse(d,t,speed,count,dir){let best=0;for(let p=0;p<count;p++){let pos=((t*speed)+p/count)%1;if(dir==='reverse')pos=1-pos;else if(dir==='bounce')pos=pos<.5?pos*2:2-pos*2;
  const e=d-pos;best=Math.max(best,Math.exp(-e*e*24));}return best;}
const RAMP_WAVE={rainbow:'sawtooth',aurora:'smooth',cyber:'triangle',vaporwave:'smooth',miami:'triangle'};
const RAMP_LUT={};function rampLUT(k){if(RAMP_LUT[k])return RAMP_LUT[k];const cs=(RAMPS[k]||METAL[k]||RAMPS.rainbow).map(hex2rgb),L=new Uint8ClampedArray(256*3);
  for(let i=0;i<256;i++){const pos=Math.min(.9999,i/255)*(cs.length-1),j=pos|0,f=pos-j,a=cs[j],b=cs[j+1];for(let c=0;c<3;c++)L[i*3+c]=a[c]+(b[c]-a[c])*f;}return RAMP_LUT[k]=L;}
const rampRgb=(k,t)=>{const L=rampLUT(k),i=Math.max(0,Math.min(255,Math.round(t*255)))*3;return [L[i],L[i+1],L[i+2]];};
const pingpong=t=>{t-=Math.floor(t);return t<.5?t*2:2-t*2;};
const RAMP_LEN=320;   // px of stroke per full run through the ramp
for(const [k,n] of [['rainbow','Rainbow'],['tropical','Tropical'],['ocean','Ocean'],['fire','Fire'],['sunset','Sunset'],['aurora','Aurora'],['cyber','Cyber'],['vaporwave','Vaporwave'],
  ['miami','Miami'],['gold','Gold ramp'],['chrome','Chrome ramp'],['copper','Copper ramp']])PREMIUM.splice(PREMIUM.length-2,0,{id:'r-'+k,kind:'ramp',ramp:k,hex:RAMPS[k][Math.floor(RAMPS[k].length/2)],name:n});
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
    else if(k==='jewel'){const f=Math.abs(Math.sin(T*(xx*.9+yy*.45)/n*2))*.6+Math.abs(Math.sin(T*(xx*.3-yy*.8)/n*3))*.4;
      col=f>.9?mix(rgb,WHITE,.75):mix(rgb.map(c=>c*.55),mix(rgb,WHITE,.3),f);a=235+20*g;}
    else if(k==='smoke'||k==='cloud'){const fx=xx/16,fy=yy/16,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,q=(u,v)=>vn[v*17+u];
      const v=(q(ix,iy)*(1-tx)+q(ix+1,iy)*tx)*(1-ty)+(q(ix,iy+1)*(1-tx)+q(ix+1,iy+1)*tx)*ty;
      if(k==='smoke'){col=rgb.map(c=>Math.min(255,c*(.8+.3*v)));a=150+95*v;}else{col=mix(rgb,WHITE,.2+.35*v);a=170+85*v;}}
    D[j]=col[0];D[j+1]=col[1];D[j+2]=col[2];D[j+3]=a;}
  x.putImageData(im,0,0);
  if(k==='glitter'&&!style){x.fillStyle='rgba(255,255,255,.95)';  // star glints
    for(let s=0;s<22;s++){const gx=12+hash2(s,91)*(n-24),gy=12+hash2(91,s)*(n-24),L=2+hash2(s,s)*4;x.fillRect(gx-L,gy-.6,2*L,1.2);x.fillRect(gx-.6,gy-L,1.2,2*L);}}
  return c;}
function setGrainColor(hex){grainPat=sctx.createPattern(inkTile('plain',hex),'repeat');}
function strokeStyle(){return tool==='airbrush'?'air':tool==='watercolor'?'water':null;}
const inkKind=()=>ink.kind==='mix'?((ink.mix&&ink.mix.finish)||'plain'):ink.kind;
function setInkPattern(){const st=strokeStyle();grainPat=sctx.createPattern(inkTile(st?'plain':inkKind(),ink.hex,st),'repeat');}
/* fill shading for the tap-to-fill tool (premium inks get a metallic gradient + highlight, sparkle, or a neon core) */
function shader(bx,by,bw,bh){const rgb=hex2rgb(ink.hex),K=inkKind();
  if(K==='ramp'){const k=ink.ramp;return (x,y)=>rampRgb(k,pingpong(((x-bx)+(y-by)*.6)/RAMP_LEN));}
  if(K==='jewel'){const hx=bx+bw*.3,hy=by+bh*.25,sx=Math.max(6,bw*.12),sy=Math.max(6,bh*.1);
    return (x,y)=>{const f=Math.abs(Math.sin(((x-bx)*.9+(y-by)*.45)*.045))*.6+Math.abs(Math.sin(((x-bx)*.3-(y-by)*.8)*.06))*.4;
      const c=f>.92?mix(rgb,WHITE,.7):mix(rgb.map(v=>v*.55),mix(rgb,WHITE,.3),f);const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,hl*.7);};}
  if(K==='smoke'){const cx=bx+bw/2,cy=by+bh/2;return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1))),n=hash2(x>>3,y>>3);
    return [rgb[0],rgb[1],rgb[2],Math.round(200-110*d+30*(n-.5))];};}
  if(K==='cloud'){const cx=bx+bw*.45,cy=by+bh*.4;return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));
    const c=mix(mix(rgb,WHITE,.45),rgb.map(v=>v*.86),d*d);return [c[0],c[1],c[2],Math.round(255-60*d*d)];};}
  if(K==='metal'){const hx=bx+bw*.3,hy=by+bh*.26,sx=Math.max(8,bw*.24),sy=Math.max(8,bh*.18);
    return (x,y)=>{const u=((x-bx)/bw+(y-by)/bh)/2;let v=.5+.45*Math.sin(u*Math.PI*2.1-.5);let c=metalAt(rgb,v);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,hl*.55);};}
  if(K==='chrome'){const hx=bx+bw*.28,hy=by+bh*.22,sx=Math.max(4,bw*.08),sy=Math.max(4,bh*.05);
    return (x,y)=>{const t=((y-by)/(bh||1))*.95+((x-bx)/(bw||1))*.18+.03*Math.sin(x*.05);let c=chromeAt(rgb,t);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,Math.min(1,hl*1.2));};}
  if(K==='glow'){const cx=bx+bw/2,cy=by+bh/2;const core=mix(rgb,WHITE,.35);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,d);};}
  if(K==='glitter')return (x,y)=>{const h=hash2(x,y),g=grainA[(y&255)*256+(x&255)]/255;
    return h<.06?mix(rgb,WHITE,.75+.25*hash2(y,x)):h<.1?rgb.map(c=>c*.5):rgb.map(c=>c*(.8+.18*g));};
  if(K==='neon'){const cx=bx+bw/2,cy=by+bh/2,R=Math.max(bw,bh)/2||1;const core=mix(rgb,WHITE,.45);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,Math.pow(d,.8));};}
  return ()=>rgb;}
/* entitlement: demo unlock, codes, and a hook for Stripe / license servers (see premium-config.js) */
const RAWCFG=window.EP_PREMIUM_CONFIG||{};
const PCFG=Object.assign({mode:'demo',verifyUrl:'',licenseCheckUrl:''},RAWCFG);
PCFG.products=Object.assign({
  pencils:{productId:RAWCFG.productId||'emberpost-premium-pencils',productName:RAWCFG.productName||'Premium Pencils',price:RAWCFG.price||'$2.99',
    stripePaymentLink:RAWCFG.stripePaymentLink||'',demoCodes:RAWCFG.demoCodes||[],storageKey:RAWCFG.storageKey||'ep.premium.v1'},
  palettes:{productId:'emberpost-all-palettes',productName:'All Palettes',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.palettes.v1'},
  effects3d:{productId:'emberpost-effects-3d',productName:'3D Pop',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.effects3d.v1'},
  smoke:{productId:'emberpost-smoke',productName:'Smoke Pencils',price:'$2.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.smoke.v1'},
  clouds:{productId:'emberpost-clouds',productName:'Cloud Pencils',price:'$2.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.clouds.v1'},
  gradients:{productId:'emberpost-gradients',productName:'Rainbow & Gradient Pencils',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.gradients.v1'}},RAWCFG.products||{});
if(!PCFG.products.gradients)PCFG.products.gradients={productId:'emberpost-gradients',productName:'Rainbow & Gradient Pencils',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.gradients.v1'};
for(const [k,d] of Object.entries({smoke:{productId:'emberpost-smoke',productName:'Smoke Pencils',price:'$2.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.smoke.v1'},
  clouds:{productId:'emberpost-clouds',productName:'Cloud Pencils',price:'$2.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.clouds.v1'}}))if(!PCFG.products[k])PCFG.products[k]=d;
const OWNER=window.EP_OWNER||null;   // owner test unlock: defined ONLY in premium-config.js (REMOVE BEFORE SELLING block)
PCFG.ownerCodes=OWNER?(OWNER.codes||[]):[];
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
const Premium=makeEntitlement('pencils'), Palettes=makeEntitlement('palettes'), Effects3D=makeEntitlement('effects3d');makeEntitlement('smoke');makeEntitlement('clouds');makeEntitlement('gradients');
/* a code can unlock any product: the one whose code it is (demo codes, or the license server per product) */
async function redeemCode(raw,prefer){const code=String(raw||'').trim().toUpperCase();if(!code)return {ok:false,msg:'Type your code first.'};
  const keys=[prefer,...Object.keys(ENT).filter(k=>k!==prefer)];
  if(OWNER&&PCFG.ownerCodes.map(c=>String(c).toUpperCase()).includes(code)){Object.values(ENT).forEach(e=>e.grant('owner-code'));
    try{localStorage.setItem(OWNER.storageKey||'ep.owner.v1','1');}catch(e){}setTimeout(()=>ownerBar(),0);
    return {ok:true,key:'all',msg:'Owner code accepted: everything is unlocked on this device (no payment taken).'};}
  if(PCFG.licenseCheckUrl){try{for(const k of keys){if(await ENT[k].check(PCFG.licenseCheckUrl,{code,product:ENT[k].P.productId})){ENT[k].grant('code');return {ok:true,key:k,msg:`Code accepted. ${ENT[k].P.productName} unlocked.`};}}
      return {ok:false,msg:'That code isn\u2019t valid.'};}catch(e){return {ok:false,msg:'Couldn\u2019t check the code. Are you online?'};}}
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
  if(p.kind==='ramp'){const cs=RAMPS[p.ramp],gid='rg-'+p.ramp,st=cs.map((c,i)=>`<stop offset="${(i/(cs.length-1)).toFixed(2)}" stop-color="${c}"/>`).join('');
    return `<svg viewBox="0 0 30 74"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">${st}</linearGradient></defs><path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${cs[0]}"/><rect x="8.5" y="19" width="13" height="52" rx="2" fill="url(#${gid})"/><rect x="10" y="21" width="3" height="48" rx="1.5" fill="#fff" opacity=".35"/></svg>`;}
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
  .concat([['metal','Metallic'],['chrome','Chrome'],['glitter','Glitter'],['jewel','Jewel'],['neon','Neon'],['glow','Glow'],['pulse','Pulse'],['ramp','Gradients','gradients'],['smoke','Smoke','smoke'],['cloud','Clouds','clouds'],['brush','Brushes']]
    .map(([k,n,pr])=>({id:k,name:n,product:pr||'pencils',type:'ink',items:PREMIUM.filter(p=>p.kind===k)})));
const SETI={};SETS.forEach((t,i)=>SETI[t.id]=i);
let setIdx=SETI[settings.pset];if(!(setIdx>=0&&setIdx<SETS.length)||!((SETS[setIdx].colors||SETS[setIdx].items||[]).length)){setIdx=0;settings.pset=SETS[0].id;}   // unknown / old saved set -> default
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
  {const lab=host===fr?null:fr.querySelector('.plabel');if(lab){const cv=pvCanvas('pstrip',118,30);lab.appendChild(cv);
    pvAdd(cv,t=>drawFxPreview(cv,MIX.on&&set.type==='ink'&&set.id!=='brush'?specOfMix(set.items.slice(0,3).map(p=>p.hex)):specOfSet(set),t));}}
  $('#mixBtn')&&$('#mixBtn').classList.toggle('on',MIX.on);
  if(set.type==='plain')set.colors.forEach(h=>{const b=document.createElement('button');b.className='pencil'+(set.id==='jewel'?' jewelc':'')+(own?'':' dim');b.dataset.c=h;b.title=h;b.innerHTML=pencilSVG(h);
      b.onclick=()=>usePlain(set,h);host.appendChild(b);});
  else set.items.forEach(p=>{const b=document.createElement('button');b.className='pencil premium '+p.kind+(GEMS.has(p.id)?' gem':'')+(p.kind==='neon'||p.kind==='glow'?' n-'+p.id.slice(2):'')+(own?'':' dim');
      b.dataset.p=p.id;b.title=p.name;b.innerHTML=premiumIcon(p);b.onclick=()=>usePremium(set,p);host.appendChild(b);});
  if(set.id==='book'){const t=document.createElement('button');t.className='moresets';t.innerHTML='<b>✦ More sets</b><span>Palettes, metallic, chrome, glow…</span>';
    t.onclick=()=>flipSet(1);fr.appendChild(t);}
  markColor();}
function flipSet(d){setIdx=(setIdx+d+SETS.length)%SETS.length;settings.pset=SETS[setIdx].id;LS.set('settings',settings);buildPalette();$('#colors').scrollLeft=$('#numrow').offsetWidth;}
function usePlain(set,h){
  if(!owned(set)){const ps=Trials.palScene();
    if(ps!=null&&S&&ps!==S.n){openUpgrade(null,'palettes');return;}
    if(ps==null){Trials.setPalScene(S.n);toast(`Preview: themed palettes are free on this page`);buildPalette();}}
  pickColor(h);if(set.id==='jewel'&&ink.kind==='plain')ink.fx='shimmer';}
function usePremium(set,p){
  if(!owned(set)&&Trials.left(set.id)<=0){openUpgrade(p.id,set.product);return;}
  if(!owned(set))toast(`Free try: ${p.name} · ${Trials.left(set.id)} ${Trials.left(set.id)===1?'stroke':'strokes'} left (a fill uses 3)`);
  pickPremium(p);}
/* called when a stroke/fill starts with a premium ink/brush: spend a free try or open the upgrade sheet. returns false to block */
function allowPremiumUse(cost){
  if(ink.kind==='mix'&&tool!=='eraser'&&!PREM[tool]){const need=mixSetsUsed().filter(t=>!owned(t));
    const short=need.find(t=>Trials.left(t.id)<Math.min(cost,1));if(short){openUpgrade(null,short.product);return false;}
    need.forEach(t=>Trials.spend(t.id,Math.min(cost,Trials.left(t.id))));if(need.length){buildPalette();buildMixer();}return true;}
  const set=tool==='eraser'?null:(setOfTool()||setOfInk());if(!set||owned(set))return true;
  if(Trials.left(set.id)<cost){openUpgrade(PREM[tool]?tool:ink.id,set.product||'pencils');return false;}
  Trials.spend(set.id,Math.min(cost,Trials.left(set.id)));buildPalette();
  if(Trials.left(set.id)===0)setTimeout(()=>toast(`That was your last free ${set.name} try ✦`),300);return true;}
function refreshPremiumUI(){buildPalette();
  for(const [key,sub] of [['pencils','Metallic, chrome, glitter, neon, glow, pulse + brushes'],['palettes','Sunset, Ocean, Forest and 5 more palettes'],['effects3d','Pop Pencil, 3D Pop and the 3D views'],['smoke','5 drifting smoke pencils'],['clouds','5 billowing cloud pencils'],['gradients','Rainbow + 11 gradient ramps that shift along the stroke']]){
    const on=ENT[key].unlocked(),b=$(`#set_${key} b`),sm=$(`#set_${key} small`);if(b){b.textContent=on?'Lock again (demo)':'Unlock';sm.textContent=on?`Unlocked on this device (${(ENT[key].state()||{}).source||'demo'})`:sub;}}
  ownerBar();if(!$('#mixer').hidden)buildMixer();
  const pt=$('#popTries');if(pt)pt.textContent=ENT.effects3d.unlocked()?'':`Free tries: ${Trials.popsLeft()} left`;
  markColor();}
function pickPremium(p){if(MIX.on){MIX.on=false;$('#mixer').hidden=true;$('#mixBtn').classList.remove('on');}
  if(p.kind==='chrome')enableTilt();
  if(p.kind==='brush'){setTool(p.id);} else {ink={kind:p.kind,hex:p.hex,id:p.id,ramp:p.ramp};color=p.hex;if(tool==='eraser')setTool('pencil');}
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
function pickColor(h){color=h;ink={kind:'plain',hex:h,id:null};if(tool==='eraser')setTool('pencil');if(MIX.on)mixInk();setInkPattern();markColor();
  $$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});}
function setTool(t){tool=t;$$('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));app.classList.toggle('tool-pop',t==='pop'||t==='poppencil');app.classList.toggle('tool-pp',t==='poppencil');
  if(t!=='pop'&&t!=='poppencil'&&$('#idea3d').classList.contains('on'))idea3d(false);
  if(t==='pop'||t==='poppencil'){enableTilt();refreshPremiumUI();}setInkPattern();if(S)markColor();}

async function showScene(n){
  if(!isUnlocked(n)){const i=IDS.indexOf(n),prev=IDS[i-1];toast(`Locked · finish Chapter ${prev} to unlock`);
    const b=$(`.scene[data-n="${n}"]`);if(b){b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');}return;}
  if(S&&S.n!==n)saveNow();
  S=await loadScene(n); resetZoom(); prog.current=n; saveProg();
  $$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  storyStrip();
  lineImg.src=S.d.line; lineImg.onload=()=>{scheduleLineTint();linesApply();linesDoneGlow();}; layers.innerHTML=''; layers.appendChild(S.cbn.c); layers.appendChild(S.free.c); if(S.pulse)layers.appendChild(S.pulse.c);
  renderPops(); ppAttach(S); fxAttach(); fxStart(); if($('#idea3d').classList.contains('on'))idea3d(false); loadVectorLines(n);
  selNum=firstOpen()||1; buildColors(); setMode(mode,true);
  needDepth(n).then(()=>{if(S.n!==n)return;cleanPops(S);apply3D(true);});
}
function setMode(m,force){
  if(m===mode&&!force)return; mode=m; app.classList.toggle('cbn',m==='cbn'); app.classList.toggle('free',m==='free');
  $$('.mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));modeLabels();
  S.cbn.c.style.display=m==='cbn'?'':'none'; S.free.c.style.display=m==='free'?'':'none'; scheduleLineTint(); try{renderIdeas();}catch(e){} if(!linesDefault(S.lines))scheduleLines(); if(S.fxC){S.fxC.style.display=m==='free'?'':'none';if(m==='free')fxStart();}
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
  batch.t=Date.now();c.hist.push(batch); if(c.hist.length>400)c.hist.shift(); dirty('cbn');
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
function snap(){const f=S.free;f.undo.push({t:Date.now(),f:f.ctx.getImageData(0,0,W,H),p:S.pulseUsed?S.pulse.ctx.getImageData(0,0,W,H):null});if(f.undo.length>15)f.undo.shift();}
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
  for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],x=i%W,y=(i/W)|0,j=(y-by)*bw*4+(x-bx)*4,c=sh(x,y);D[j]=c[0];D[j+1]=c[1];D[j+2]=c[2];D[j+3]=c[3]??255;}
  if(halo){const t=document.createElement('canvas');t.width=W;t.height=H;t.getContext('2d').putImageData(im,bx,by);haloDraw(tc,t,ink.hex);}
  else tc.putImageData(im,bx,by);
  if(pulse){S.pulseUsed=true;dirty('pulse');} dirty('free');
  if(ink.kind==='ramp'){const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],X=i%W,Y=(i/W)|0,j=((Y-by)*bw+(X-bx))*4;m.data[j]=Math.round(pingpong(((X-bx)+(Y-by)*.6)/RAMP_LEN)*255);m.data[j+3]=255;}
    const mc=mk();mc.getContext('2d').putImageData(m,bx,by);fxAdd(['rampfx'],ink.ramp,mc);}
  {const ks=fxKindsOf(ink);if(ks.length){const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p];m.data[(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3]=255;}
    const mc=mk();mc.getContext('2d').putImageData(m,bx,by);fxAdd(ks,ink.hex,mc);}}
  helperAfterColor(r);
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
let lastStroke=null,rampC=null,rampT=null;
function rampStamp(x,y,R){const rp=stroke.ramp;rp.d+=Math.hypot(x-rp.last[0],y-rp.last[1]);rp.last=[x,y];const t=pingpong(rp.d/RAMP_LEN),c=rampRgb(rp.k,t),rr=R*1.3;
  const a=rampC.getContext('2d'),b=rampT.getContext('2d');a.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;a.beginPath();a.arc(x,y,rr,0,6.2832);a.fill();
  b.fillStyle=`rgb(${Math.round(t*255)},0,0)`;b.beginPath();b.arc(x,y,rr,0,6.2832);b.fill();}
let stroke=null;
function beginStroke(x,y,pr,ptype){
  if(tool!=='eraser'&&!allowPremiumUse(1))return;
  snap(); let r=labAt(x,y);
  const locked=tool!=='eraser'&&clip, onInk=locked&&(!r||isInk(x,y));
  if(onInk){const q=nearestPx(x,y,LINE_LOCK.SNAP_START,(v,u,w)=>v>0&&!isInk(u,w));if(q){r=labAt(q[0],q[1]);x=q[0]+.5;y=q[1]+.5;}}  // started on a line: snap
  stroke={last:[x,y],region:locked?r:0,er:tool==='eraser',st:strokeStyle(),neon:(ink.kind==='neon'||ink.kind==='glow'||(ink.kind==='mix'&&ink.mix.finish==='neon'))&&!strokeStyle(),pulse:ink.kind==='pulse'&&!strokeStyle()&&tool!=='eraser',dirty:null,
    pen:ptype==='pen',inPt:[x,y],exit:null,brace:null};
  lastStroke={snapped:onInk,start:r,regions:locked&&r?[r]:[],breaks:0,locked};
  strokeC.style.filter=stroke.neon?(ink.kind==='glow'?`drop-shadow(0 0 8px ${ink.hex}) drop-shadow(0 0 18px ${ink.hex})`:`drop-shadow(0 0 3px ${ink.hex}) drop-shadow(0 0 9px ${ink.hex})`):'';
  if(stroke.region)setMask(r);
  if(ink.kind==='ramp'&&!stroke.er&&!stroke.st){rampC=rampC||mk();rampT=rampT||mk();rampC.getContext('2d').clearRect(0,0,W,H);rampT.getContext('2d').clearRect(0,0,W,H);stroke.ramp={k:ink.ramp,d:0,last:[x,y]};}
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
  else{const j=R*.15,rich=['metal','glitter','neon','jewel','chrome'].includes(inkKind());if(ink.kind==='smoke'||ink.kind==='cloud'){R*=1.5;cov.globalAlpha=ink.kind==='smoke'?.4+.3*p:.5+.35*p;cov.drawImage(tip,x-R,y-R,2*R,2*R);}else{
    cov.globalAlpha=rich?.75+.25*p:.45+.4*p; cov.drawImage(tip,x-R+(Math.random()-.5)*j,y-R+(Math.random()-.5)*j,2*R,2*R);}if(stroke.ramp)rampStamp(x,y,R);}
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
  sctx.globalCompositeOperation='source-in';if(stroke.ramp)sctx.drawImage(rampC,x,y,w,h,x,y,w,h);else{sctx.fillStyle=grainPat;sctx.fillRect(x,y,w,h);}sctx.restore();
}
function commitPaint(){
  if(!stroke.er){const c=stroke.pulse?pulseLayer().ctx:S.free.ctx;c.save();if(stroke.pulse){S.pulseUsed=true;dirty('pulse');}
    if(stroke.neon&&ink.kind==='glow'){haloDraw(c,strokeC,ink.hex);}
    else if(stroke.neon){c.shadowColor=ink.hex;c.shadowBlur=18;c.drawImage(strokeC,0,0);c.shadowBlur=6;c.drawImage(strokeC,0,0);c.shadowBlur=0;}
    else if(stroke.st==='water'){c.globalCompositeOperation='multiply';c.globalAlpha=.9;}
    c.drawImage(strokeC,0,0);c.restore();
    if(stroke.ramp){const tm=mk(),tx=tm.getContext('2d');tx.drawImage(rampT,0,0);tx.globalCompositeOperation='destination-in';tx.drawImage(strokeC,0,0);fxAdd(['rampfx'],stroke.ramp.k,tm);}
    else fxAdd(fxKindsOf(ink),ink.hex,strokeC);}
}
function endStroke(){ if(!stroke)return; flush(); commitPaint(); if(stroke.er)setTimeout(fxClip,0);
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
    vline.innerHTML=`<path fill="#141414" fill-rule="evenodd" d="${L.d}"/>`;vline.dataset.n=n;lineTintSVG();if(S&&S.n==n)linesApply();applyZoom();};
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
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return; if(e.target.closest&&e.target.closest('.zoomui,.tryrow,.nudge,.ideasbar'))return;
  stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.button===1||spaceDown){e.preventDefault();down={x:e.clientX,y:e.clientY,id:e.pointerId,pan:true,zx:Z.x,zy:Z.y};stage.classList.add('panning');return;}
  if(ptrs.size===2){cancelStroke();down=null;const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,z:Z.z,x:Z.x,y:Z.y};return;}
  if(ptrs.size>2)return;
  const [x,y]=toCanvas(e); down={x:e.clientX,y:e.clientY,cx:x,cy:y,t:performance.now(),id:e.pointerId,zx:Z.x,zy:Z.y};
  // a one-finger / pen stroke with a drawing tool always draws (never pans); other tools pan when dragged while zoomed
  if(mode==='free'&&(tool==='pencil'||tool==='eraser'||tool==='airbrush'||tool==='watercolor'))beginStroke(x,y,e.pressure,e.pointerType);
  else if(mode==='free'&&tool==='poppencil'){ppBegin(x,y);down.pp=!!pps;if(pps&&settings.ppColor!==false)beginStroke(x,y,e.pressure,e.pointerType);}   // Color while popping: raise + paint in one stroke
});
stage.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top,z=Math.min(MAXZ,Math.max(1,pinch.z*d/pinch.d));
    Z.z=z;Z.x=mx-(pinch.mx-pinch.x)*z/pinch.z;Z.y=my-(pinch.my-pinch.y)*z/pinch.z;applyZoom();return;}
  if(pps&&down&&e.pointerId===down.id){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ev of (evs.length?evs:[e])){const [x,y]=toCanvas(ev);ppMove(x,y);if(stroke)moveStroke(x,y,ev.pressure);}return;}
  if(down&&e.pointerId===down.id&&!stroke&&!down.pp&&(down.pan||(Z.z>1.01&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10))){
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
  if(pps){ppEnd();if(stroke){const r=stroke.region||labAt(down.cx,down.cy);endStroke();helperAfterColor(r);}down=null;return;}
  if(stroke){const r=stroke.region||labAt(down.cx,down.cy);endStroke();helperAfterColor(r);}
  else if(e.type==='pointerup'&&moved<14){ if(mode==='cbn')tapCBN(down.cx,down.cy); else if(tool==='fill')fillFree(down.cx,down.cy); else if(tool==='pop')popTap(down.cx,down.cy); else if(tool==='poperase')popErase(down.cx,down.cy); }
  down=null;
}
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
stage.addEventListener('contextmenu',e=>e.preventDefault());


/* ---------- 3D Pop: distance-transform height map -> bevel lighting (top-left light), inner shadow, soft drop shadow ---------- */
const POP={depth:Math.abs(+(settings.popDepth||60)),pressed:settings.popMode==='pressed'||settings.popMode==='inset',flat:settings.popMode==='flat',whole:settings.popWhole!==false};
POP.flat=false;POP.depth=60;POP.whole=true;
const popModeName=()=>POP.pressed?'Inset':'Raise';
function chamfer(d,w,h){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}}
function popRender(st,pop,sh,li){ // draws one pop into shadow ctx `sh` and light ctx `li` (both W×H)
  const rs0=pop.rs||[pop.r],inG=new Set(rs0),A=adjacency(st),rs=rs0.slice();
  for(const r of rs0)for(const b of A[r])if(!inG.has(b)&&st.cnt[b]<6000&&[...A[b]].every(q=>inG.has(q)||q===b)){inG.add(b);rs.push(b);}  // fill enclosed holes (stars, specks)
  let bx0=W,by0=H,bx1=-1,by1=-1;for(const r of rs){const b=r*4;if(st.bb[b+2]<0)continue;bx0=Math.min(bx0,st.bb[b]);by0=Math.min(by0,st.bb[b+1]);bx1=Math.max(bx1,st.bb[b+2]);by1=Math.max(by1,st.bb[b+3]);}
  if(bx1<0)return;const D=(4+pop.depth*.22)*(pop.hz!=null?.45+.9*pop.hz:1)*(pop.k==null?1:.3+.7*pop.k),M=Math.ceil(D*1.6)+10;
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
    const v=dot+amb-(pop.pressed?.28*hg[i]:0);   // inset: darker toward the middle
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
  for(const p of st.pops||[]){const k=p.k==null?1:Math.max(0,Math.min(1,p.k));if(k<=0)continue;sh.globalAlpha=li.globalAlpha=k;popRender(st,p,sh,li);}
  sh.globalAlpha=li.globalAlpha=1;
  if(st===S&&!st.popSh.isConnected){layers.appendChild(st.popSh);layers.appendChild(st.popLi);}popParallax();if(st===S)scheduleLineTint();}
function savePops(st){(st.pops||[]).length?LS.set('pop.'+st.n,st.pops.map(({k,anim,...p})=>p)):LS.del('pop.'+st.n);}
/* the tapped area = the region plus touching regions painted the same colour (e.g. an envelope split by light rays) */
function popGroup(r){const c=S.rc&&S.rc[r];if(!c)return [r];const A=adjacency(),seen=new Set([r]),q=[r];let area=S.cnt[r];
  while(q.length&&seen.size<80){const a=q.shift();for(const b of A[a])if(!seen.has(b)&&S.rc[b]===c&&area+S.cnt[b]<W*H*.45){seen.add(b);area+=S.cnt[b];q.push(b);}}return [...seen];}
/* 3D Pop tap cycle: each tap on an area goes Raise -> Flat -> Inset -> Raise ... with a short animated transition */
function popAnim(p,from,to,done,ms=240){const t0=performance.now();p.k=from;
  const step=now=>{const u=Math.min(1,(now-t0)/ms),e=u<.5?2*u*u:1-2*(1-u)*(1-u);p.k=from+(to-from)*e;renderPops();
    if(u<1)requestAnimationFrame(step);else{delete p.k;if(done)done();}};
  if(RM.matches||document.hidden){p.k=to;renderPops();delete p.k;if(done)done();return;}requestAnimationFrame(step);}
function popTap(x,y){const r=labAt(x,y);if(!r)return;S.pops=S.pops||[];const i=S.pops.findIndex(p=>(p.rs||[p.r]).includes(r));
  const T=depthOf(S);S.popNext=S.popNext||{};
  if(POP.flat){if(i>=0){S.pops.splice(i,1);renderPops();dirty('pop');toast('Flattened');}else toast('Flat: tap a raised or inset area to flatten it');return;}
  if(i>=0){const p=S.pops[i],rsP=p.rs||[p.r],drop=()=>{const j=S.pops.indexOf(p);if(j>=0)S.pops.splice(j,1);renderPops();dirty('pop');};
    if(p.anim)return;p.anim=1;
    if(!p.pressed){rsP.forEach(q=>S.popNext[q]='inset');popAnim(p,1,0,()=>{delete p.anim;drop();});toast('Flat · tap again to press it in');return;}   // Raise -> Flat
    rsP.forEach(q=>delete S.popNext[q]);
    if(T&&T.lv[r]<0){popAnim(p,1,0,()=>{delete p.anim;drop();});toast('Flat');return;}                                                     // an opening only goes Inset <-> Flat
    popAnim(p,1,0,()=>{p.pressed=false;popAnim(p,0,1,()=>{delete p.anim;renderPops();dirty('pop');});});toast('Raised');return;}              // Inset -> Raise
  const want=S.popNext[r],pressed=want?want==='inset':POP.pressed;
  if(T&&!(T.lv[r]===2||(T.lv[r]<0&&(pressed||want)))){shake();toast(T.lv[r]===0?'Background stays flat':T.lv[r]<0?'This opening sits below the surface · try Inset':'Only foreground objects pop');return;}
  if(!Effects3D.unlocked()){if(Trials.popsLeft()<=0){openUpgrade(null,'effects3d');return;}Trials.spendPop();refreshPremiumUI();
    const l=Trials.popsLeft();toast(l?`3D Pop · free tries: ${l} left`:'That was your last free 3D Pop ✦');}
  let rs=POP.whole&&T?objectOf(S,r):popGroup(r);if(T)rs=T.lv[r]<0?rs.filter(q=>T.lv[q]<0):rs.filter(q=>T.lv[q]===2);if(!rs.length)rs=[r];
  rs.forEach(q=>delete S.popNext[q]);delete S.popNext[r];
  const hz=T?rs.reduce((a,q)=>a+T.h[q],0)/rs.length/100:null,p={r,rs,depth:POP.depth,pressed:(T&&T.lv[r]<0)?true:pressed,hz};
  S.pops.push(p);p.anim=1;popAnim(p,0,1,()=>{delete p.anim;renderPops();dirty('pop');});if(want==='inset')toast('Inset · tap again to raise it');}
function shake(){stage.classList.remove('shake');void stage.offsetWidth;stage.classList.add('shake');try{navigator.vibrate&&navigator.vibrate(15);}catch(e){}}
function popRestyle(){ // slider / toggle apply to the most recent pop, and to new ones
  if(POP.flat)return;if(S&&S.pops&&S.pops.length){const p=S.pops[S.pops.length-1];p.depth=POP.depth;p.pressed=POP.pressed;renderPops();dirty('pop');}}
function popUI(){const m=$('#popMode');m.setAttribute('aria-pressed',String(POP.pressed));m.dataset.m=popModeName().toLowerCase();
  m.querySelectorAll('i').forEach(b=>b.classList.toggle('on',b.dataset.v===m.dataset.m));}
/* Pop Erase: flattens a manual pop (2D) or the template relief of an area (3D modes); tap again in 3D to restore */
function popErase(x,y){const r=labAt(x,y);if(!r||!S)return;if(ppEraseAt(r)){toast('Flattened');return;}
  if(!D3.on){const i=(S.pops||[]).findIndex(p=>(p.rs||[p.r]).includes(r));if(i<0){toast('Nothing raised here');return;}S.pops.splice(i,1);renderPops();dirty('pop');toast('Flattened');return;}
  const T=depthOf(S);if(!T)return;S.flat3d=S.flat3d||[];const fl=new Set(S.flat3d);
  if(!T.lv[r]){toast('Already flat');return;}
  const rs=POP.whole?objectOf(S,r):[r],back=rs.every(q=>fl.has(q));
  rs.forEach(q=>back?fl.delete(q):fl.add(q));S.flat3d=[...fl];fl.size?LS.set('flat3d.'+S.n,S.flat3d):LS.del('flat3d.'+S.n);
  S.relief=null;apply3D(true);toast(back?'3D restored':'Flattened · tap again to restore');}
let tilt={x:0,y:0};
function popParallax(){relParallax();if(!S||!S.popSh)return;const k=Math.min(4,1+Z.z*.3);S.popSh.style.transform=`translate(${(-tilt.x*k).toFixed(2)}px,${(-tilt.y*k).toFixed(2)}px)`;
  S.popLi.style.transform=`translate(${(tilt.x*.35).toFixed(2)}px,${(tilt.y*.35).toFixed(2)}px)`;}
stage.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!S||!((S.pops&&S.pops.length)||D3.on))return;D3.lastMove=performance.now();const r=stage.getBoundingClientRect();
  tilt={x:((e.clientX-r.left)/r.width-.5)*2.4,y:((e.clientY-r.top)/r.height-.5)*2.4};popParallax();});
let orientOn=false;
function enableTilt(){if(orientOn)return;const go=()=>{orientOn=true;window.addEventListener('deviceorientation',e=>{if(e.gamma==null)return;
    tilt={x:Math.max(-1,Math.min(1,e.gamma/30))*1.2,y:Math.max(-1,Math.min(1,(e.beta-40)/30))*1.2};D3.lastMove=performance.now();popParallax();});};
  try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')DeviceOrientationEvent.requestPermission().then(s=>s==='granted'&&go()).catch(()=>{});
    else if(window.DeviceOrientationEvent)go();}catch(e){}}
/* ---------- 3D modes: per-scene depth template (data/scene_NN_depth.js, from build_depth.py) ---------- */
const pad2=n=>String(n).padStart(2,'0');
function needDepth(n){return new Promise(res=>{if((window.EP_DEPTH||{})[n])return res(window.EP_DEPTH[n]);const c=CHM[n];if(!c||!c.data)return res(null);
  const sc=document.createElement('script');sc.src=c.data.replace(/\.js$/,'_depth.js');sc.onload=()=>res((window.EP_DEPTH||{})[n]||null);sc.onerror=()=>res(null);document.head.appendChild(sc);});}
const depthOf=st=>st&&(window.EP_DEPTH||{})[st.n]||null;
function objectOf(st,r){const T=depthOf(st),o=T.ob[r],l=T.lv[r],out=[];for(let q=1;q<st.N;q++)if(T.ob[q]===o&&T.lv[q]===l)out.push(q);return out;}
function cleanPops(st){const T=depthOf(st);if(!T||!st.pops||!st.pops.length)return;const n0=st.pops.length;
  st.pops=st.pops.map(p=>({...p,rs:(p.rs||[p.r]).filter(q=>T.lv[q]===2||(p.pressed&&T.lv[q]<0))})).filter(p=>p.rs.length);if(st.pops.length!==n0){renderPops(st);savePops(st);}}
const D3={on:false,want:!!settings.view3d,band:false,lastMove:0};
const allowed3D=n=>n===FREE_3D_SCENE||Effects3D.unlocked();
const FREE_3D_SCENE=4;
function modeLabels(){const a=D3.on;$$('.mode').forEach(b=>b.textContent=b.dataset.mode==='cbn'?(a?'3D by Number':'Color by Number'):(a?'3D Free Color':'Free Color'));
  const sw=$('#d3sw');if(sw){sw.classList.toggle('on',a);sw.setAttribute('aria-pressed',a);}}
function buildRelief(st){ // height field -> bevel light + shadow for every raised (mid/foreground) region; background stays flat
  const T=depthOf(st);if(!T)return null;const L=st.lab,N=W*H,lv=T.lv.slice(),ob=T.ob;
  for(const r of st.flat3d||[])lv[r]=0;   // areas flattened with Pop Erase
  const oh=new Float32Array(Math.max(...ob)+1),on=new Float32Array(oh.length);
  for(let r=1;r<st.N;r++)if(lv[r]>0){oh[ob[r]]+=T.h[r]*st.cnt[r];on[ob[r]]+=st.cnt[r];}
  for(let o=0;o<oh.length;o++)oh[o]=on[o]?oh[o]/on[o]/100:0;
  const dO=new Float32Array(N),dR=new Float32Array(N);
  for(let i=0;i<N;i++){const r=L[i];if(!lv[r]){dO[i]=0;dR[i]=0;continue;}const x=i%W,y=(i/W)|0,o=ob[r];
    if(lv[r]<0){dO[i]=0;const e=x===0||y===0||x===W-1||y===H-1||L[i-1]!==r||L[i+1]!==r||L[i-W]!==r||L[i+W]!==r;dR[i]=e?0:1e9;continue;}
    let edgeO=x===0||y===0||x===W-1||y===H-1,edgeR=edgeO;
    if(!edgeO){const a=L[i-1],b=L[i+1],c=L[i-W],d=L[i+W];edgeO=lv[a]<=0||lv[b]<=0||lv[c]<=0||lv[d]<=0||ob[a]!==o||ob[b]!==o||ob[c]!==o||ob[d]!==o;edgeR=a!==r||b!==r||c!==r||d!==r;}
    dO[i]=edgeO?0:1e9;dR[i]=edgeR?0:1e9;}
  chamfer(dO,W,H);chamfer(dR,W,H);
  const hf=new Float32Array(N),sm=t=>t>=1?1:t*t*(3-2*t);
  const ao=new Float32Array(N);
  for(let i=0;i<N;i++){const r=L[i];if(!lv[r])continue;
    if(lv[r]<0){const dz=T.h[r]/100,Di=9+12*-dz,t=sm(dR[i]/Di);hf[i]=dz*t;ao[i]=-dz*t;continue;}   // carved: walls fall away from the rim
    const hz=T.h[r]/100,DO=8+18*hz;hf[i]=hz*(.82*sm(dO[i]/DO)+.18*sm(dR[i]/4))*(lv[r]===2?1:.7);}
  for(const [x0,y0,x1,y1,rad,dh,rs] of T.bump||[]){const ok=new Set(rs.filter(q=>lv[q]>0)),vx=x1-x0,vy=y1-y0,L2=vx*vx+vy*vy||1;   // thumb ridges: rounded dome along the thumb
    for(let y=Math.max(0,Math.min(y0,y1)-rad|0);y<Math.min(H,Math.max(y0,y1)+rad+1);y++)for(let x=Math.max(0,Math.min(x0,x1)-rad|0);x<Math.min(W,Math.max(x0,x1)+rad+1);x++){
      const i=y*W+x;if(!ok.has(L[i]))continue;const t=Math.max(0,Math.min(1,((x-x0)*vx+(y-y0)*vy)/L2)),d=Math.hypot(x-x0-vx*t,y-y0-vy*t)/rad;
      if(d<1)hf[i]+=dh/100*Math.sqrt(1-d*d)*sm(Math.min(1,dO[i]/10));}}
  const li=mk(),lx=li.getContext('2d'),im=lx.createImageData(W,H),P=im.data;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,r=L[i];if(!lv[r])continue;
    const gx=(hf[i+1]-hf[i-1])*.5,gy=(hf[i+W]-hf[i-W])*.5,j=i*4;
    const v=lv[r]<0?(gx+gy)*.7071*22-ao[i]*.9:(gx+gy)*.7071*16+(.5-(x/W+y/H)/2)*.12*oh[ob[r]]+hf[i]*.10;  // light from the top-left; insets: shadowed top-left wall, lit bottom-right rim, darker toward the middle
    if(v>0){P[j]=255;P[j+1]=250;P[j+2]=238;P[j+3]=Math.min(150,v*230);}else{P[j]=44;P[j+1]=27;P[j+2]=12;P[j+3]=Math.min(160,-v*230);}}
  lx.putImageData(im,0,0);
  const sh=mk(),sx=sh.getContext('2d');
  const maskOf=f=>{const c=mk(),x=c.getContext('2d'),m=x.createImageData(W,H);for(let i=0;i<N;i++)if(f(lv[L[i]]))m.data[i*4+3]=255;x.putImageData(m,0,0);return c;};
  const mF=maskOf(l=>l===2),mA=maskOf(l=>l>0);
  const cast=(m,off,blur,a)=>{sx.save();sx.shadowColor=`rgba(38,22,8,${a})`;sx.shadowBlur=blur;sx.shadowOffsetX=off*.6+W*2;sx.shadowOffsetY=off;sx.drawImage(m,-W*2,0);sx.restore();};
  cast(mA,7,10,.30);sx.globalCompositeOperation='destination-out';sx.drawImage(mA,0,0);sx.globalCompositeOperation='source-over';
  // foreground also shades the midground it stands over
  const s2=mk(),s2x=s2.getContext('2d');s2x.shadowColor='rgba(38,22,8,.22)';s2x.shadowBlur=8;s2x.shadowOffsetX=5+W*2;s2x.shadowOffsetY=8;s2x.drawImage(mF,-W*2,0);
  s2x.shadowColor='transparent';s2x.globalCompositeOperation='destination-in';s2x.drawImage(maskOf(l=>l===1),0,0);sx.drawImage(s2,0,0);
  const mI=maskOf(l=>l<0);
  li.className='rel-li';sh.className='rel-sh';return {li,sh,mF,mA,mI,hf};}
function apply3D(quiet){if(!S)return;scheduleLineTint();const want=D3.want&&!!depthOf(S);
  if(want&&!allowed3D(S.n)){D3.on=false;if(!quiet)openUpgrade(null,'effects3d');else if(D3.want)toast('3D for this chapter is part of 3D Effects · Chapter 4 is free in 3D');}
  else D3.on=want;
  $$('.rel-sh,.rel-li').forEach(c=>c.remove());
  app.classList.toggle('d3',D3.on);
  if(D3.on){if(!S.relief)S.relief=buildRelief(S);const f=S.free.c.nextSibling;layers.insertBefore(S.relief.sh,S.pulse?S.pulse.c.nextSibling:f);layers.insertBefore(S.relief.li,S.relief.sh.nextSibling);
    if(tool==='pop')setTool('pencil');if(S.popSh){S.popSh.style.display='none';S.popLi.style.display='none';}}
  else if(S.popSh){S.popSh.style.display='';S.popLi.style.display='';}
  if(!D3.on&&D3.band)bandView(false);
  modeLabels();popParallax();sway();}
function set3D(v){D3.want=v;settings.view3d=v;LS.set('settings',settings);if(v)enableTilt();
  if(v&&S&&!allowed3D(S.n)){D3.want=false;settings.view3d=false;LS.set('settings',settings);openUpgrade(null,'effects3d');modeLabels();return;}
  if(!S)return;needDepth(S.n).then(()=>{apply3D(false);toast(D3.on?(mode==='cbn'?'3D by Number':'3D Free Color')+' · color right onto the relief':(mode==='cbn'?'Color by Number':'Free Color'));});}
function relParallax(){if(!S||!S.relief||!D3.on)return;const k=Math.min(4,1+Z.z*.3);
  S.relief.sh.style.transform=`translate(${(-tilt.x*k*1.2).toFixed(2)}px,${(-tilt.y*k*1.2).toFixed(2)}px)`;
  S.relief.li.style.transform=`translate(${(tilt.x*.4).toFixed(2)}px,${(tilt.y*.4).toFixed(2)}px)`;
  if(D3.band)bandParallax();}
let swayRaf=0;function sway(){if(swayRaf||!D3.on||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const step=t=>{if(!D3.on){swayRaf=0;return;}if(performance.now()-D3.lastMove>2500){tilt={x:Math.sin(t/2600)*.9,y:Math.cos(t/3400)*.5};popParallax();}swayRaf=requestAnimationFrame(step);};swayRaf=requestAnimationFrame(step);}
/* optional parallax view: the finished picture split into depth bands that slide apart as you tilt / move */
function bandView(on){D3.band=on;const v=$('#bandv');$('#bandBtn')&&$('#bandBtn').classList.toggle('on',on);
  if(!on){v.hidden=true;v.innerHTML='';return;}
  const base=composite(),T=depthOf(S);v.innerHTML='';
  const band=l=>{const c=mk(),x=c.getContext('2d');x.drawImage(base,0,0);x.globalCompositeOperation='destination-in';x.drawImage(l===2?S.relief.mF:S.relief.mA,0,0);if(l===1){x.globalCompositeOperation='destination-out';x.drawImage(S.relief.mF,0,0);}return c;};
  const bi=mk(),bx=bi.getContext('2d');bx.drawImage(base,0,0);bx.globalCompositeOperation='destination-in';bx.drawImage(S.relief.mI,0,0);
  [base,bi,band(1),band(2)].forEach((c,i)=>{c.className='band b'+['0','i','1','2'][i];v.appendChild(c);});v.hidden=false;bandParallax();}
function bandParallax(){const k=[3,-7,9,18];   /* background least, raised most; insets slide the opposite way */$$('#bandv .band').forEach((c,i)=>{c.style.transform=`translate(${(tilt.x*k[i]).toFixed(1)}px,${(tilt.y*k[i]).toFixed(1)}px)${i?'':' scale(1.03)'}`;});}
/* ---------- living effects: jewel shimmer, glow breathing, pulse, glitter twinkle, drifting smoke, billowing clouds ----------
   Every animated ink keeps a mask of where it was applied (per effect + colour). One overlay canvas redraws those masks
   ~30 times a second: light sheens, halos and capped particle systems, clipped to the painted area. Stops when the tab is
   hidden; with prefers-reduced-motion it draws one still frame. */
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const GEMS=new Set(['g-emerald','g-sapphire','g-amethyst','g-rose']);
const FXCAP={smoke:70,cloud:12,twinkle:70,total:230};
function fxKindsOf(k){ // ink -> list of live effects
  if(!k)return [];if(k.kind==='mix'){const m=k.mix||{},o=[];if(m.finish==='jewel')o.push('shimmer');
    if(m.anim==='pulse')o.push('pulsefx');if(m.anim==='glow')o.push('glowfx');if(m.anim==='shimmer')o.push('shimmer');
    if(m.finish==='chrome')o.push('mirror');if(m.finish==='metal')o.push('shine');if(m.finish==='jewel')o.push('jshine');if(m.finish==='neon')o.push('neonfx');if(m.part==='glitter')o.push('twinkle');if(m.part==='smoke')o.push('smoke');if(m.part==='cloud')o.push('cloud');return [...new Set(o)];}
  if(k.kind==='jewel')return ['shimmer','jshine'];if(k.fx==='shimmer'||GEMS.has(k.id))return ['shimmer'];if(k.kind==='metal')return ['shine'];
  if(k.kind==='chrome')return ['mirror'];if(k.kind==='pulse')return ['pulsefx'];if(k.kind==='neon')return ['neonfx'];
  if(k.kind==='glow')return ['glowfx'];if(k.kind==='smoke')return ['smoke'];if(k.kind==='cloud')return ['cloud'];if(k.kind==='glitter')return ['twinkle'];
  return [];}
const sprite=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return c;})();
const GLINT=(()=>{const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d'),g=x.createRadialGradient(24,24,0,24,24,9);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,252,235,.55)');g.addColorStop(1,'rgba(255,250,230,0)');x.fillStyle=g;x.fillRect(0,0,48,48);
  x.fillStyle='#fff';x.beginPath();x.moveTo(24,0);x.lineTo(25.4,22.6);x.lineTo(48,24);x.lineTo(25.4,25.4);x.lineTo(24,48);x.lineTo(22.6,25.4);x.lineTo(0,24);x.lineTo(22.6,22.6);x.closePath();x.fill();return c;})();
const tintCache={};function tinted(hex,a=1){const k=hex+a;if(tintCache[k])return tintCache[k];const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.drawImage(sprite,0,0);x.globalCompositeOperation='source-in';x.fillStyle=hex;x.globalAlpha=a;x.fillRect(0,0,64,64);return tintCache[k]=c;}
function fxLayer(){if(!S.fxC){const c=mk();c.className='fx-layer';S.fxC=c;}return S.fxC;}
function fxRec(kind,hex){S.fx=S.fx||[];let r=S.fx.find(q=>q.kind===kind&&q.hex===hex);
  if(!r){const m=mk();r={kind,hex,mask:m,mx:m.getContext('2d',{willReadFrequently:true}),bb:null,pts:[],parts:[],dirty:true};S.fx.push(r);}return r;}
function fxAdd(kinds,hex,src,sx=0,sy=0){if(!kinds.length||!S)return;const u={n:S.free.undo.length,m:[]};
  for(const k of kinds){const r=fxRec(k,hex),c=mk();c.getContext('2d').drawImage(r.mask,0,0);u.m.push([r,c]);r.mx.drawImage(src,sx,sy);r.dirty=true;r.boost=performance.now()/1000;}
  S.fxUndo=(S.fxUndo||[]).concat([u]).slice(-5);
  fxAttach();fxStart();dirty('fx');}
function fxScan(r){ // bbox + sample points of a mask (for particles and sheen extents)
  const d=r.mx.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;const pts=[];
  for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){if(d[(y*W+x)*4+3]>60){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;pts.push(x,y);}}
  r.bb=x1<0?null:[x0,y0,x1-x0+1,y1-y0+1];const n=pts.length/2,keep=[];for(let i=0;i<Math.min(n,500);i++){const j=(Math.random()*n)|0;keep.push([pts[j*2],pts[j*2+1]]);}
  r.pts=keep;r.dirty=false;r.loose=null;r.tint=null;r.nm=null;r.cf=null;r.shade=null;r.td=null;r.dq=null;if(!r.bb)r.parts=[];}
function fxLoose(r,blur,n=2){ // soft, spread mask so wisps / puffs can hover just around the colour
  const c=mk(),x=c.getContext('2d');x.filter=`blur(${blur}px)`;for(let i=0;i<n;i++)x.drawImage(r.mask,0,0);x.filter='none';return c;}
function fxShade(r){if(r.shade)return r.shade;const c=mk(),x=c.getContext('2d');x.drawImage(r.mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle='rgba(20,10,30,1)';x.fillRect(0,0,W,H);return r.shade=c;}
function fxTint(r){if(r.tint)return r.tint;const c=mk(),x=c.getContext('2d');x.drawImage(r.mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=r.hex;x.fillRect(0,0,W,H);return r.tint=c;}
function fxClip(){ // after erase / undo / clear: keep effects only where colour remains
  if(!S||!S.fx||!S.fx.length)return;const d=S.free.ctx.getImageData(0,0,W,H),pd=S.pulse?S.pulse.ctx.getImageData(0,0,W,H).data:null,m=new ImageData(W,H);for(let i=3;i<d.data.length;i+=4)if(d.data[i]>8||(pd&&pd[i]>8))m.data[i]=255;
  const c=mk();c.getContext('2d').putImageData(m,0,0);
  for(const r of S.fx){r.mx.save();r.mx.globalCompositeOperation='destination-in';r.mx.drawImage(c,0,0);r.mx.restore();r.dirty=true;}
  S.fx.forEach(r=>{if(r.dirty)fxScan(r);});S.fx=S.fx.filter(r=>r.bb);dirty('fx');fxDraw(performance.now());}
function fxAttach(){if(!S)return;const c=fxLayer();if(!c.isConnected)layers.appendChild(c);c.style.display=mode==='free'?'':'none';}
const scratch=mk(),scx=scratch.getContext('2d');
function star(x,cx,cy,R,a){x.globalAlpha=a;x.beginPath();for(let i=0;i<8;i++){const rr=i%2?R*.22:R,an=i*Math.PI/4;x.lineTo(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr);}x.closePath();x.fill();}
function fxDrawRec(x,r,t){ // t in seconds
  if(r.dirty)fxScan(r);if(!r.bb)return;const [bx,by,bw,bh]=r.bb,s=.5+.5*Math.sin(t*2*Math.PI/3.2);
  if(r.kind==='shimmer'){ // sheen band sweeping diagonally + soft glow pulse + a few glints
    x.save();x.globalAlpha=.16+.16*s;x.shadowColor=r.hex;x.shadowBlur=16+10*s;x.drawImage(fxTint(r),0,0);x.restore();
    scx.clearRect(bx-2,by-2,bw+4,bh+4);const L=bw+bh,p=((t/3.4)%1)*1.6-.3,g=scx.createLinearGradient(bx,by,bx+L*.7,by+L*.7);
    const c0=Math.max(0,Math.min(1,p-.12)),c1=Math.max(0,Math.min(1,p)),c2=Math.max(0,Math.min(1,p+.12));
    g.addColorStop(0,'rgba(255,255,255,0)');if(c0>0)g.addColorStop(c0,'rgba(255,255,255,0)');g.addColorStop(c1,'rgba(255,255,255,.62)');if(c2<1)g.addColorStop(c2,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,0)');
    scx.globalCompositeOperation='source-over';scx.fillStyle=g;scx.fillRect(bx,by,bw,bh);scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
    x.save();x.globalCompositeOperation='lighter';x.globalAlpha=.8;x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();
    x.save();x.fillStyle='#fff';for(let i=0;i<Math.min(6,r.pts.length);i++){const q=r.pts[(i*37)%r.pts.length],a=Math.max(0,Math.sin(t*1.7+i*2.1));if(a>.05)star(x,q[0],q[1],3+5*a,.85*a);}x.restore();return;}
  if(r.kind==='mirror'){drawMirror(x,r,t);return;}if(r.kind==='shine'){drawShine(x,r,t,'metal');return;}if(r.kind==='jshine'){drawShine(x,r,t,'jewel');return;}
  if(r.kind==='rampfx'){ // colour shift: the gradient flows through the stroke (ping-pong), ~12 fps is plenty for this slow drift
    if(!r.td){r.td=r.mx.getImageData(bx,by,bw,bh).data;r.out=new ImageData(bw,bh);r.oc=Object.assign(document.createElement('canvas'),{width:bw,height:bh});r.ft=-1;}
    if(r.ft<0||Math.abs(t-r.ft)>=.08){r.ft=t;const L=rampLUT(r.hex),wv=WAVES[RAMP_WAVE[r.hex]||'sine'],ph=RM.matches?0:(RAMP_WAVE[r.hex]==='sawtooth'?t/9:.5+.5*wv(t,.35)),td=r.td,o=r.out.data;
      for(let i=0;i<td.length;i+=4){const a=td[i+3];if(!a){o[i+3]=0;continue;}const v=td[i]/255+ph,q=v-Math.floor(v),k=Math.round((q<.5?q*2:2-q*2)*255)*3;o[i]=L[k];o[i+1]=L[k+1];o[i+2]=L[k+2];o[i+3]=a;}
      r.oc.getContext('2d').putImageData(r.out,0,0);}
    x.drawImage(r.oc,bx,by);return;}
  if(r.kind==='glowfx'){x.save();x.globalCompositeOperation='lighter';x.globalAlpha=.10+.22*s;x.shadowColor=r.hex;x.shadowBlur=22+18*s;x.drawImage(fxTint(r),0,0);x.restore();return;}
  if(r.kind==='pulsefx'||r.kind==='glowfx')drawPulseBands(x,r,t,r.kind==='pulsefx'?{sp:.55,n:2,dir:'forward',a:.85}:{sp:.3,n:1,dir:'bounce',a:.5});
  if(r.kind==='pulsefx'){ // the colour itself breathes: dims on the out-breath, brightens + glows on the in-breath
    const b=.5+.5*Math.sin(t*2*Math.PI/2.4);x.save();
    if(b<.5){x.globalAlpha=(.5-b)*.7;x.drawImage(fxShade(r),0,0);}
    x.globalCompositeOperation='lighter';x.globalAlpha=.06+.5*b*b;x.shadowColor=r.hex;x.shadowBlur=4+16*b;x.drawImage(fxTint(r),0,0);x.restore();return;}
  if(r.kind==='neonfx'){ // neon hum: a steady glow with a soft flicker now and then
    const f=hash2((t*14)|0,7)<.06?.35:1,b=(.75+.25*Math.sin(t*5.3))*f;x.save();x.globalCompositeOperation='lighter';x.globalAlpha=.14+.3*b;x.shadowColor=r.hex;x.shadowBlur=10+14*b;x.drawImage(fxTint(r),0,0);x.restore();return;}
  if(r.kind==='twinkle'){ // glitter: tiny 4-point glints that flash white at random times, drift a little and fade; a few catch the light brighter
    const boost=RM.matches?0:Math.max(0,1-(t-(r.boost||0))/1.4);   // sparkle boost: a burst of glints right after new glitter goes down
    const cap=Math.min(FXCAP.twinkle*(1+boost),Math.max(6,Math.round(bw*bh/2600))*(1+1.5*boost),r.pts.length*2),dt=Math.min(.1,Math.max(0,t-(r.lt||t)));r.lt=t;
    const born=()=>{const q=r.pts[(Math.random()*r.pts.length)|0],hot=Math.random()<.18+.4*boost;return {x:q[0]+(Math.random()-.5)*3,y:q[1]+(Math.random()-.5)*3,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4-1,
      age:-Math.random()*1.6,life:.35+Math.random()*.75,sz:hot?5+Math.random()*4:1.6+Math.random()*2.4,pk:hot?1:.45+Math.random()*.4,rot:Math.random()*.6};};
    while(r.parts.length<cap&&r.pts.length)r.parts.push(born());
    x.save();x.globalCompositeOperation='lighter';
    for(let i=0;i<r.parts.length;i++){const p=r.parts[i];p.age+=RM.matches?0:dt;if(RM.matches&&p.age<0)p.age=p.life*.2;if(p.age>p.life){r.parts[i]=born();continue;}if(p.age<0)continue;
      const u=p.age/p.life,a=(u<.18?u/.18:Math.pow(1-(u-.18)/.82,2))*p.pk;p.x+=p.vx*dt;p.y+=p.vy*dt;
      const R2=p.sz*(.55+.45*a);x.globalAlpha=a;x.drawImage(GLINT,p.x-R2*2,p.y-R2*2,R2*4,R2*4);}
    x.restore();return;}
  if(r.kind==='smoke'){drawSmoke(x,r,t);return;}if(r.kind==='cloud'){drawCloud(x,r,t);return;}
  // particles: cloud puffs bob and billow in place
  const cap=r.kind==='smoke'?FXCAP.smoke:FXCAP.cloud,big=Math.max(18,Math.min(90,Math.sqrt(bw*bh)/(r.kind==='cloud'?3.2:5)));
  while(r.parts.length<cap&&r.pts.length&&fxTotal<FXCAP.total){const q=r.pts[(Math.random()*r.pts.length)|0];fxTotal++;
    r.parts.push(r.kind==='smoke'?{x:q[0],y:q[1],a:Math.random()*6.28,age:Math.random()*6,life:4+Math.random()*4,sz:big*(.5+Math.random()*.7)}
      :{x:q[0],y:q[1],ph:Math.random()*6.28,sp:.5+Math.random()*.5,sz:big*(.7+Math.random()*.6)});}
  if(!r.loose)r.loose=fxLoose(r,r.kind==='smoke'?14:5);
  const ex=r.kind==='smoke'?40:12,X0=Math.max(0,bx-ex),Y0=Math.max(0,by-ex),X1=Math.min(W,bx+bw+ex),Y1=Math.min(H,by+bh+ex);
  scx.clearRect(X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  const spr=puffSprite(mixHex(r.hex,.35)),hi=puffSprite('#ffffff'),dt=Math.min(.1,Math.max(0,t-(r.lt||t)));r.lt=t;
  for(const p of r.parts){
    if(r.kind==='smoke'){p.age+=dt;if(p.age>p.life){const q=r.pts[(Math.random()*r.pts.length)|0];if(q){p.x=q[0];p.y=q[1];}p.age=0;p.a=Math.random()*6.28;}
      const u=p.age/p.life;p.a+=dt*(.6+.5*Math.sin(t*.7+p.y*.01));p.x+=Math.cos(p.a)*dt*9;p.y+=(Math.sin(p.a)*5-7)*dt;
      const sz=p.sz*(.6+u*1.1);scx.globalAlpha=.34*Math.sin(Math.PI*u);scx.drawImage(spr,p.x-sz,p.y-sz,sz*2,sz*2);}
    else{const bob=Math.sin(t*p.sp+p.ph),sz=p.sz*(1+.07*bob),dx=Math.cos(t*p.sp*.6+p.ph)*4,dy=bob*3;
      scx.globalAlpha=1;scx.drawImage(spr,p.x+dx-sz,p.y+dy-sz,sz*2,sz*2);scx.globalAlpha=.7;scx.drawImage(hi,p.x+dx-sz*.75,p.y+dy-sz*.95,sz*1.3,sz*1.3);}}
  scx.globalAlpha=1;scx.globalCompositeOperation='destination-in';scx.drawImage(r.loose,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  x.drawImage(scratch,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);}
/* chrome = a real mirror: a blurred, stretched low-res environment map of the picture itself is reflected through the
   surface normals (dome from the painted shape + Pop Pencil height + the 3D template relief). The light / view angle
   follows device tilt, the pointer on desktop, or turns slowly by itself; reflection and highlight streaks slide with it. */
const LIGHT={x:-.4,y:-.5,t:0,src:'auto'};
window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;LIGHT.x=(e.clientX/innerWidth-.5)*2;LIGHT.y=(e.clientY/innerHeight-.5)*2;LIGHT.t=performance.now();LIGHT.src='pointer';},{passive:true});
window.addEventListener('deviceorientation',e=>{if(e.gamma==null)return;LIGHT.x=Math.max(-1,Math.min(1,e.gamma/35));LIGHT.y=Math.max(-1,Math.min(1,(e.beta-40)/35));LIGHT.t=performance.now();LIGHT.src='tilt';});
function lightAt(t){if(RM.matches)return [-.4,-.5];if(performance.now()-LIGHT.t<2500)return [LIGHT.x,LIGHT.y];return [Math.cos(t*.45)*.75,Math.sin(t*.45)*.55];}
const MQ=4,WQ=W/MQ|0,HQ=H/MQ|0,EW=96,EH=54;
function envMap(){const now=performance.now();if(S.env&&(!S.envDirty||now-S.envT<450))return S.env;S.envDirty=false;S.envT=now;
  const c=S.envC||(S.envC=Object.assign(document.createElement('canvas'),{width:EW,height:EH})),x=c.getContext('2d',{willReadFrequently:true});
  const g=x.createLinearGradient(0,0,0,EH);g.addColorStop(0,'#e9eef7');g.addColorStop(.48,'#fffaf0');g.addColorStop(.52,'#6d6258');g.addColorStop(1,'#cfc3b0');x.fillStyle=g;x.fillRect(0,0,EW,EH);
  x.filter='blur(3px)';x.drawImage(S.free.c,0,0,EW,EH);if(S.pulse)x.drawImage(S.pulse.c,0,0,EW,EH);x.filter='none';
  return S.env=x.getImageData(0,0,EW,EH).data;}
function mirrorNormals(r){ // quarter-res height -> normals, rebuilt when the mask, Pop Pencil or 3D relief changes
  const key=(r.bb||[]).join()+'|'+(S.pp&&S.pp.any?S.ppV||0:0)+'|'+(D3.on&&S.relief?1:0);if(r.nm&&r.nmKey===key)return r.nm;r.nmKey=key;
  const c=document.createElement('canvas');c.width=WQ;c.height=HQ;const x=c.getContext('2d',{willReadFrequently:true});x.filter='blur(5px)';x.drawImage(r.mask,0,0,WQ,HQ);x.filter='none';
  const m=x.getImageData(0,0,WQ,HQ).data,h=new Float32Array(WQ*HQ);for(let i=0;i<h.length;i++)h[i]=m[i*4+3]/255*1.4;
  const addH=(src,k)=>{x.clearRect(0,0,WQ,HQ);x.drawImage(src,0,0,WQ,HQ);const d=x.getImageData(0,0,WQ,HQ).data;for(let i=0;i<h.length;i++)h[i]+=d[i*4+3]/255*k;};
  if(S.pp&&S.pp.any){addH(S.pp.r,2.2);addH(S.pp.i,-2.2);}
  if(D3.on&&S.relief&&S.relief.hf){const f=S.relief.hf;for(let y=0;y<HQ;y++)for(let X=0;X<WQ;X++)h[y*WQ+X]+=f[(y*MQ)*W+X*MQ]*3;}
  const nx=new Float32Array(h.length),ny=new Float32Array(h.length),mk2=new Uint8Array(h.length);x.clearRect(0,0,WQ,HQ);x.drawImage(r.mask,0,0,WQ,HQ);const mm=x.getImageData(0,0,WQ,HQ).data;
  for(let y=1;y<HQ-1;y++)for(let X=1;X<WQ-1;X++){const i=y*WQ+X;if(mm[i*4+3]<20)continue;mk2[i]=1;nx[i]=(h[i-1]-h[i+1])*2.2;ny[i]=(h[i-WQ]-h[i+WQ])*2.2;}
  return r.nm={nx,ny,m:mk2};}
/* ---------- polished shine for chrome / metallic / jewel: one fixed key light (top-left, same as the 3D outline tint).
   Surface shape comes from each coloured area's own contours: a distance field from the region's line boundaries
   (plus Pop Pencil / 3D heights) gives a bevel; its normals drive a sharp specular rim on lit edges, dark reflection
   bands in the middle, contour-hugging streaks, a glint that sweeps across every few seconds, a fine sparkle shimmer
   and a soft bloom around the hottest highlights. Pointer / tilt only nudges the light a little. ---------- */
const KEY=(()=>{const v=[-.62,-.68,.9],l=Math.hypot(...v);return v.map(a=>a/l);})();
function contourField(r){
  const key=(r.bb||[]).join()+'|'+(S.pp&&S.pp.any?S.ppV||0:0)+'|'+(D3.on&&S.relief?1:0)+'|'+((S.pops||[]).length);if(r.cf&&r.cfKey===key)return r.cf;r.cfKey=key;
  const [bx,by,bw,bh]=r.bb,X0=Math.max(1,(bx/MQ|0)-1),Y0=Math.max(1,(by/MQ|0)-1),X1=Math.min(WQ-1,((bx+bw)/MQ|0)+2),Y1=Math.min(HQ-1,((by+bh)/MQ|0)+2),w=X1-X0,h=Y1-Y0;
  const c=document.createElement('canvas');c.width=WQ;c.height=HQ;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(r.mask,0,0,WQ,HQ);
  const mm=x.getImageData(0,0,WQ,HQ).data,L=S.lab,m=new Uint8Array(w*h),d=new Float32Array(w*h),BIG=1e6;
  const labQ=(X,y)=>L[Math.min(H-1,y*MQ+2)*W+Math.min(W-1,X*MQ+2)];
  for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X,gx=X+X0,gy=y+Y0;if(mm[(gy*WQ+gx)*4+3]<60){d[i]=0;continue;}m[i]=1;
    const l=labQ(gx,gy);d[i]=(labQ(gx-1,gy)!==l||labQ(gx+1,gy)!==l||labQ(gx,gy-1)!==l||labQ(gx,gy+1)!==l)?0:BIG;}   // region line boundaries count as edges
  const s2=1.4142;for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X;if(!d[i])continue;let v=d[i];
    if(X>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(X>0)v=Math.min(v,d[i-w-1]+s2);if(X<w-1)v=Math.min(v,d[i-w+1]+s2);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let X=w-1;X>=0;X--){const i=y*w+X;if(!d[i])continue;let v=d[i];
    if(X<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(X<w-1)v=Math.min(v,d[i+w+1]+s2);if(X>0)v=Math.min(v,d[i+w-1]+s2);}d[i]=v;}
  const B=5.5,hf=new Float32Array(w*h);   // bevel: rounded over ~22 px from every contour, flat-topped inside
  for(let i=0;i<w*h;i++){if(!m[i])continue;const u=Math.min(1,d[i]/B);hf[i]=B*(1-(1-u)*(1-u))*1.15+Math.min(d[i],18)*.08;}
  const addH=(src,k)=>{x.clearRect(0,0,WQ,HQ);x.drawImage(src,0,0,WQ,HQ);const q=x.getImageData(0,0,WQ,HQ).data;for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X;if(m[i])hf[i]+=q[((y+Y0)*WQ+X+X0)*4+3]/255*k;}};
  if(S.pp&&S.pp.any){addH(S.pp.r,7);addH(S.pp.i,-7);}
  if(S.popSh&&(S.pops||[]).length){const P=S.pops;for(const p of P){const inS=new Set(p.rs||[p.r]);for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X;if(m[i]&&inS.has(labQ(X+X0,y+Y0)))hf[i]+=(p.pressed?-1:1)*Math.min(d[i],6)*.9;}}}
  if(D3.on&&S.relief&&S.relief.hf){const f=S.relief.hf;for(let y=0;y<h;y++)for(let X=0;X<w;X++){const i=y*w+X;if(m[i])hf[i]+=f[((y+Y0)*MQ)*W+(X+X0)*MQ]*10;}}
  for(let pass=0;pass<2;pass++){const t2=hf.slice();for(let y=1;y<h-1;y++)for(let X=1;X<w-1;X++){const i=y*w+X;if(!m[i])continue;let s=0,n=0;for(const k of [i,i-1,i+1,i-w,i+w]){if(m[k]){s+=t2[k];n++;}}hf[i]=s/n;}}
  const nx=new Float32Array(w*h),ny=new Float32Array(w*h),nz=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let X=1;X<w-1;X++){const i=y*w+X;if(!m[i])continue;const gx=(hf[i+1]-hf[i-1])*.5,gy=(hf[i+w]-hf[i-w])*.5,a=-gx*1.25,b=-gy*1.25,l=Math.hypot(a,b,1);nx[i]=a/l;ny[i]=b/l;nz[i]=1/l;}
  // every pixel's position along the diagonal (for the sweeping glint), normalised to this area
  return r.cf={X0,Y0,w,h,m,d,nx,ny,nz};}
function shineStatic(r,style,lq){ // the still part (reflection colour, specular rim, contour streaks, bloom, glint mask), rebuilt only when the shape or light changes
  const F=contourField(r),{X0,Y0,w,h,m,d,nx,ny,nz}=F,key=lq.join()+style;if(r.ss&&r.ss.key===key&&r.ss.F===F)return r.ss;
  const Lx0=KEY[0]+lq[0],Ly0=KEY[1]+lq[1],Ll=Math.hypot(Lx0,Ly0,KEY[2]),Lx=Lx0/Ll,Ly=Ly0/Ll,Lz=KEY[2]/Ll;
  const rgb=hex2rgb(r.hex),env=style==='chrome'?envMap():null,add=style==='jewel',metal=style==='metal',tint=metal?mix(rgb,[255,236,190],.12):rgb;
  const q=new ImageData(w,h),D=q.data,g=new ImageData(w,h),G=g.data,bq=new ImageData(w,h),BD=bq.data,pts=[];
  for(let y=1;y<h-1;y++)for(let X=1;X<w-1;X++){const i=y*w+X;if(!m[i])continue;
    const a=nx[i],b=ny[i],c=nz[i],ndl=a*Lx+b*Ly+c*Lz,Rx=2*c*a,Ry=2*c*b,Rz=2*c*c-1,rdl=Math.max(0,Rx*Lx+Ry*Ly+Rz*Lz),di=d[i],rim=Math.max(0,1-di/5.5);
    const spec=Math.pow(rdl,metal?22:44)*(metal?1.05:1.4),streak=di<14?Math.pow(Math.max(0,Math.cos(di*.62-1.1)),22)*Math.max(0,ndl)*.75:0,hot=Math.min(2,spec+streak),j=i*4;
    if(add){D[j]=D[j+1]=D[j+2]=255;D[j+3]=Math.min(255,hot*200);}
    else{let o;if(!metal){const tt=.5-Ry*.55+Rx*.08+.085*Math.sin(di*.3+.6),cc=chromeAt(tint,tt);
        if(env){const e=((Math.max(0,Math.min(EH-1,(.5+Ry*.5)*EH|0)))*EW+Math.max(0,Math.min(EW-1,((X+X0)/WQ-Rx*.5)*EW|0)))*4;o=[cc[0]*.66+env[e]*.34,cc[1]*.66+env[e+1]*.34,cc[2]*.66+env[e+2]*.34];}else o=cc;}
      else o=metalAt(tint,Math.max(0,Math.min(1,.36+ndl*.42+.16*Math.cos(di*.4)-(Ry>0?Ry*.25:0))));
      const k=255*hot;D[j]=Math.min(255,o[0]+k);D[j+1]=Math.min(255,o[1]+k);D[j+2]=Math.min(255,o[2]+k*.96);D[j+3]=metal?225:245;}
    const gm=Math.min(1,.5+1.3*rim+1.1*spec);G[j]=255;G[j+1]=add?Math.round(mix(rgb,WHITE,.7)[1]):250;G[j+2]=add?Math.round(mix(rgb,WHITE,.7)[2]):236;G[j+3]=gm*255;
    if(hot>.5){const bl=Math.min(1,(hot-.5)*1.2);BD[j]=255;BD[j+1]=246;BD[j+2]=228;BD[j+3]=255*bl;}
    if(spec>.8&&hash2(X+X0,y+Y0)<.06)pts.push([(X+X0)*MQ+2,(y+Y0)*MQ+2,hash2(y,X)]);}
  const cv=(im,pad)=>{const c=document.createElement('canvas');c.width=w+pad*2;c.height=h+pad*2;const x=c.getContext('2d');if(!pad){x.putImageData(im,0,0);return c;}
    const t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').putImageData(im,0,0);x.filter='blur(2.2px)';x.drawImage(t,pad,pad);x.filter='none';return c;};
  pts.sort((a,b)=>a[2]-b[2]);
  return r.ss={key,F,base:cv(q,0),glint:cv(g,0),bloom:cv(bq,4),pts:pts.slice(0,40),X0,Y0,w,h};}
function drawShine(x,r,t,style){if(!r.bb)return;const live=!RM.matches&&performance.now()-LIGHT.t<2500,plx=live?LIGHT.x:0,ply=live?LIGHT.y:0,lq=[Math.round(plx*4)/20,Math.round(ply*4)/20];   // pointer / tilt: a small, quantised nudge
  const now=performance.now();let ss=r.ss;if(!ss||!r.ssT||now-r.ssT>180||contourField(r)!==ss.F){ss=shineStatic(r,style,lq);r.ssT=now;}
  const {X0,Y0,w,h}=ss;if(w<=2||h<=2)return;const bx=X0*MQ,by=Y0*MQ,bw=w*MQ,bh=h*MQ,T=RM.matches?1.3:t,add=style==='jewel';
  // 1) polished surface
  scx.clearRect(bx,by,bw,bh);scx.globalCompositeOperation='source-over';scx.imageSmoothingEnabled=true;scx.drawImage(ss.base,bx,by,bw,bh);
  // 2) travelling glint: a bright diagonal band that sweeps across every ~3.6 s, strongest on the lit rims and highlights
  const per=3.6,u=((T%per)/per)*1.8-.4,gc=r.gc||(r.gc=document.createElement('canvas'));if(gc.width!==w||gc.height!==h){gc.width=w;gc.height=h;}
  const gx=gc.getContext('2d');gx.globalCompositeOperation='source-over';gx.clearRect(0,0,w,h);const L=w+h,p=u*L,gr=gx.createLinearGradient(p-L*.12,0,p+L*.12,0);
  gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');
  gx.save();gx.transform(1,0,1,1,0,0);gx.fillStyle=gr;gx.fillRect(-h,0,L+h,h);gx.restore();   // sheared: the band runs top-left -> bottom-right diagonal
  gx.globalCompositeOperation='destination-in';gx.drawImage(ss.glint,0,0);
  scx.globalCompositeOperation='lighter';scx.drawImage(gc,bx,by,bw,bh);scx.globalAlpha=.6;scx.drawImage(gc,bx,by,bw,bh);scx.globalAlpha=1;
  scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
  x.save();if(add)x.globalCompositeOperation='lighter';x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();
  // 3) bloom around the hottest highlights (breathes a little), plus the glint's own glow
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=(add?.45:.5)*(.85+.15*Math.sin(T*1.7));x.drawImage(ss.bloom,bx-16,by-16,(w+8)*MQ,(h+8)*MQ);
  const gb=r.gb||(r.gb=document.createElement('canvas'));if(gb.width!==w+8||gb.height!==h+8){gb.width=w+8;gb.height=h+8;}const gbx=gb.getContext('2d');gbx.clearRect(0,0,w+8,h+8);gbx.filter='blur(1.6px)';gbx.drawImage(gc,4,4);gbx.filter='none';
  x.globalAlpha=add?.35:.45;x.drawImage(gb,bx-16,by-16,(w+8)*MQ,(h+8)*MQ);
  // 4) specular shimmer: tiny star glints on the brightest spots, twinkling
  for(const [px,py,ph] of ss.pts){const a=Math.pow(Math.max(0,Math.sin(T*2.6+ph*40)),6);if(a<.05)continue;const R2=3+5*a;x.globalAlpha=a*.9;x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);}
  x.restore();}
function drawMirror(x,r,t){drawShine(x,r,t,'chrome');}
const PUFF={};function puffSprite(hex){if(PUFF[hex])return PUFF[hex];const [R0,G0,B0]=hex2rgb(hex),s=96,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');let sd=7;const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  for(let k=0;k<7;k++){const bx=s/2+(rnd()-.5)*s*.34,by=s/2+(rnd()-.5)*s*.34,br=s*(.17+rnd()*.2),g=x.createRadialGradient(bx,by,0,bx,by,br);
    g.addColorStop(0,`rgba(${R0},${G0},${B0},.34)`);g.addColorStop(.55,`rgba(${R0},${G0},${B0},.14)`);g.addColorStop(1,`rgba(${R0},${G0},${B0},0)`);x.fillStyle=g;x.beginPath();x.arc(bx,by,br,0,6.2832);x.fill();}return PUFF[hex]=c;}
/* smoke: layered, translucent wisps in rich colour with a soft glow edge; they curl on a swirling air field and hover
   around the painted area (a gentle pull keeps them near it). clouds: rounded, volumetric billows, light on top and
   shaded underneath, drifting slowly in place. Both are clipped loosely to a softened copy of the painted area. */
const WISP={};function wispSprite(hex){if(WISP[hex])return WISP[hex];const rgb=hex2rgb(hex),rich=rgb.map(v=>Math.min(255,v*1.05)),glow=mix(rgb,WHITE,.55),s=128,c=document.createElement('canvas');c.width=c.height=s;
  const x=c.getContext('2d');let sd=11;const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);const col=(a,cc)=>`rgba(${cc[0]|0},${cc[1]|0},${cc[2]|0},${a})`;
  for(let k=0;k<5;k++){const bx=s/2+(rnd()-.5)*s*.3,by=s/2+(rnd()-.5)*s*.22,br=s*(.2+rnd()*.14),g=x.createRadialGradient(bx,by,br*.7,bx,by,br*1.45);  // soft glow edge
    g.addColorStop(0,col(.16,glow));g.addColorStop(1,col(0,glow));x.fillStyle=g;x.fillRect(0,0,s,s);}
  for(let k=0;k<9;k++){const bx=s/2+(rnd()-.5)*s*.36,by=s/2+(rnd()-.5)*s*.26,br=s*(.1+rnd()*.16),g=x.createRadialGradient(bx,by,0,bx,by,br);   // denser coloured core
    g.addColorStop(0,col(.5,rich));g.addColorStop(.5,col(.26,rich));g.addColorStop(1,col(0,rich));x.fillStyle=g;x.beginPath();x.arc(bx,by,br,0,6.2832);x.fill();}
  return WISP[hex]=c;}
const BILLOW={};function cloudSprite(hex,seed=1){const k=hex+seed;if(BILLOW[k])return BILLOW[k];const rgb=hex2rgb(hex),s=160,c=document.createElement('canvas');c.width=s;c.height=s*.72|0;
  const H2=c.height,x=c.getContext('2d');let sd=seed*7919+3;const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const blobs=[[.5,.56,.26]];for(let i=0;i<6;i++)blobs.push([.2+rnd()*.6,.38+rnd()*.26,.12+rnd()*.12]);
  const shape=document.createElement('canvas');shape.width=s;shape.height=H2;const sx=shape.getContext('2d');sx.fillStyle='#000';
  for(const [u,v,rr] of blobs){sx.beginPath();sx.arc(u*s,v*H2,rr*s,0,6.2832);sx.fill();}sx.fillRect(s*.18,H2*.6,s*.64,H2*.2);
  x.filter='blur(2.5px)';x.drawImage(shape,0,0);x.filter='none';x.globalCompositeOperation='source-in';
  const g=x.createLinearGradient(0,H2*.12,0,H2*.95);g.addColorStop(0,`rgb(${mix(rgb,WHITE,.82).map(v=>v|0)})`);g.addColorStop(.5,`rgb(${mix(rgb,WHITE,.35).map(v=>v|0)})`);
  g.addColorStop(1,`rgb(${mix(rgb.map(v=>v*.62),[70,78,110],.28).map(v=>v|0)})`);x.fillStyle=g;x.fillRect(0,0,s,H2);
  x.globalCompositeOperation='source-atop';for(const [u,v,rr] of blobs){const hg=x.createRadialGradient(u*s-rr*s*.3,v*H2-rr*s*.45,0,u*s,v*H2,rr*s);   // light tops on every billow
    hg.addColorStop(0,'rgba(255,255,255,.55)');hg.addColorStop(.55,'rgba(255,255,255,.08)');hg.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=hg;x.fillRect(0,0,s,H2);}
  const sh=x.createLinearGradient(0,H2*.55,0,H2);sh.addColorStop(0,'rgba(30,34,70,0)');sh.addColorStop(1,'rgba(30,34,70,.34)');x.fillStyle=sh;x.fillRect(0,0,s,H2);   // shaded bottoms
  x.globalCompositeOperation='source-over';return BILLOW[k]=c;}
function drawSmoke(x,r,t){const [bx,by,bw,bh]=r.bb,dt=RM.matches?0:Math.min(.05,Math.max(0,t-(r.lt||t)));r.lt=t;
  const cap=Math.min(90,30+Math.round(Math.sqrt(bw*bh)/6)),s0=Math.max(30,Math.min(64,Math.sqrt(bw*bh)/6));r.acc=(r.acc||0)+dt*22;
  if(!r.parts.length)r.acc+=Math.min(cap,24);
  while(r.acc>=1&&r.pts.length){r.acc-=1;if(r.parts.length>=cap){r.acc=0;break;}const q=r.pts[(Math.random()*r.pts.length)|0];
    r.parts.push({x:q[0],y:q[1],sx:q[0],sy:q[1],vx:(Math.random()-.5)*14,vy:-(4+Math.random()*8),age:RM.matches?1.2:0,life:3+Math.random()*3.5,s0:s0*(.6+Math.random()*.7),rot:Math.random()*6.28,vr:(Math.random()-.5)*.9,seed:Math.random(),lay:Math.random()<.35?1:0});}
  if(!r.loose)r.loose=fxLoose(r,26,5);
  const ex=70,X0=Math.max(0,bx-ex),Y0=Math.max(0,by-ex),X1=Math.min(W,bx+bw+ex),Y1=Math.min(H,by+bh+ex);
  scx.clearRect(X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';const spr=wispSprite(r.hex),spr2=wispSprite(mixHex(r.hex,.3));
  for(let k=r.parts.length-1;k>=0;k--){const q=r.parts[k];q.age+=dt;if(q.age>=q.life){r.parts.splice(k,1);continue;}
    const fx=Math.sin(q.y*.02+t*.9+q.seed*6.3)+.6*Math.sin(q.y*.047-t*1.6+q.seed*11),fy=Math.cos(q.x*.018-t*.75+q.seed*4.1)+.5*Math.sin(q.x*.041+t*1.3);   // curling air
    q.vx+=(fx*40+(q.sx-q.x)*.35)*dt;q.vy+=(fy*26-5+(q.sy-q.y)*.25)*dt;q.vx*=1-.8*dt;q.vy*=1-.7*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.rot+=(q.vr+fx*.3)*dt;   // hover: a soft pull back to where it rose
    const u=q.age/q.life,a=Math.min(1,u/.15)*Math.pow(1-u,1.2)*(q.lay?.55:.8),sz=q.s0*(.8+u*1.9),ang=Math.atan2(q.vy,q.vx);
    scx.globalAlpha=a;scx.setTransform(1,0,0,1,q.x,q.y);scx.rotate(ang+q.rot*.3);scx.scale(1.45,.8);scx.drawImage(q.lay?spr2:spr,-sz,-sz,sz*2,sz*2);}
  scx.setTransform(1,0,0,1,0,0);scx.globalAlpha=1;
  scx.globalCompositeOperation='destination-in';scx.drawImage(r.loose,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  x.drawImage(scratch,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);}
const CLOUDSH=(()=>{let c=null;return ()=>{if(c)return c;c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(64,32,4,64,32,62);g.addColorStop(0,'rgba(40,40,70,1)');g.addColorStop(1,'rgba(40,40,70,0)');x.setTransform(1,0,0,.5,0,16);x.fillStyle=g;x.fillRect(0,0,128,128);return c;};})();
function drawCloud(x,r,t){const [bx,by,bw,bh]=r.bb,cap=Math.max(6,Math.min(26,Math.round(Math.sqrt(bw*bh)/22))),big=Math.max(26,Math.min(120,Math.sqrt(bw*bh)/2.6));
  while(r.parts.length<cap&&r.pts.length){const q=r.pts[(Math.random()*r.pts.length)|0];r.parts.push({x:q[0],y:q[1],ph:Math.random()*6.28,sp:.35+Math.random()*.35,sz:big*(.55+Math.random()*.55),seed:1+(r.parts.length%5)});}
  if(!r.loose)r.loose=fxLoose(r,16,5);
  const ex=40,X0=Math.max(0,bx-ex),Y0=Math.max(0,by-ex),X1=Math.min(W,bx+bw+ex),Y1=Math.min(H,by+bh+ex),T=RM.matches?0:t;
  scx.clearRect(X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  const P=r.parts.slice().sort((a,b)=>a.y-b.y);   // back to front
  for(const p of P){const bob=Math.sin(T*p.sp+p.ph),sz=p.sz*(1+.05*bob),dx=Math.sin(T*.18+p.ph)*10,dy=bob*3.5,spr=cloudSprite(r.hex,p.seed),ar=spr.height/spr.width;
    scx.globalAlpha=.22;scx.drawImage(CLOUDSH(),p.x+dx-sz*.9,p.y+dy-sz*ar*.55,sz*1.8,sz*ar*1.5);   // soft contact shadow under each billow
    scx.globalAlpha=.97;scx.drawImage(spr,p.x+dx-sz,p.y+dy-sz*ar,sz*2,sz*2*ar);}
  scx.globalAlpha=1;scx.globalCompositeOperation='destination-in';scx.drawImage(r.loose,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  x.drawImage(scratch,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);}
function mixHex(hex,a){const c=mix(hex2rgb(hex),WHITE,a);return '#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
function depthQ(r){ // quarter-res 0..1 "depth" of a painted shape: 0 at its edge, 1 in its middle (smooth, from a blurred mask)
  if(r.dq)return r.dq;const c=document.createElement('canvas');c.width=WQ;c.height=HQ;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(r.mask,0,0,WQ,HQ);const m=x.getImageData(0,0,WQ,HQ).data;x.clearRect(0,0,WQ,HQ);x.filter='blur(4px)';x.drawImage(r.mask,0,0,WQ,HQ);x.filter='none';
  const b=x.getImageData(0,0,WQ,HQ).data,d=new Float32Array(WQ*HQ),mk2=new Uint8Array(WQ*HQ);for(let i=0;i<d.length;i++){if(m[i*4+3]>20){mk2[i]=1;d[i]=Math.min(1,Math.max(0,(b[i*4+3]/255-.5)*2));}}
  return r.dq={d,m:mk2};}
function drawPulseBands(x,r,t,o){if(!r.bb)return;const Q=depthQ(r),[bx,by,bw,bh]=r.bb,X0=Math.max(0,bx/MQ|0),Y0=Math.max(0,by/MQ|0),X1=Math.min(WQ,(bx+bw)/MQ+1|0),Y1=Math.min(HQ,(by+bh)/MQ+1|0),w=X1-X0,h=Y1-Y0;if(w<=0||h<=0)return;
  const rgb=mix(hex2rgb(r.hex),WHITE,.55),q=r.pq&&r.pq.width===w&&r.pq.height===h?r.pq:(r.pq=new ImageData(w,h)),D=q.data,tt=RM.matches?.3:t;
  const lut=new Float32Array(33);for(let k=0;k<=32;k++)lut[k]=lightPulse(k/32,tt,o.sp,o.n,o.dir);
  for(let y=Y0;y<Y1;y++)for(let X=X0;X<X1;X++){const i=y*WQ+X,j=((y-Y0)*w+(X-X0))*4;if(!Q.m[i]){D[j+3]=0;continue;}const v=lut[Math.round(Q.d[i]*32)];D[j]=rgb[0];D[j+1]=rgb[1];D[j+2]=rgb[2];D[j+3]=v*255*o.a;}
  const c=r.pc||(r.pc=document.createElement('canvas'));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.getContext('2d').putImageData(q,0,0);
  scx.clearRect(bx,by,bw,bh);scx.globalCompositeOperation='source-over';scx.imageSmoothingQuality='high';scx.drawImage(c,X0*MQ,Y0*MQ,w*MQ,h*MQ);
  scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
  x.save();x.globalCompositeOperation='lighter';x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();}
function ppPulse(x,t){ // light pulses travel up through raised Pop Pencil areas (height = depth)
  const P=S&&S.pp;if(!P||!P.any||!P.hq)return;const q=P.pq||(P.pq=new ImageData(WQ,HQ)),D=q.data,tt=RM.matches?.3:t,lut=new Float32Array(33);for(let k=0;k<=32;k++)lut[k]=lightPulse(k/32,tt,.35,1,'forward');
  for(let i=0;i<P.hq.length;i++){const hv=P.hq[i],j=i*4;if(hv<=.02){D[j+3]=0;continue;}D[j]=255;D[j+1]=246;D[j+2]=222;D[j+3]=lut[Math.round(Math.min(1,hv)*32)]*120;}
  const c=P.pc||(P.pc=Object.assign(document.createElement('canvas'),{width:WQ,height:HQ}));c.getContext('2d').putImageData(q,0,0);
  x.save();x.globalCompositeOperation='lighter';x.imageSmoothingQuality='high';x.drawImage(c,0,0,W,H);x.restore();}
let fxTotal=0,fxRaf=0,fxLast=0;
function fxDraw(now){if(!S||!S.fxC)return;const x=S.fxC.getContext('2d');x.clearRect(0,0,W,H);const t=RM.matches?1.2:now/1000;
  const t0=performance.now();fxTotal=(S.fx||[]).reduce((a,r)=>a+r.parts.length,0);for(const r of S.fx||[]){const q=performance.now();fxDrawRec(x,r,t);r.ms=(r.ms||0)*.8+(performance.now()-q)*.2;}ppPulse(x,t);fxMs=fxMs*.8+(performance.now()-t0)*.2;}
let fxMs=0;
const fxLive=()=>S&&((S.fx&&S.fx.length)||(S.pp&&S.pp.any));
function fxStart(){if(fxRaf||!fxLive())return;fxAttach();if(RM.matches||document.hidden){fxDraw(performance.now());return;}
  const step=now=>{fxRaf=0;if(!fxLive()||document.hidden)return;if(now-fxLast>=32){fxLast=now;if(mode==='free')fxDraw(now);}fxRaf=requestAnimationFrame(step);};fxRaf=requestAnimationFrame(step);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(fxRaf);fxRaf=0;cancelAnimationFrame(pvRaf);pvRaf=0;}else{fxStart();pvStart();}});
function saveFx(st){const a=(st.fx||[]).filter(r=>r.bb||r.dirty).map(r=>({kind:r.kind,hex:r.hex,m:r.mask.toDataURL('image/png')}));a.length?LS.set('fx.'+st.n,a):LS.del('fx.'+st.n);}
async function loadFx(st){const a=LS.get('fx.'+st.n,[]);st.fx=[];for(const q of a){try{const im=await loadImg(q.m);const m=mk();const mx=m.getContext('2d',{willReadFrequently:true});mx.drawImage(im,0,0);
  st.fx.push({kind:q.kind,hex:q.hex,mask:m,mx,bb:null,pts:[],parts:[],dirty:true});}catch(e){}}}

/* ---------- animated previews: pencil-set box strip, mixer, store rows and the upgrade sheet ---------- */
const MIXK={finish:[['plain','Plain',null],['metal','Metallic','pencils'],['chrome','Chrome','pencils'],['neon','Neon','pencils'],['jewel','Jewel','pencils']],
  anim:[['none','None',null],['pulse','Pulse','pencils'],['glow','Glow','pencils'],['shimmer','Shimmer','pencils']],
  part:[['none','None',null],['glitter','Glitter','pencils'],['smoke','Smoke','smoke'],['cloud','Cloud','clouds']]};
const MIXSET={metal:'metal',chrome:'chrome',neon:'neon',jewel:'jewel',pulse:'pulse',glow:'glow',shimmer:'jewel',glitter:'glitter',smoke:'smoke',cloud:'cloud'};
const MIX=Object.assign({on:false,finish:'metal',anim:'pulse',part:'glitter'},LS.get('mix',{}));MIX.on=false;
function specOfSet(set){if(set.id==='ramp')return {kinds:['ramp'],ramps:['rainbow','sunset','ocean','gold'],colors:['#ef4444','#fb923c','#0891b2','#d4a015']};if(set.type==='plain')return {kinds:['plain'],colors:[set.colors[3],set.colors[7],set.colors[11]||set.colors[1],set.colors[5]]};
  const it=set.items;if(set.id==='brush')return {kinds:['brush'],colors:['#3a6ad6','#c9473d','#4c9a5b']};
  return {kinds:[set.id],colors:[0,1,2,3].map(i=>it[i%it.length].hex)};}
function specOfMix(hexes){return {kinds:['mix'],mix:{finish:MIX.finish,anim:MIX.anim,part:MIX.part},colors:hexes||[color,'#d4af37','#3a6ad6']};}
const tileCache={};function tilePat(x,kind,hex){const k=kind+hex;if(!tileCache[k])tileCache[k]=inkTile(kind,hex);return x.createPattern(tileCache[k],'repeat');}
function pvPath(x,w,h,i,n,prog){const y0=h*(i+.8)/(n+.6),amp=h/(n+1)*.35;x.beginPath();const x0=w*.05,x1=w*.95,e=x0+(x1-x0)*prog;
  for(let px=x0;px<=e;px+=2){const py=y0+Math.sin(px/w*9+i*1.7)*amp;px===x0?x.moveTo(px,py):x.lineTo(px,py);}return [e,y0+Math.sin(e/w*9+i*1.7)*amp];}
function drawFxPreview(cv,spec,t){const x=cv.getContext('2d'),w=cv.width,h=cv.height;x.clearRect(0,0,w,h);
  const n=Math.min(4,spec.colors.length),per=4.6,ph=(t%per)/per,lw=Math.max(3,h/(n+1)*.42);
  const k0=spec.kinds[0],m=spec.mix||{},finish=k0==='mix'?m.finish:k0,anim=k0==='mix'?m.anim:({glow:'glow',pulse:'pulse',jewel:'shimmer'})[k0],part=k0==='mix'?m.part:({glitter:'glitter',smoke:'smoke',cloud:'cloud'})[k0];
  const fade=ph>.86?1-(ph-.86)/.14:1;x.globalAlpha=1;
  for(let i=0;i<n;i++){const hex=spec.colors[i],prog=Math.max(0,Math.min(1,(ph-i*.09)/.55));if(prog<=0)continue;
    x.save();x.globalAlpha=fade;x.lineCap='round';x.lineJoin='round';x.lineWidth=finish==='cloud'?lw*1.6:finish==='smoke'?lw*1.3:lw;
    const base=finish==='plain'||finish==='brush'||!finish?'plain':finish;
    if(base==='ramp'){const k=(spec.ramps||['rainbow'])[i%(spec.ramps||[1]).length],g=x.createLinearGradient(w*.05,0,w*.95,0);
      for(let q=0;q<=12;q++){const c=rampRgb(k,pingpong(q/12*1.6+t/9));g.addColorStop(q/12,`rgb(${c[0]},${c[1]},${c[2]})`);}x.strokeStyle=g;}
    else x.strokeStyle=(base==='plain'||base==='mix')?hex:tilePat(x,base==='smoke'||base==='cloud'?base:base,hex);
    if(finish==='neon'){x.shadowColor=hex;x.shadowBlur=lw*1.6;}
    if(anim==='glow'){const s=.5+.5*Math.sin(t*2*Math.PI/3.2+i);x.shadowColor=hex;x.shadowBlur=lw*(1.5+2.2*s);}
    if(anim==='pulse'){const b=.5+.5*Math.sin(t*2*Math.PI/2.4+i*.6);x.globalAlpha=fade*(.62+.38*b);x.shadowColor=hex;x.shadowBlur=lw*1.4*b;}
    if(finish==='smoke'||finish==='cloud')x.globalAlpha*=finish==='smoke'?.7:.55;
    const tipPt=pvPath(x,w,h,i,n,prog);x.stroke();
    if(finish==='chrome'){const [lx,ly]=lightAt(t),rgb=hex2rgb(hex),g=x.createLinearGradient(0,h*(i+.3)/(n+.6)-lw,w*.15,h*(i+.3)/(n+.6)+lw*1.4);
      for(let k=0;k<=8;k++){const c=chromeAt(rgb,k/8+lx*.35+ly*.2);g.addColorStop(k/8,`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`);}
      x.globalCompositeOperation='source-atop';x.shadowBlur=0;x.strokeStyle=g;pvPath(x,w,h,i,n,prog);x.stroke();
      const p=(.5+lx*.45+t*.05)%1,g2=x.createLinearGradient(w*(p-.12),0,w*(p+.02),h);g2.addColorStop(0,'rgba(255,255,255,0)');g2.addColorStop(.5,'rgba(255,255,255,.95)');g2.addColorStop(1,'rgba(255,255,255,0)');
      x.strokeStyle=g2;pvPath(x,w,h,i,n,prog);x.stroke();x.globalCompositeOperation='source-over';}
    if(finish==='metal'||anim==='shimmer'){ // moving sheen along the stroke
      const p=((t/(anim==='shimmer'?2.6:3.4))+i*.21)%1,g=x.createLinearGradient(w*(p-.25),0,w*(p+.05),h);
      g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${anim==='shimmer'?.75:.55})`);g.addColorStop(1,'rgba(255,255,255,0)');
      x.globalCompositeOperation='source-atop';x.shadowBlur=0;x.strokeStyle=g;pvPath(x,w,h,i,n,prog);x.stroke();x.globalCompositeOperation='source-over';}
    if(part==='glitter'){x.shadowBlur=0;x.globalCompositeOperation='lighter';for(let s=0;s<22;s++){const per=.5+hash2(s,i*7)*.9,tt=t+hash2(i,s)*5,cyc=Math.floor(tt/per),u0=(tt/per)-cyc;
        const uu=hash2(s*13+cyc,i+3)*prog,hot=hash2(cyc,s*5+i)<.2,px=w*.05+(w*.9)*uu+u0*2,py=h*(i+.8)/(n+.6)+Math.sin((w*.05+(w*.9)*uu)/w*9+i*1.7)*h/(n+1)*.35+(hash2(s,cyc)-.5)*lw*.9-u0*2;
        const a=(u0<.18?u0/.18:Math.pow(1-(u0-.18)/.82,2))*(hot?1:.6)*fade,R2=lw*(hot?.5:.22)*(.6+.4*a);if(a>.03){x.globalAlpha=a;x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);}}x.globalCompositeOperation='source-over';}
    else if(anim==='shimmer'){x.fillStyle='#fff';x.shadowBlur=0;for(let s=0;s<7;s++){const u=((s*.137+i*.31)%1)*prog,px=w*.05+(w*.9)*u,py=h*(i+.8)/(n+.6)+Math.sin(px/w*9+i*1.7)*h/(n+1)*.35,a=Math.pow(Math.max(0,Math.sin(t*2.2+s*1.9+i)),3);if(a>.05)star(x,px+(s%3-1)*lw*.3,py,lw*(.35+.5*a),a*fade);}}
    if(part==='smoke'||part==='cloud'){const spr=tinted(hex,1);for(let s=0;s<9;s++){const u=((s*.113+i*.2)%1)*prog,px=w*.05+(w*.9)*u,py=h*(i+.8)/(n+.6)+Math.sin(px/w*9+i*1.7)*h/(n+1)*.35;
        if(part==='smoke'){const age=((t*.3+s*.29+i*.13)%1),sz=lw*(1.1+age*2.4),ws=wispSprite(hex);x.save();x.globalAlpha=.8*Math.sin(Math.PI*age)*fade;
          x.translate(px+Math.sin(t*1.3+s)*lw*age*2.2,py-age*h*.16);x.rotate(Math.sin(t*.8+s)*.9);x.scale(1.4,.8);x.drawImage(ws,-sz,-sz,sz*2,sz*2);x.restore();}
        else if(s%2===0){const b=Math.sin(t*.9+s*1.3+i),cs=cloudSprite(hex,1+s%5),sz=lw*(1.7+.08*b),ar=cs.height/cs.width;x.globalAlpha=.97*fade;x.drawImage(cs,px-sz+Math.sin(t*.3+s)*lw*.3,py-sz*ar+b*lw*.15,sz*2,sz*2*ar);}}}
    x.restore();}}
function drawMiniScene(cv,t){ // palettes: a tiny scene recoloured with each palette in turn
  const x=cv.getContext('2d'),w=cv.width,h=cv.height,per=1.9,i=Math.floor(t/per)%THEMES.length,f=Math.min(1,(t%per)/.5),th=THEMES[i],pv=THEMES[(i+THEMES.length-1)%THEMES.length];
  const paint=(tt,a)=>{const c=tt.colors;x.globalAlpha=a;x.fillStyle=c[1];x.fillRect(0,0,w,h);x.fillStyle=c[8];x.beginPath();x.arc(w*.75,h*.3,h*.16,0,6.3);x.fill();
    x.fillStyle=c[4];x.beginPath();x.moveTo(0,h*.72);x.quadraticCurveTo(w*.3,h*.42,w*.6,h*.7);x.lineTo(w,h*.62);x.lineTo(w,h);x.lineTo(0,h);x.fill();
    x.fillStyle=c[6];x.beginPath();x.moveTo(0,h*.86);x.quadraticCurveTo(w*.5,h*.66,w,h*.88);x.lineTo(w,h);x.lineTo(0,h);x.fill();
    x.fillStyle=c[9];x.fillRect(w*.2,h*.5,w*.03,h*.25);x.fillStyle=c[5];x.beginPath();x.arc(w*.215,h*.47,h*.12,0,6.3);x.fill();x.globalAlpha=1;};
  x.clearRect(0,0,w,h);paint(pv,1);paint(th,f);x.fillStyle='rgba(20,14,8,.55)';x.fillRect(0,h-26*(h/180),w,26*(h/180));x.fillStyle='#ffe2bd';x.font=`600 ${Math.round(15*h/180)}px Poppins`;x.textAlign='center';x.fillText(th.name,w/2,h-8*(h/180));}
function draw3DPreview(cv,t){ // 3D Pop: a shape rises, settles flat, then sinks in (inset), looping
  const x=cv.getContext('2d'),w=cv.width,h=cv.height,d=Math.sin(t*2*Math.PI/4.2);x.clearRect(0,0,w,h);
  const g0=x.createLinearGradient(0,0,0,h);g0.addColorStop(0,'#fffdf8');g0.addColorStop(1,'#efe5d4');x.fillStyle=g0;x.fillRect(0,0,w,h);
  const shapes=[[.22,'#c9473d',0],[.5,'#d4af37',1],[.78,'#2f6db5',2]];
  shapes.forEach(([fx,col,i])=>{const dd=d*(i===1?1:.8),cx=fx*w,cy=h*.48,R=h*.28;x.save();x.beginPath();i===1?x.roundRect(cx-R*1.1,cy-R,R*2.2,R*2,R*.35):x.arc(cx,cy,R,0,6.283);
    if(dd>0){x.shadowColor=`rgba(40,24,10,${.45*dd})`;x.shadowBlur=18*dd;x.shadowOffsetX=6*dd;x.shadowOffsetY=9*dd;}x.fillStyle=col;x.fill();x.shadowColor='transparent';x.clip();
    const a=Math.abs(dd),g=x.createLinearGradient(cx-R,cy-R,cx+R,cy+R);const L=`rgba(255,250,240,${.6*a})`,D=`rgba(40,24,10,${.5*a})`;
    g.addColorStop(0,dd>0?L:D);g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,dd>0?D:L);x.fillStyle=g;x.fillRect(cx-R*1.3,cy-R*1.1,R*2.6,R*2.2);
    if(dd<0){const rg=x.createRadialGradient(cx,cy,R*.1,cx,cy,R*1.1);rg.addColorStop(0,`rgba(30,18,6,${.35*a})`);rg.addColorStop(1,'rgba(30,18,6,0)');x.fillStyle=rg;x.fillRect(cx-R*1.3,cy-R*1.1,R*2.6,R*2.2);}
    x.restore();});
  x.fillStyle='#4a3b2c';x.font=`600 ${Math.round(h*.11)}px Poppins`;x.textAlign='center';x.fillText(d>.25?'Raise':d<-.25?'Inset':'Flat',w/2,h*.94);}
const PVS=new Set();let pvRaf=0,pvLast=0;   // live preview canvases: {cv, draw(t)}
function pvAdd(cv,draw){const o={cv,draw};PVS.add(o);draw(RM.matches?1.3:performance.now()/1000);pvStart();return o;}
function pvStart(){if(pvRaf||RM.matches||document.hidden)return;const step=now=>{pvRaf=0;if(document.hidden)return;
  for(const o of [...PVS]){if(!o.cv.isConnected){PVS.delete(o);continue;}if(o.cv.offsetParent===null)continue;}
  if(now-pvLast>=40){pvLast=now;for(const o of PVS)if(o.cv.offsetParent!==null)o.draw(now/1000);}
  if(PVS.size)pvRaf=requestAnimationFrame(step);};pvRaf=requestAnimationFrame(step);}
function pvCanvas(cls,wc,hc){const c=document.createElement('canvas');const dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.round(wc*dpr);c.height=Math.round(hc*dpr);c.style.width=wc+'px';c.style.height=hc+'px';c.className=cls;return c;}
function productPreview(cv,key,from){ // store row + upgrade sheet
  if(key==='palettes')return pvAdd(cv,t=>drawMiniScene(cv,t));
  if(key==='effects3d')return pvAdd(cv,t=>draw3DPreview(cv,t));
  const sets=SETS.filter(s=>s.product===key&&s.type==='ink');if(!sets.length)return;
  const first=from&&PREM[from]?SETI[PREM[from].kind==='brush'?'brush':PREM[from].kind]:null,order=first!=null?[SETS[first],...sets.filter(s=>s!==SETS[first])]:sets;
  if(order.length===1||cv.width<320)return pvAdd(cv,t=>drawFxPreview(cv,specOfSet(order[Math.floor(t/4.6)%order.length]),t));
  // grid of sets, each with its own strip + name
  const cols=Math.min(4,order.length),rows=Math.ceil(order.length/cols),cw=cv.width/cols,ch=cv.height/rows,sub=order.map(()=>{const c=document.createElement('canvas');c.width=Math.round(cw-10);c.height=Math.round(ch-26);return c;});
  return pvAdd(cv,t=>{const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);const g=x.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,'#1f1813');g.addColorStop(1,'#2b2119');x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
    order.forEach((s,i)=>{const cx=(i%cols)*cw,cy=Math.floor(i/cols)*ch;drawFxPreview(sub[i],specOfSet(s),t+i*.35);x.drawImage(sub[i],cx+5,cy+4);
      x.fillStyle='#ffe2bd';x.font=`600 ${Math.round(Math.min(16,ch*.13))}px Poppins`;x.textAlign='center';x.fillText(s.name,cx+cw/2,cy+ch-8);});});}

/* ---------- Mix: layer a finish + an animation + particles on one stroke ---------- */
function mixOwned(opt){const set=SETS[SETI[MIXSET[opt]]];return !set||owned(set);}
function mixSetsUsed(){return ['finish','anim','part'].map(s=>MIX[s]).filter(o=>o&&o!=='none'&&o!=='plain').map(o=>SETS[SETI[MIXSET[o]]]).filter(Boolean);}
function mixInk(){ink={kind:'mix',hex:color,id:null,mix:{finish:MIX.finish,anim:MIX.anim,part:MIX.part}};setInkPattern();markColor();}
function buildMixer(){const el=$('#mixer');if(!el)return;
  const row=(slot,label)=>`<div class="mxrow"><b>${label}</b>${MIXK[slot].map(([id,name,prod])=>{const own=!prod||mixOwned(id),set=SETS[SETI[MIXSET[id]]],l=set&&!own?Trials.left(set.id):0;
    return `<button class="mxo${MIX[slot]===id?' on':''}${own?'':' lk'}" data-slot="${slot}" data-o="${id}" title="${own?name:name+' · locked'}">${own?'':LOCK}${name}${own?'':`<small>${l?l+' free':'Unlock'}</small>`}</button>`;}).join('')}</div>`;
  el.querySelector('.mxrows').innerHTML=row('finish','Finish')+row('anim','Animation')+row('part','Particles');
  el.querySelectorAll('.mxo').forEach(b=>b.onclick=()=>{const slot=b.dataset.slot,o=b.dataset.o,set=SETS[SETI[MIXSET[o]]];
    if(set&&!owned(set)&&Trials.left(set.id)<=0){openUpgrade(null,set.product);return;}
    MIX[slot]=o;LS.set('mix',{finish:MIX.finish,anim:MIX.anim,part:MIX.part});if(MIX.on)mixInk();buildMixer();
    if(set&&!owned(set))toast(`${set.name}: ${Trials.left(set.id)} free ${Trials.left(set.id)===1?'try':'tries'} left in the mix`);});
  const cv=el.querySelector('canvas.mxpv');if(cv&&!cv._pv)cv._pv=pvAdd(cv,t=>drawFxPreview(cv,specOfMix([color,MIX.finish==='plain'?'#ff7b2e':'#d4af37','#3a6ad6']),t));}
function setMix(on){MIX.on=on;$('#mixBtn')&&$('#mixBtn').classList.toggle('on',on);$('#mixer').hidden=!on;if(on){if(tool!=='pencil'&&tool!=='fill')setTool('pencil');mixInk();buildMixer();}
  else if(ink.kind==='mix'){ink={kind:'plain',hex:color,id:null};setInkPattern();}buildPalette();}

/* ---------- owner test controls: only with ?owner=primewest, or after the owner code was used on this device ---------- */
const OWNER_KEY=(OWNER&&OWNER.storageKey)||'ep.owner.v1';
function ownerMode(){if(!OWNER)return false;try{if(new URLSearchParams(location.search).get(OWNER.urlParam||'owner')===(OWNER.urlValue||'primewest')){localStorage.setItem(OWNER_KEY,'1');return true;}return localStorage.getItem(OWNER_KEY)==='1';}catch(e){return false;}}
function ownerBar(){const b=$('#ownerbar');if(!b)return;b.hidden=!ownerMode();if(b.hidden)return;
  const all=Object.values(ENT).every(e=>e.unlocked());$('#ownUnlock').classList.toggle('on',all);$('#ownRelock').setAttribute('aria-pressed',String(!all));$('#ownRelock').classList.toggle('on',!all);}

/* ---------- Pop Pencil: paint depth freehand (Raise / Inset). Every pass adds a little height up to a cap; clipped to the
   outline under the first touch, or (where no line separates it) to the template object such as a hand. Edges bevel. ---------- */
const PP={clip:'outline'};
const PP_R=[10,16,26];   // brush radius per size button
function ppCanvases(st){if(!st.pp){const r=mk(),i=mk();st.pp={r,i,rx:r.getContext('2d',{willReadFrequently:true}),ix:i.getContext('2d',{willReadFrequently:true}),li:mk(),sh:mk()};
  st.pp.li.className='pp-li';st.pp.sh.className='pp-sh';}return st.pp;}
let pps=null;
function ppRegions(r,x,y){ // outline boundary = the region under the first touch; where the template knows the object (hand), use the object
  const T=depthOf(S);if(!T||!T.lv[r])return [r];
  const o=T.ob[r],rs=[];for(let q=1;q<S.N;q++)if(T.ob[q]===o&&T.lv[q]===T.lv[r])rs.push(q);
  // a small enclosed detail (thumbnail, nail, seal stamp) keeps its own outline; a big part of an object uses the whole object
  return S.cnt[r]<W*H*.004?[r]:rs;}
function ppMaskFor(rs){const c=mk(),x=c.getContext('2d'),m=x.createImageData(W,H),D=m.data;for(const q of rs)for(let p=S.off[q];p<S.off[q+1];p++)D[S.pix[p]*4+3]=255;x.putImageData(m,0,0);return c;}
function ppBegin(x,y){
  if(!Effects3D.unlocked()&&S.n!==FREE_3D_SCENE){if(Trials.popsLeft()<=0){openUpgrade(null,'effects3d');return;}Trials.spendPop();refreshPremiumUI();
    const l=Trials.popsLeft();toast(l?`Pop Pencil · free tries: ${l} left`:'That was your last free 3D try ✦');}
  let r=labAt(x,y);if(!r)return;if(isInk(x,y)){const q=nearestPx(x,y,LINE_LOCK.SNAP_START,(v,u,w)=>v>0&&!isInk(u,w));if(q)r=labAt(q[0],q[1]);}
  const T=depthOf(S);if(T&&T.lv[r]===0){shake();toast('Background stays flat');return;}
  ppCanvases(S);const tmp=mk(),rs=ppRegions(r,x,y);pps={r,rs,mask:ppMaskFor(rs),tmp,tx:tmp.getContext('2d'),last:[x,y],inset:POP.pressed};ppStamp(x,y);ppFlush();}
function ppStamp(x,y){const R=PP_R[sizeIdx]/zoomSizeDiv();pps.tx.globalAlpha=.16;pps.tx.drawImage(sprite,x-R,y-R,2*R,2*R);}
function ppMove(x,y){const [lx,ly]=pps.last,d=Math.hypot(x-lx,y-ly),step=Math.max(1,PP_R[sizeIdx]*.3/zoomSizeDiv()),n=Math.floor(d/step);
  for(let i=1;i<=n;i++)ppStamp(lx+(x-lx)*i/n,ly+(y-ly)*i/n);if(n)pps.last=[x,y];if(!ppFlush.t)ppFlush.t=setTimeout(()=>{ppFlush.t=0;ppFlush();},90);}
function ppFlush(){if(!pps)return;const st=S.pp,t=pps.tx;t.save();t.globalCompositeOperation='destination-in';t.drawImage(pps.mask,0,0);t.restore();
  const tgt=pps.inset?st.ix:st.rx;tgt.save();tgt.globalAlpha=1;tgt.drawImage(pps.tmp,0,0);tgt.restore();t.clearRect(0,0,W,H);ppRender(S);}
function ppEnd(){if(!pps)return;clearTimeout(ppFlush.t);ppFlush.t=0;ppFlush();pps=null;dirty('pp');}
function ppRender(st){const P=st.pp;if(!P)return;const N=W*H,dr=P.rx.getImageData(0,0,W,H).data,di=P.ix.getImageData(0,0,W,H).data;
  const h=new Float32Array(N);let any=false;for(let i=0;i<N;i++){const v=(dr[i*4+3]-di[i*4+3])/255;h[i]=v;if(v)any=true;}   // alpha caps at 255: the height cap
  const lx=P.li.getContext('2d'),sx=P.sh.getContext('2d');lx.clearRect(0,0,W,H);sx.clearRect(0,0,W,H);P.any=any;if(!any){ppAttach(st);return;}
  const b=new Float32Array(N),R=3;for(let pass=0;pass<2;pass++){for(let y=0;y<H;y++){let s=0;const o=y*W;for(let x=-R;x<W;x++){if(x+R<W)s+=h[o+x+R];if(x-R-1>=0)s-=h[o+x-R-1];if(x>=0)b[o+x]=s/(2*R+1);}}
    for(let x=0;x<W;x++){let s=0;for(let y=-R;y<H;y++){if(y+R<H)s+=b[(y+R)*W+x];if(y-R-1>=0)s-=b[(y-R-1)*W+x];if(y>=0)h[y*W+x]=s/(2*R+1);}}}
  const im=lx.createImageData(W,H),D=im.data,K=44;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(!h[i]&&!h[i-1]&&!h[i+1]&&!h[i-W]&&!h[i+W])continue;
    const gx=(h[i+1]-h[i-1])*.5,gy=(h[i+W]-h[i-W])*.5,v=(gx+gy)*.7071*K+(h[i]<0?h[i]*.3:h[i]*.06),j=i*4;
    if(v>0){D[j]=255;D[j+1]=250;D[j+2]=238;D[j+3]=Math.min(165,v*240);}else if(v<0){D[j]=44;D[j+1]=27;D[j+2]=12;D[j+3]=Math.min(170,-v*240);}}
  lx.putImageData(im,0,0);
  const m=sx.createImageData(W,H);for(let i=0;i<N;i++)if(h[i]>.03)m.data[i*4+3]=Math.min(255,h[i]*500);const mc=mk();mc.getContext('2d').putImageData(m,0,0);
  sx.save();sx.shadowColor='rgba(38,22,8,.35)';sx.shadowBlur=9;sx.shadowOffsetX=4+W*2;sx.shadowOffsetY=7;sx.drawImage(mc,-W*2,0);sx.restore();
  sx.globalCompositeOperation='destination-out';sx.drawImage(mc,0,0);sx.globalCompositeOperation='source-over';
  const hq=new Float32Array(WQ*HQ);for(let y=0;y<HQ;y++)for(let X=0;X<WQ;X++)hq[y*WQ+X]=Math.max(0,h[(y*MQ+2)*W+X*MQ+2]);P.hq=hq;ppAttach(st);if(st===S)scheduleLineTint();if(st===S&&typeof fxStart==='function')fxStart();}
function ppAttach(st){if(st!==S||!st.pp)return;layers.appendChild(st.pp.sh);layers.appendChild(st.pp.li);}
function ppEraseAt(r){const P=S.pp;if(!P||!P.any)return false;const bx=S.bb[r*4],by=S.bb[r*4+1],bw=S.bb[r*4+2]-bx+1,bh=S.bb[r*4+3]-by+1;
  const d=P.rx.getImageData(bx,by,bw,bh).data,e=P.ix.getImageData(bx,by,bw,bh).data;let has=false;
  for(let p=S.off[r];p<S.off[r+1]&&!has;p++){const i=S.pix[p],j=(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3;if(d[j]||e[j])has=true;}
  if(!has)return false;const c=ppMaskFor([r]);for(const q of [P.rx,P.ix]){q.save();q.globalCompositeOperation='destination-out';q.drawImage(c,0,0);q.restore();}ppRender(S);dirty('pp');return true;}
function savePP(st){const P=st.pp;if(!P||!P.any){LS.del('pp.'+st.n);return;}LS.set('pp.'+st.n,{r:P.r.toDataURL('image/png'),i:P.i.toDataURL('image/png')});}
async function loadPP(st){const q=LS.get('pp.'+st.n,null);if(!q)return;const P=ppCanvases(st);try{P.rx.drawImage(await loadImg(q.r),0,0);P.ix.drawImage(await loadImg(q.i),0,0);}catch(e){}ppRender(st);}

/* ---------- 3D idea: a ghost preview of a nice 3D treatment for this scene (toggle on/off, or apply) ---------- */
function idea3dPlan(st){const T=depthOf(st);if(!T)return [];const out=[],byOb={};
  for(let r=1;r<st.N;r++){const l=T.lv[r];if(!l)continue;const k=(l<0?'i':'r')+T.ob[r]+'/'+(T.h[r]>>3);(byOb[k]=byOb[k]||[]).push(r);}
  for(const [k,rs] of Object.entries(byOb)){const hz=rs.reduce((a,q)=>a+T.h[q],0)/rs.length/100;out.push({r:rs[0],rs,depth:60,pressed:k[0]==='i',hz:Math.abs(hz)});}
  out.sort((a,b)=>(a.pressed-b.pressed)||(a.hz-b.hz));return out;}
function idea3d(on){const btn=$('#idea3d'),ap=$('#idea3dApply');on=on??!btn.classList.contains('on');btn.classList.toggle('on',on);ap.hidden=!on;
  $$('.idea3d-sh,.idea3d-li').forEach(c=>c.remove());if(!on||!S)return;
  const plan=S.idea3d=idea3dPlan(S);if(!plan.length){toast('No 3D idea for this page yet');btn.classList.remove('on');ap.hidden=true;return;}
  const sh=mk(),li=mk();sh.className='idea3d-sh';li.className='idea3d-li';for(const p of plan)popRender(S,p,sh.getContext('2d'),li.getContext('2d'));
  layers.appendChild(sh);layers.appendChild(li);toast('3D idea preview · Apply to keep it');}
function idea3dApply(){if(!S||!S.idea3d)return;if(!Effects3D.unlocked()&&S.n!==FREE_3D_SCENE){openUpgrade(null,'effects3d');return;}
  const plan=S.idea3d;idea3d(false);if(D3.on)set3D(false);S.pops=(S.pops||[]).concat(plan.map(p=>({...p})));renderPops();dirty('pop');toast('3D idea applied · Pop Erase removes any part');}

/* ---------- 3D outlines: lines around a popped / inset area take the fill's light and shadow ----------
   A height per region (manual pops, Pop Pencil, or the 3D template when 3D is on) is blurred into a smooth field; its
   downhill direction at each line pixel is compared with the light (top-left). Facing the light -> lighter tint of the
   fill, away -> darker shade, with a smooth turn around the ends. Insets come out reversed on their own (their downhill
   points inward). Lines between equal heights and unpopped lines stay black. Raster copy at 100%, and the same colour
   field clipped by the vector line path when zoomed, so edges stay crisp at 8x. */
let ltT=0;function scheduleLineTint(){clearTimeout(ltT);ltT=setTimeout(updateLineTint,120);}
function regionHeights(st){const T=depthOf(st),hr=new Float32Array(st.N);let any=false;
  if(D3.on&&T){const fl=new Set(st.flat3d||[]);for(let r=1;r<st.N;r++)if(T.lv[r]&&!fl.has(r)){hr[r]=T.h[r]/100;any=true;}}
  else for(const p of st.pops||[])for(const q of p.rs||[p.r]){hr[q]=(p.pressed?-1:1)*Math.max(.35,p.hz||.6);any=true;}
  const P=st.pp;if(P&&P.any&&P.hq){const sum=new Float32Array(st.N),cnt=new Uint32Array(st.N);
    for(let y=0;y<HQ;y++)for(let x=0;x<WQ;x++){const r=st.lab[(y*MQ+2)*W+x*MQ+2];cnt[r]++;sum[r]+=P.hq[y*WQ+x]||0;}
    const di=P.ix.getImageData(0,0,W,H).data;   // inset strokes (hq only keeps the raised part)
    const neg=new Float32Array(st.N);for(let y=2;y<H;y+=MQ)for(let x=2;x<W;x+=MQ){const a=di[(y*W+x)*4+3];if(a)neg[st.lab[y*W+x]]+=a/255;}
    for(let r=1;r<st.N;r++){if(!cnt[r])continue;const up=sum[r]/cnt[r],dn=neg[r]/cnt[r];if(up>.04&&!hr[r]){hr[r]=Math.min(1,up*3);any=true;}else if(dn>.04&&!hr[r]){hr[r]=-Math.min(1,dn*3);any=true;}}}
  return any?hr:null;}
function updateLineTint(){const c=$('#lineTint');if(!S||!c)return;const x=c.getContext('2d');x.clearRect(0,0,W,H);const old=vline.querySelector('#vtint');if(old)old.remove();
  const hr=regionHeights(S);S.ltAny=!!hr;if(!hr)return;
  // fill colour of each popped region (what you see: free colour or colour-by-number, paper when empty)
  const src=(mode==='free'?S.free.ctx:S.cbn.ctx).getImageData(0,0,W,H).data,N=S.N,cs=new Float32Array(N*3),cn=new Uint32Array(N),L=S.lab;
  for(let i=0;i<W*H;i+=3){const r=L[i];if(!hr[r])continue;const j=i*4,a=src[j+3]/255;cs[r*3]+=src[j]*a+255*(1-a);cs[r*3+1]+=src[j+1]*a+253*(1-a);cs[r*3+2]+=src[j+2]*a+248*(1-a);cn[r]++;}
  const Hm=new Float32Array(W*H);for(let i=0;i<W*H;i++)Hm[i]=hr[L[i]];
  const tmp=new Float32Array(W*H),Rb=4;for(let pass=0;pass<2;pass++){for(let y=0;y<H;y++){let s=0;const o=y*W;for(let X=-Rb;X<W;X++){if(X+Rb<W)s+=Hm[o+X+Rb];if(X-Rb-1>=0)s-=Hm[o+X-Rb-1];if(X>=0)tmp[o+X]=s/(2*Rb+1);}}
    for(let X=0;X<W;X++){let s=0;for(let y=-Rb;y<H;y++){if(y+Rb<H)s+=tmp[(y+Rb)*W+X];if(y-Rb-1>=0)s-=tmp[(y-Rb-1)*W+X];if(y>=0)Hm[y*W+X]=s/(2*Rb+1);}}}
  const im=x.createImageData(W,H),D=im.data,Lx=-.7071,Ly=-.7071,sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  for(let y=6;y<H-6;y++)for(let X=6;X<W-6;X++){const i=y*W+X,gx=(Hm[i+1]-Hm[i-1])*.5,gy=(Hm[i+W]-Hm[i-W])*.5,mag=Math.hypot(gx,gy);if(mag<1e-4)continue;
    let s0=L[i],best=Math.abs(hr[s0]);for(const k of [i-3,i+3,i-3*W,i+3*W,i-6,i+6,i-6*W,i+6*W]){const v=Math.abs(hr[L[k]]);if(v>best){best=v;s0=L[k];}}if(!best||!cn[s0])continue;const al=Math.min(1,mag*30/best);if(al<.06)continue;
    const d=(-gx*Lx-gy*Ly)/mag,s=sm((d+.45)/.9),c=[cs[s0*3]/cn[s0],cs[s0*3+1]/cn[s0],cs[s0*3+2]/cn[s0]];
    const lt=mix(c,WHITE,.62),dk=c.map(v=>v*.38),o=mix(dk,lt,s),j=i*4;D[j]=o[0];D[j+1]=o[1];D[j+2]=o[2];D[j+3]=255*sm(al);}
  const F=mk();F.getContext('2d').putImageData(im,0,0);
  if(lineImg.complete&&lineImg.naturalWidth){x.drawImage(lineImg,0,0,W,H);x.globalCompositeOperation='source-in';x.drawImage(F,0,0);x.globalCompositeOperation='source-over';}
  S.ltF=F;lineTintSVG();}
function lineTintSVG(){const old=vline.querySelector('#vtint');if(old)old.remove();if(!S||!S.ltAny||!S.ltF||vline.dataset.n!=S.n)return;const p=vline.querySelector('path');if(!p)return;
  const ns='http://www.w3.org/2000/svg';let cp=vline.querySelector('#lcp');if(!cp){const defs=document.createElementNS(ns,'defs');cp=document.createElementNS(ns,'clipPath');cp.id='lcp';
    const q=document.createElementNS(ns,'path');q.setAttribute('d',p.getAttribute('d'));q.setAttribute('clip-rule','evenodd');cp.appendChild(q);defs.appendChild(cp);vline.appendChild(defs);}
  const img=document.createElementNS(ns,'image');img.id='vtint';img.setAttribute('href',S.ltF.toDataURL('image/png'));img.setAttribute('x',0);img.setAttribute('y',0);img.setAttribute('width',W);img.setAttribute('height',H);
  img.setAttribute('preserveAspectRatio','none');img.setAttribute('clip-path','url(#lcp)');vline.appendChild(img);}

/* ---------- Lines control: fade the black line art (black -> invisible), recolour it (a chosen colour, or Auto = a darker
   shade of the fill next to it), or hide it for a painted look (the gaps are filled with the neighbouring colour).
   Applies to the raster lines, the vector lines used when zoomed (so it stays crisp), export/Save, undo and autosave. */
const LINES0={f:0,c:'ink',h:0};
const linesOf=st=>(st&&st.lines)||LINES0;
const linesDefault=L=>!L||(!L.f&&!L.h&&(L.c||'ink')==='ink');
let lnT=0;function scheduleLines(){clearTimeout(lnT);lnT=setTimeout(linesApply,260);}
function lineMask(){if(S.lmask)return S.lmask;if(!lineImg.complete||!lineImg.naturalWidth)return null;
  const c=mk(),x=c.getContext('2d');x.drawImage(lineImg,0,0,W,H);const d=x.getImageData(0,0,W,H).data,m=new Uint8Array(W*H);
  for(let i=0,j=3;i<m.length;i++,j+=4)m[i]=d[j]>14?1:0;return (S.lmask=m);}
function lineAdj(){ // colour of the nearest fill for every line pixel (breadth-first from the edges of the line)
  const m=lineMask();if(!m)return null;const src=(mode==='free'?S.free.ctx:S.cbn.ctx).getImageData(0,0,W,H).data,N=W*H;
  const col=new Uint8ClampedArray(N*4),q=new Int32Array(N),seen=new Uint8Array(N);let qh=0,qt=0;
  for(let i=0;i<N;i++){if(m[i])continue;const j=i*4,a=src[j+3]/255;col[j]=src[j]*a+255*(1-a);col[j+1]=src[j+1]*a+253*(1-a);col[j+2]=src[j+2]*a+248*(1-a);col[j+3]=255;seen[i]=1;
    const y=(i/W)|0,x=i-y*W;if((x>0&&m[i-1])||(x<W-1&&m[i+1])||(y>0&&m[i-W])||(y<H-1&&m[i+W]))q[qt++]=i;}
  while(qh<qt){const i=q[qh++],y=(i/W)|0,x=i-y*W,j=i*4;for(const k of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]){if(k<0||seen[k])continue;seen[k]=1;const o=k*4;col[o]=col[j];col[o+1]=col[j+1];col[o+2]=col[j+2];col[o+3]=255;q[qt++]=k;}}
  return col;}
function autoShade(c){const g=(c[0]+c[1]+c[2])/3,k=.42;return c.map(v=>Math.max(0,Math.min(255,(g+(v-g)*1.25)*k)));}   // darker, slightly richer shade
function linesApply(){if(!S)return;const L=linesOf(S),def=linesDefault(L),op=L.h?0:1-(L.f||0),under=$('#lineUnder'),lc=$('#lineCol');
  app.classList.toggle('lcol',!def&&L.c!=='ink');[lineImg,lc,$('#lineTint'),vline].forEach(e=>{if(e)e.style.opacity=def?'':op;});
  const va=vline.querySelector('#vauto');if(va)va.remove();const vp=vline.querySelector('path');
  $('#linesBtn')&&$('#linesBtn').classList.toggle('set',!def);
  if(def){under.hidden=true;lc.hidden=true;if(vp)vp.setAttribute('fill','#141414');S.linesC=null;return;}
  const need=op<1||L.c==='auto',adj=need?lineAdj():null,m=lineMask();if(!m)return;
  // painted fill under the lines (shows through as they fade; the whole look when hidden)
  const ux=under.getContext('2d');ux.clearRect(0,0,W,H);
  if(op<1&&adj){const im=ux.createImageData(W,H);for(let i=0;i<W*H;i++)if(m[i]){const j=i*4;im.data[j]=adj[j];im.data[j+1]=adj[j+1];im.data[j+2]=adj[j+2];im.data[j+3]=255;}ux.putImageData(im,0,0);under.hidden=false;}else under.hidden=true;
  // coloured lines
  const cx=lc.getContext('2d');cx.clearRect(0,0,W,H);let F=null;
  if(L.c!=='ink'){F=mk();const fx=F.getContext('2d');
    if(L.c==='auto'&&adj){const im=fx.createImageData(W,H),D=im.data,cache=new Map();for(let i=0;i<W*H;i++)if(m[i]){const j=i*4,key=(adj[j]<<16)|(adj[j+1]<<8)|adj[j+2];let o=cache.get(key);if(!o){o=autoShade([adj[j],adj[j+1],adj[j+2]]);cache.set(key,o);}D[j]=o[0];D[j+1]=o[1];D[j+2]=o[2];D[j+3]=255;}fx.putImageData(im,0,0);}
    else{fx.fillStyle=L.c;fx.fillRect(0,0,W,H);}
    cx.drawImage(lineImg,0,0,W,H);cx.globalCompositeOperation='source-in';cx.drawImage(F,0,0);cx.globalCompositeOperation='source-over';lc.hidden=false;}
  else lc.hidden=true;
  S.linesC=L.c!=='ink'?lc:null;
  // vector lines (zoomed): same colour, clipped by the vector path so it stays sharp
  if(vp){if(L.c==='ink')vp.setAttribute('fill','#141414');else if(L.c==='auto'&&F){vp.setAttribute('fill','none');const ns='http://www.w3.org/2000/svg';
      let cp=vline.querySelector('#lcp');if(!cp){const defs=document.createElementNS(ns,'defs');cp=document.createElementNS(ns,'clipPath');cp.id='lcp';const qq=document.createElementNS(ns,'path');qq.setAttribute('d',vp.getAttribute('d'));qq.setAttribute('clip-rule','evenodd');cp.appendChild(qq);defs.appendChild(cp);vline.appendChild(defs);}
      const img=document.createElementNS(ns,'image');img.id='vauto';img.setAttribute('href',F.toDataURL('image/png'));img.setAttribute('x',0);img.setAttribute('y',0);img.setAttribute('width',W);img.setAttribute('height',H);img.setAttribute('preserveAspectRatio','none');img.setAttribute('clip-path','url(#lcp)');
      const vt=vline.querySelector('#vtint');vt?vline.insertBefore(img,vt):vline.appendChild(img);}
    else vp.setAttribute('fill',L.c);}}
function drawLinesTo(x){const L=linesOf(S),def=linesDefault(L),op=def?1:L.h?0:1-(L.f||0);
  if(!def&&op<1&&!$('#lineUnder').hidden)x.drawImage($('#lineUnder'),0,0);
  x.save();x.globalAlpha=op;if(S.linesC&&!def)x.drawImage(S.linesC,0,0);else x.drawImage(lineImg,0,0,W,H);
  const lt=$('#lineTint');if(S.ltAny&&lt)x.drawImage(lt,0,0);x.restore();}
function setLines(p,noUndo){if(!S)return;const prev={...linesOf(S)},L={...prev,...p};if(JSON.stringify(prev)===JSON.stringify(L))return;
  if(!noUndo){S.linesHist=S.linesHist||[];const top=S.linesHist[S.linesHist.length-1];
    if(!(top&&top.slide&&p.f!=null&&Object.keys(p).length===1&&Date.now()-top.t<900))S.linesHist.push({l:prev,t:Date.now(),slide:p.f!=null&&Object.keys(p).length===1});else top.t=Date.now();}
  S.lines=L;linesDefault(L)?LS.del('lines.'+S.n):LS.set('lines.'+S.n,L);dirty('lines');linesApply();linesUI();}
function undoLines(){const e=S.linesHist.pop();S.lines=e.l;linesDefault(e.l)?LS.del('lines.'+S.n):LS.set('lines.'+S.n,e.l);dirty('lines');linesApply();linesUI();}
const lastPaintT=()=>{const f=S.free.undo[S.free.undo.length-1],c=S.cbn.hist[S.cbn.hist.length-1];return mode==='free'?(f&&f.t||0):(c&&c.t||0);};
const LINE_SW=['#141414','#5a3a22','#2f3f6b','#7a1f2b','#2f5a3a','#8a8a8a'];
function linesUI(){const p=$('#linesPop');if(!p||p.hidden||!S)return;const L=linesOf(S);
  $('#lnFade').value=Math.round((L.f||0)*100);$('#lnFadeV').textContent=L.h?'hidden':(L.f?Math.round(L.f*100)+'%':'black');
  $$('#linesPop .lnc').forEach(b=>b.classList.toggle('on',b.dataset.c===L.c||(b.dataset.c==='cur'&&L.c!=='ink'&&L.c!=='auto'&&!LINE_SW.includes(L.c))||(b.dataset.c!=='cur'&&b.dataset.c===L.c)));
  const cur=$('#linesPop .lnc[data-c=cur]');cur.style.background=color;cur.title='Your color ('+colorName(color)+')';
  $('#lnHide').setAttribute('aria-pressed',L.h?'true':'false');$('#lnHide').classList.toggle('on',!!L.h);}
function linesDoneGlow(){const b=$('#linesBtn');if(!b||!S)return;b.classList.toggle('hot',!!(S.cbn.complete||(S.cbn.done&&S.cbn.done===S.total)));}
(function(){const b=$('#linesBtn'),p=$('#linesPop');if(!b||!p)return;
  const place=()=>{const r=b.getBoundingClientRect(),pw=p.offsetWidth||280,ph=p.offsetHeight||200;p.style.left=Math.max(8,Math.min(innerWidth-pw-8,r.left+r.width/2-pw/2))+'px';p.style.top=Math.max(8,r.top-ph-10)+'px';};
  b.onclick=e=>{e.stopPropagation();p.hidden=!p.hidden;b.setAttribute('aria-expanded',!p.hidden);if(!p.hidden){linesUI();place();}};
  document.addEventListener('pointerdown',e=>{if(!p.hidden&&!p.contains(e.target)&&!b.contains(e.target)){p.hidden=true;b.setAttribute('aria-expanded','false');}});
  $('#lnFade').oninput=e=>setLines({f:+e.target.value/100});
  $$('#linesPop .lnc').forEach(c=>c.onclick=()=>setLines({c:c.dataset.c==='cur'?color:c.dataset.c}));
  $('#lnHide').onclick=()=>setLines({h:linesOf(S).h?0:1});
  $('#lnReset').onclick=()=>setLines({...LINES0});
  $('#lnX').onclick=()=>{p.hidden=true;};})();

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
function showTry(r){if(!hintsOn()||mode!=='free'||!r||tool==='eraser'||tool==='pop')return;const sw=suggestFor(r),el=$('#tryrow');el.classList.remove('natural');el.querySelector('b').textContent='Try';
  el.querySelector('.tsw').innerHTML=sw.map((h,i)=>`<button style="background:${h}" data-c="${h}" title="${i===0&&S.num[r]?'From the color guide':colorName(h)}">${i===0&&S.num[r]?'<i>★</i>':''}</button>`).join('');
  el.querySelectorAll('.tsw button').forEach(b=>b.onclick=e=>{e.stopPropagation();pickColor(b.dataset.c);el.hidden=true;});
  el.hidden=false;clearTimeout(tryT);tryT=setTimeout(()=>el.hidden=true,8000);}
/* ---------- natural colours: hover (mouse) or long-press (touch) an area -> the sample bar shows true-to-life colours for
   that part (skin tones for hands, browns for wood, blues for sky...). The scene's colour guide comes first. Only a hint. */
const NATURAL={skin:['#f6d7c3','#eec1a0','#d9a07b','#b97a56','#8d5a3b','#5c3a28'],nail:['#f7d9d0','#efc4b8','#e0a99a','#c98f80'],
  hair:['#f1d9a3','#c89b5e','#8a5a2b','#4e3120','#2a1d17','#a9a9a9'],wood:['#c19a6b','#a0764f','#7b5234','#5a3a22','#3d2817'],
  sky:['#dcefff','#a9d4f5','#7fb7e6','#5a8fcf','#f6c9a8'],water:['#bfe3ea','#7cc0cf','#3f8fa6','#23627a'],foliage:['#b9d98f','#7fae5a','#4f8a3e','#2f6b33','#1f4a2a'],
  stone:['#e3e0d9','#b9b4aa','#8a857c','#5f5b55','#3e3b37'],paper:['#fbf3e0','#f3e2bf','#e6cf9f','#d4b887','#bfa071'],
  fire:['#ffe9a3','#ffc75a','#f39336','#d9582a','#a8321d'],wax:['#e0574a','#c9473d','#9c2f2a','#6e1f1f','#b8862e'],cloth:null};
const NATNAME={skin:'skin tones',nail:'nail pinks',hair:'hair',wood:'wood browns',sky:'sky blues',water:'water',foliage:'leaf greens',stone:'stone greys',paper:'paper & parchment',fire:'fire & gold',wax:'sealing wax',cloth:'fabric'};
const SCENE_PART_H={4:{100:'skin',84:'skin',76:'nail',70:'wax',56:'wax',50:'paper'}};   // scene 4 depth heights -> part type
function regionType(r){const T=depthOf(S);if(T){if(T.nm&&T.nm[r])return T.nm[r];const m=SCENE_PART_H[S.n];if(m&&T.lv[r]!==0&&m[T.h[r]])return m[T.h[r]];}
  const g=S.num[r]?S.d.palette[S.num[r]-1]:null;if(!g)return 'cloth';const [h,s,l]=rgb2hsl(hex2rgb(g));
  if(l>.85&&s<.4)return 'paper';if(s<.12)return 'stone';if(h>=12&&h<45&&s>.2&&l>=.5&&l<.9)return 'skin';if(h>=12&&h<45&&l<.5)return l<.22?'hair':'wood';
  if(h>=45&&h<65)return 'fire';if(h>=65&&h<170)return 'foliage';if(h>=170&&h<200)return 'water';if(h>=200&&h<260)return 'sky';if(h<12||h>=330)return 'wax';return 'cloth';}
function showNatural(r){if(!hintsOn()||mode!=='free'||!r||!S)return;const ty=regionType(r),g=S.num[r]?S.d.palette[S.num[r]-1]:null,out=[];const add=h=>{h=h.toLowerCase();if(!out.includes(h))out.push(h);};
  if(g)add(g);(NATURAL[ty]||suggestFor(r)).forEach(add);const el=$('#tryrow');el.classList.add('natural');el.querySelector('b').textContent='Natural · '+(NATNAME[ty]||ty);
  el.querySelector('.tsw').innerHTML=out.slice(0,6).map((h,i)=>`<button style="background:${h}" data-c="${h}" title="${i===0&&g?'From the color guide':colorName(h)}">${i===0&&g?'<i>★</i>':''}</button>`).join('');
  el.querySelectorAll('.tsw button').forEach(b=>b.onclick=e=>{e.stopPropagation();pickColor(b.dataset.c);el.hidden=true;});
  el.hidden=false;el.dataset.r=r;clearTimeout(tryT);tryT=setTimeout(()=>el.hidden=true,6000);}
let natT=0,natR=0,lpT=0;
stage.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||e.buttons||mode!=='free'||!S)return;if(e.target.closest&&e.target.closest('.tryrow,.nudge,.zoomui,.ideasbar'))return;
  const [x,y]=toCanvas(e),r=labAt(x,y);clearTimeout(natT);if(!r||r===natR&&!$('#tryrow').hidden)return;natT=setTimeout(()=>{natR=r;showNatural(r);},420);},{passive:true});
stage.addEventListener('pointerleave',()=>clearTimeout(natT));
stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||mode!=='free'||(e.target.closest&&e.target.closest('.zoomui,.tryrow,.nudge,.ideasbar')))return;const [x,y]=toCanvas(e),sx=e.clientX,sy=e.clientY;clearTimeout(lpT);
  const mv=ev=>{if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10){clearTimeout(lpT);stage.removeEventListener('pointermove',mv);}};stage.addEventListener('pointermove',mv,{passive:true});
  lpT=setTimeout(()=>{stage.removeEventListener('pointermove',mv);const r=labAt(x,y);if(!r)return;cancelStroke();showNatural(r);},550);});
stage.addEventListener('pointerup',()=>clearTimeout(lpT));
/* ---------- pencil names: a small, quick tooltip on hover / long-press with an evocative colour name and its effect ---------- */
const CNAMES={neutral:[['Ink Black','Raven','Soot'],['Charcoal','Graphite','Slate'],['Pewter','Storm Gray','Smoke'],['Dove Gray','Silver Mist','Pebble'],['Chalk White','Porcelain','Linen']],
  red:[['Oxblood','Wine','Garnet'],['Ember Red','Poppy','Cherry','Scarlet'],['Rose Blush','Coral Pink','Petal']],
  orange:[['Rust','Burnt Sienna','Chestnut'],['Tangerine','Amber Flame','Marigold','Copper Glow'],['Apricot','Peach','Melon']],
  brown:[['Walnut','Cocoa','Umber'],['Saddle Tan','Cinnamon','Caramel'],['Sand','Biscuit','Oat']],
  yellow:[['Bronze','Mustard','Olive Gold'],['Sunflower','Honey','Saffron','Goldenrod'],['Butter','Candlelight','Lemon Chiffon']],
  lime:[['Moss','Olive','Fern'],['Lime Leaf','Spring Green','Chartreuse'],['Pistachio','Celery','Sage Mist']],
  green:[['Forest','Pine','Ivy'],['Emerald','Jade','Clover','Meadow'],['Mint','Seafoam','Sage']],
  teal:[['Deep Teal','Spruce','Abyss'],['Teal','Lagoon','Turquoise'],['Sea Glass','Aqua Mist','Ice Blue']],
  blue:[['Midnight','Navy','Deep Sea'],['Cobalt','Cornflower','Ocean Blue','Sapphire'],['Sky','Powder Blue','Cloud Blue']],
  violet:[['Indigo Night','Deep Violet','Plum Shadow'],['Violet','Amethyst','Iris'],['Lavender','Lilac','Wisteria']],
  magenta:[['Aubergine','Plum','Mulberry'],['Orchid','Fuchsia','Magenta'],['Pink Blossom','Cotton Candy','Blush']]};
function colorFamily(hex){const [h,s,l]=rgb2hsl(hex2rgb(hex));if(s<.12||(s<.2&&(l<.12||l>.9)))return ['neutral',l<.12?0:l<.3?1:l<.55?2:l<.82?3:4];
  let f=h<12||h>=345?'red':h<38?(s<.45||l<.36?'brown':'orange'):h<65?'yellow':h<100?'lime':h<160?'green':h<195?'teal':h<248?'blue':h<290?'violet':'magenta';
  if(f==='brown'&&l>.75)f='orange';return [f,l<.33?0:l<.68?1:2];}
const NAMEC={};
function nameColors(list,setId){const used=new Set(),out={};for(const hex of list){const k=setId+hex;if(NAMEC[k]){out[hex]=NAMEC[k];used.add(NAMEC[k]);continue;}
  const [f,b]=colorFamily(hex),L=CNAMES[f],cands=[...L[b],...L.flatMap((x,i)=>i===b?[]:x)];let n=cands.find(c=>!used.has(c));
  const el=setId==='neonnight'&&f!=='neutral'&&rgb2hsl(hex2rgb(hex))[1]>.85?'Electric ':'';if(el){const c2=cands.find(c=>!used.has(el+c));if(c2)n=el+c2;}
  if(!n||used.has(n)){const [,s,l]=rgb2hsl(hex2rgb(hex));const base=el+L[b][0];n=(l<.4?'Dusky ':s>.7?'Bright ':'Soft ')+base;let i=2;while(used.has(n))n=base+' '+(i++);}
  used.add(n);out[hex]=NAMEC[k]=n;}return out;}
const PNAME={Gold:'Gilded Gold',Silver:'Sterling Silver',Copper:'Burnished Copper',Bronze:'Antique Bronze',Ruby:'Ruby Heart',Emerald:'Emerald Isle',Sapphire:'Deep Sapphire',Amethyst:'Amethyst Dusk',Topaz:'Golden Topaz'};
const tcase=s=>s.replace(/\b[a-z]/g,c=>c.toUpperCase());
const EFFECT={metal:'Metallic · polished shine that sweeps over the shape',chrome:'Chrome · mirror shine that follows your tilt',glitter:'Glitter · twinkling sparkles',
  jewel:'Jewel · faceted glints and shimmer',neon:'Neon · bright glowing edge',glow:'Glow · soft lantern light',pulse:'Pulse · breathing, living color',ramp:'Gradient · colors flow along the stroke',
  smoke:'Smoke · drifting wisps',cloud:'Cloud · slow billowing puffs',brush:'Brush',plain:'Colored pencil'};
const BRUSHFX={airbrush:'Brush · soft sprayed edges',watercolor:'Brush · translucent wash with pooled edges'};
function tipFor(el){if(el.dataset.p){const p=PREM[el.dataset.p];if(!p)return null;return [PNAME[p.name]||tcase(p.name),p.kind==='brush'?BRUSHFX[p.id]||'Brush':EFFECT[p.kind]||'',p.hex];}
  if(el.dataset.c&&el.classList.contains('pencil')){const set=SETS[setIdx],nm=nameColors(set.colors||[],set.id)[el.dataset.c]||colorName(el.dataset.c);
    return [nm,set.id==='jewel'?'Jewel tone · with a soft shimmer':set.id==='book'?'Colored pencil · book palette':'Colored pencil · '+set.name,el.dataset.c];}
  if(el.classList.contains('sw')&&el.dataset.k&&S){const hex=S.d.palette[el.dataset.k-1],nm=nameColors(S.d.palette,'scene'+S.n)[hex];
    return [nm,mode==='cbn'?`Number ${el.dataset.k} · tap, then color the ${el.dataset.k}s`:`Guide color ${el.dataset.k} · colored pencil`,hex];}return null;}
(function(){const tip=document.createElement('div');tip.id='ptip';tip.className='ptip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
  let t=0,cur=null,lp=0;const host=$('#colors')||document.body;
  const show=el=>{const d=tipFor(el);if(!d)return;tip.innerHTML=`<i style="background:${d[2]||'transparent'}"></i><b>${esc(d[0])}</b><small>${esc(d[1])}</small>`;tip.hidden=false;
    const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(6,Math.min(innerWidth-w-6,r.left+r.width/2-w/2))+'px';tip.style.top=Math.max(6,r.top-h-8)+'px';cur=el;};
  const hide=()=>{clearTimeout(t);clearTimeout(lp);tip.hidden=true;cur=null;};
  const target=e=>e.target.closest&&e.target.closest('#freerow .pencil,#numrow .sw');
  host.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=target(e);if(!el){return;}if(el===cur)return;clearTimeout(t);t=setTimeout(()=>show(el),tip.hidden?160:0);});
  host.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const el=target(e);if(el&&!el.contains(e.relatedTarget))hide();});
  host.addEventListener('pointerdown',e=>{const el=target(e);if(!el)return;if(e.pointerType==='mouse'){hide();return;}clearTimeout(lp);lp=setTimeout(()=>{show(el);setTimeout(()=>{if(cur===el)hide();},1800);},420);});
  host.addEventListener('pointerup',()=>clearTimeout(lp));host.addEventListener('pointercancel',()=>clearTimeout(lp));host.addEventListener('scroll',hide,{passive:true});
  // the custom tip replaces the slow native title tooltip
  new MutationObserver(()=>{$$('#freerow .pencil[title],#numrow .sw[title]').forEach(b=>{b.setAttribute('aria-label',b.title);b.removeAttribute('title');});}).observe(host,{childList:true,subtree:true});})();
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
  if(S.linesHist&&S.linesHist.length&&S.linesHist[S.linesHist.length-1].t>=lastPaintT())return undoLines();
  if(mode==='cbn'){const c=S.cbn,b=c.hist.pop();if(!b)return;
    for(const r of b){c.filled[r]=0;paintRegion(r,[0,0,0],0);if(S.tgt[r]){c.doneT[S.num[r]]--;c.done--;}}
    c.complete=false;highlight();drawNums();progress();dirty('cbn');}
  else{const n=S.free.undo.length,u=S.free.undo.pop();if(u){unsnap(u);dirty('free');
    while(S.fxUndo&&S.fxUndo.length&&S.fxUndo[S.fxUndo.length-1].n===n){for(const [r,c] of S.fxUndo.pop().m){r.mx.clearRect(0,0,W,H);r.mx.drawImage(c,0,0);r.dirty=true;if(!(S.fx||[]).includes(r))S.fx.push(r);}}
    fxClip();}}
}
let armT=0;
function clearAll(){const b=$('#clear');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('span').textContent='Tap again';clearTimeout(armT);
    armT=setTimeout(()=>{b.classList.remove('arm');b.querySelector('span').textContent='Clear';},2500);return;}
  b.classList.remove('arm');b.querySelector('span').textContent='Clear';
  if(mode==='cbn'){const c=S.cbn;c.filled.fill(0);c.doneT.fill(0);c.done=0;c.hist=[];c.complete=false;c.img.data.fill(0);c.ctx.clearRect(0,0,W,H);
    selNum=1;markColor();highlight();drawNums();progress();dirty('cbn');}
  else{snap();S.free.ctx.clearRect(0,0,W,H);S.rc={};if(S.pulse){S.pulse.ctx.clearRect(0,0,W,H);dirty('pulse');}S.fx=[];if(S.fxC)S.fxC.getContext('2d').clearRect(0,0,W,H);dirty('fx');dirty('free');}
}
/* flattened picture: paper + colour (+ pulse frame + 3D pops) + line art. phase = pulse animation phase 0..1 */
function composite(phase=.5,m=mode){
  const c=mk(),x=c.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,W,H);
  x.drawImage(m==='cbn'?S.cbn.c:S.free.c,0,0);
  if(m==='free'&&S.pulse&&S.pulseUsed){const b=.5+.5*Math.sin(phase*Math.PI*2);x.save();x.globalAlpha=.7+.3*b;x.drawImage(S.pulse.c,0,0);
    x.globalCompositeOperation='screen';x.globalAlpha=.25+.45*b;x.filter='blur(6px)';x.drawImage(S.pulse.c,0,0);x.restore();}
  if(D3.on&&S.relief){x.drawImage(S.relief.sh,0,0);x.drawImage(S.relief.li,0,0);}
  if(!D3.on&&S.pops&&S.pops.length&&S.popSh){x.drawImage(S.popSh,0,0);x.drawImage(S.popLi,0,0);}
  if(S.pp&&S.pp.any){x.drawImage(S.pp.sh,0,0);x.drawImage(S.pp.li,0,0);}
  if(m==='free'&&S.fx&&S.fx.length){fxDraw(performance.now());x.drawImage(S.fxC,0,0);}
  drawLinesTo(x);return c;}
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
popUI();
if(0)$('#popDepth').oninput=e=>{const v=+e.target.value;POP.flat=v===0;POP.pressed=v<0;if(v)POP.depth=Math.abs(v);settings.popDepth=POP.depth;settings.popMode=POP.flat?'flat':POP.pressed?'inset':'raised';popUI();LS.set('settings',settings);clearTimeout(popRestyle.t);popRestyle.t=setTimeout(popRestyle,120);};
if(0)$('#popWhole').onclick=()=>{POP.whole=!POP.whole;settings.popWhole=POP.whole;LS.set('settings',settings);$('#popWhole').classList.toggle('on',POP.whole);toast(POP.whole?'Pop whole object: one tap raises the whole object':'Pop one area at a time');};
$('#d3sw').onclick=()=>set3D(!D3.want||!D3.on);
$('#bandBtn').onclick=()=>{if(!D3.on)return;enableTilt();bandView(!D3.band);};$('#bandv').onclick=()=>bandView(false);
$('#ppColor').setAttribute('aria-pressed',String(settings.ppColor!==false));
$('#ppColor').onclick=()=>{settings.ppColor=settings.ppColor===false;LS.set('settings',settings);$('#ppColor').setAttribute('aria-pressed',String(settings.ppColor!==false));toast(settings.ppColor!==false?'Color while popping: on (uses your current pencil)':'Color while popping: off (only raises / insets)');};
$('#popMode').onclick=e=>{const v=e.target&&e.target.dataset&&e.target.dataset.v;POP.pressed=v?v==='inset':!POP.pressed;POP.flat=false;if(tool!=='pop'&&tool!=='poppencil'&&mode==='free')setTool('poppencil');   // simple switch: Raise <-> Inset (Pop Erase flattens)
  settings.popMode=POP.pressed?'inset':'raised';LS.set('settings',settings);popUI();popRestyle();toast(POP.pressed?'Inset: press areas into the page':'Raise: lift areas off the page');};
$('#idea3d').onclick=()=>idea3d();$('#idea3dApply').onclick=idea3dApply;
$('#mixBtn').onclick=()=>{if(mode!=='free')setMode('free');setMix(!MIX.on);};$('#mixer .mxx').onclick=()=>setMix(false);
$('#ownUnlock').onclick=()=>{Object.values(ENT).forEach(e=>e.grant('owner-test'));ownerBar();toast('Owner test: everything unlocked on this device');};
$('#ownRelock').onclick=()=>{Object.values(ENT).forEach(e=>e.revoke());try{localStorage.removeItem('ep.trials.v1');}catch(e){}ownerBar();buildPalette();toast('Re-locked: testing as a buyer (free tries reset)');};
/* ---------- Show ideas (Free Color, optional): empty areas softly pulse a suggested colour. ‹ › switch idea sets
   (the scene's colour guide, then the palettes). Never locks anything; an area you colour stops pulsing. ---------- */
const IDEAS={on:settings.showIdeas===true,set:+settings.ideaSet||0};
function ideaSets(){return [{name:'Color guide',pal:S.pal}].concat(THEMES.map(t=>{const cs=t.colors.map(hex2rgb),lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
  const order=S.pal.map((c,i)=>[lum(c),i]).sort((a,b)=>a[0]-b[0]),th=cs.slice().sort((a,b)=>lum(a)-lum(b)),pal=[];
  order.forEach(([,i],k)=>pal[i]=th[Math.min(th.length-1,Math.round(k*(th.length-1)/Math.max(1,order.length-1)))]);return {name:t.name,pal};}));}
function renderIdeas(){const c=$('#ideasC'),bar=$('#ideasbar');if(!c||!S)return;bar.classList.toggle('on',IDEAS.on);$('#ideasTog').setAttribute('aria-pressed',String(IDEAS.on));
  if(!IDEAS.on||mode!=='free'){c.hidden=true;return;}const sets=ideaSets();IDEAS.set=((IDEAS.set%sets.length)+sets.length)%sets.length;const st=sets[IDEAS.set];$('#ideasName').textContent=st.name;
  if(c.width!==W){c.width=W;c.height=H;}const x=c.getContext('2d'),im=x.createImageData(W,H),D=im.data,fd=S.free.ctx.getImageData(0,0,W,H).data,unc=new Uint8Array(S.N);S.rc=S.rc||{};
  for(let r=1;r<S.N;r++){if(!S.num[r]||S.rc[r])continue;const i=((S.cy[r]|0)*W+(S.cx[r]|0))*4+3;if(fd[i]<40)unc[r]=1;}
  let any=0;for(let i=0;i<W*H;i++){const r=S.lab[i];if(!unc[r]||fd[i*4+3]>40)continue;const c2=st.pal[S.num[r]-1]||[200,200,200],j=i*4;D[j]=c2[0];D[j+1]=c2[1];D[j+2]=c2[2];D[j+3]=255;any++;}
  x.putImageData(im,0,0);c.hidden=false;S.ideasAny=any;}
function scheduleIdeas(){if(!IDEAS.on)return;clearTimeout(scheduleIdeas.t);scheduleIdeas.t=setTimeout(renderIdeas,350);}
function ideasSave(){settings.showIdeas=IDEAS.on;settings.ideaSet=IDEAS.set;LS.set('settings',settings);}
$('#ideasTog').onclick=()=>{IDEAS.on=!IDEAS.on;ideasSave();renderIdeas();toast(IDEAS.on?'Ideas on: empty areas softly show a suggested color':'Ideas off');};
$('#ideasPrev').onclick=()=>{IDEAS.set--;renderIdeas();ideasSave();};$('#ideasNext').onclick=()=>{IDEAS.set++;renderIdeas();ideasSave();};
$('#idea').onclick=previewIdea;$('#tryrow .tx').onclick=()=>$('#tryrow').hidden=true;$('#nudge .nx').onclick=()=>$('#nudge').hidden=true;
$('#saveLoop').onclick=saveLoop;
$('#setPrev').onclick=()=>flipSet(-1);$('#setNext').onclick=()=>flipSet(1);
$('#undo').onclick=undo;$('#clear').onclick=clearAll;$('#save').onclick=save;
$('#celebrate').onclick=()=>{$('#celebrate').hidden=true;};
window.addEventListener('resize',applyZoom);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}});

/* ---------- saving each scene's coloring ---------- */
const pend={};let saveT=0;
function dirty(kind){if(!S)return;if(kind==='free')try{scheduleIdeas();}catch(e){}if(S.ltAny&&(kind==='free'||kind==='cbn'))scheduleLineTint();if((kind==='free'||kind==='cbn')&&!linesDefault(S.lines))scheduleLines();if(kind==='cbn')linesDoneGlow();if(kind==='free'||kind==='pulse')S.envDirty=true;if(kind==='pp')S.ppV=(S.ppV||0)+1;if(kind==='pulse'){const sl=$('#saveLoop');if(sl)sl.hidden=!(S.pulseUsed&&mode==='free');}pend[S.n]=pend[S.n]||{};pend[S.n][kind]=1;clearTimeout(saveT);saveT=setTimeout(saveNow,1500);}
function saveNow(){clearTimeout(saveT);
  for(const k of Object.keys(pend)){const st=cache[k];if(!st){delete pend[k];continue;}const p=pend[k];
    if(p.cbn){const ids=[];for(let r=1;r<st.N;r++)if(st.cbn.filled[r])ids.push(r);ids.length?LS.set('cbn.'+k,ids.join(',')):LS.del('cbn.'+k);}
    if(p.free&&st.rc)LS.set('rc.'+k,st.rc);
    if(p.free){let any=false;const d=st.free.ctx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
      if(any){const url=st.free.c.toDataURL('image/png');   // lossless: a reload shows exactly what was painted
      if(!LS.set('free.'+k,url))toast('Storage is full: free coloring not saved');}else LS.del('free.'+k);}
    if(p.pulse&&st.pulse){let any=false;const d=st.pulse.ctx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=64)if(d[i]){any=true;break;}
      if(any){const url=st.pulse.c.toDataURL('image/png');LS.set('pulse.'+k,url);}else LS.del('pulse.'+k);}
    if(p.pop)savePops(st);
    if(p.fx)saveFx(st); if(p.pp)savePP(st);
    const t=document.createElement('canvas');t.width=320;t.height=180;const x=t.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,320,180);
    const cur=S&&S.n==k, src=cur?(mode==='free'?st.free.c:st.cbn.c):(p.free&&!p.cbn?st.free.c:st.cbn.c);
    x.drawImage(src,0,0,320,180); if(cur&&lineImg.complete&&lineImg.naturalWidth)x.drawImage(lineImg,0,0,320,180);
    LS.set('thumb.'+k,t.toDataURL('image/jpeg',.72));delete pend[k];idbSave(+k);}
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
  st.pops=LS.get('pop.'+st.n,[]);st.rc=LS.get('rc.'+st.n,{});st.flat3d=LS.get('flat3d.'+st.n,[]);st.lines=LS.get('lines.'+st.n,null);
  await loadFx(st); await loadPP(st);
}
/* ---------- autosave: each scene's work (colours, effect layers, pop / inset heights, Pop Pencil, line settings) is also kept
   in IndexedDB with a versioned format and the last 3 snapshots per scene, so an app update or a full localStorage never
   loses work. localStorage stays the fast path; IndexedDB restores anything missing on start. ---------- */
const SAVE_FORMAT=2,SCENE_KEYS=['cbn','free','pulse','pop','rc','flat3d','fx','pp','thumb','lines'];
const IDB={db:null,ready:null,
  open(){if(this.ready)return this.ready;this.ready=new Promise(res=>{try{const q=indexedDB.open('emberpost-save',1);
    q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('scenes'))db.createObjectStore('scenes',{keyPath:'n'});};
    q.onsuccess=()=>{this.db=q.result;res(this.db);};q.onerror=()=>res(null);q.onblocked=()=>res(null);}catch(e){res(null);}});return this.ready;},
  async all(){const db=await this.open();if(!db)return [];return new Promise(res=>{try{const q=db.transaction('scenes').objectStore('scenes').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([]);}catch(e){res([]);}});},
  async get(n){const db=await this.open();if(!db)return null;return new Promise(res=>{try{const q=db.transaction('scenes').objectStore('scenes').get(n);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});},
  async put(rec){const db=await this.open();if(!db)return false;return new Promise(res=>{try{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').put(rec);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);}catch(e){res(false);}});},
  async clear(){const db=await this.open();if(!db)return;return new Promise(res=>{try{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').clear();tx.oncomplete=tx.onerror=()=>res();}catch(e){res();}});}};
function migrateSave(rec){ // older formats -> current. format 1 = the plain localStorage keys (v6 .. v8), kept as-is
  if(!rec||typeof rec!=='object')return null;if(!rec.format)rec.format=1;
  if(!Array.isArray(rec.snaps))rec.snaps=rec.keys?[{t:rec.t||0,build:rec.build||0,keys:rec.keys}]:[];
  rec.snaps=rec.snaps.filter(s=>s&&s.keys&&typeof s.keys==='object');rec.format=SAVE_FORMAT;return rec;}
function sceneKeys(n){const o={};for(const k of SCENE_KEYS){const key='ep.v1.'+k+'.'+n;let v=null;try{v=localStorage.getItem(key);}catch(e){}if(v==null&&key in LSMEM)v=LSMEM[key];if(v!=null)o[k]=v;}return o;}
const idbLast={};
async function idbSave(n,force){const keys=sceneKeys(n),sig=Object.keys(keys).map(k=>k+':'+keys[k].length+':'+keys[k].slice(-48)).join('|');
  if(!force&&idbLast[n]===sig)return false;const rec=migrateSave(await IDB.get(n))||{n,format:SAVE_FORMAT,snaps:[]};
  if(rec.snaps[0]&&rec.snaps[0].sig===sig){idbLast[n]=sig;return false;}
  rec.snaps.unshift({t:Date.now(),build:EP_BUILD,sig,keys});rec.snaps=rec.snaps.slice(0,3);rec.n=n;rec.t=Date.now();rec.build=EP_BUILD;
  const ok=await IDB.put(rec);if(ok){idbLast[n]=sig;savedBlip();}return ok;}
async function idbHydrate(){ // on start: bring back anything localStorage lost (cleared, full, or an old release wrote elsewhere)
  const recs=await IDB.all();let restored=0;
  for(const r0 of recs){const rec=migrateSave(r0);if(!rec||!rec.snaps.length)continue;const snap=rec.snaps[0];
    let any=0;for(const [k,v] of Object.entries(snap.keys)){const key='ep.v1.'+k+'.'+rec.n;let has=false;try{has=localStorage.getItem(key)!=null;}catch(e){}if(has)continue;   // localStorage copy wins when present
      try{localStorage.setItem(key,v);}catch(e){LSMEM[key]=v;}any=1;}restored+=any;}
  if(restored)console.info('Restored',restored,'scene(s) from the autosave');return restored;}
function savedBlip(){const e=$('#savedInd');if(!e)return;e.classList.add('show');clearTimeout(savedBlip.t);savedBlip.t=setTimeout(()=>e.classList.remove('show'),1400);}
setInterval(()=>{if(document.hidden||!S)return;if(Object.keys(pend).length)saveNow();else idbSave(S.n);},20000);
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
    list:[['5 jewels','ruby, emerald, sapphire, amethyst, topaz with a living shimmer'],['5 metallics','gold, silver, copper, rose gold, bronze'],['5 chromes','mirror bands and sharp highlights'],['6 glitters','with real sparkle'],['5 neons + 5 glows','outer glow and soft light halos'],['5 pulse colors','gently breathe in the app'],['2 brushes','soft airbrush and watercolor wash']]},
  palettes:{kicker:'✦ Palettes',title:'Unlock All Palettes',sub:'Eight themed pencil palettes to flip through with the arrows above your pencils.',
    list:THEMES.map(t=>[t.name,t.colors.length+' pencils'])},
  effects3d:{kicker:'✦ 3D',title:'Unlock 3D',sub:'Paint depth with the Pop Pencil: every pass lifts a little more (or presses in), with soft light and shadow. Pop Erase flattens, and the 3D idea shows a ready-made look for each page.',
    list:[['Pop Pencil','Raise or Inset, a little more each pass'],['Pop Erase','flatten any part'],['3D idea','preview a 3D look, then apply it'],['Saved pictures','the depth is baked into PNGs']]},
  smoke:{kicker:'✦ Smoke Pencils',title:'Unlock Smoke Pencils',sub:'Soft smoky color with wisps that slowly drift and curl above what you paint.',
    list:[['5 smoke colors','charcoal, ash, ember, violet, teal'],['Living wisps','drift gently in the app'],['Mix-ready','use smoke as the particles in a Mix']]},
  gradients:{kicker:'✦ Rainbow & Gradients',title:'Unlock Rainbow & Gradient Pencils',sub:'Colour runs along your stroke through a gradient, and slowly shifts back and forth in the app.',
    list:[['Rainbow + 8 ramps','tropical, ocean, fire, sunset, aurora, cyber, vaporwave, miami'],['3 metal ramps','gold, chrome, copper'],['Color shift','the gradient gently flows through each stroke']]},
  clouds:{kicker:'✦ Cloud Pencils',title:'Unlock Cloud Pencils',sub:'Fluffy, airy color with soft cloud puffs that billow slowly over your picture.',
    list:[['5 cloud colors','white, dawn, storm, sky, gold'],['Billowing puffs','move slowly in the app'],['Mix-ready','use clouds as the particles in a Mix']]}};
function drawPreview(key){const cv0=$('#upPreview');for(const o of [...PVS])if(o.cv===cv0)PVS.delete(o);productPreview(cv0,key,$('#upgrade').dataset.from);}
function drawPreviewStatic(key){
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
for(const key of ['pencils','palettes','effects3d','smoke','clouds','gradients']){const row=$(`#set_${key}`);if(row&&!row.querySelector('canvas')){const cv=pvCanvas('rowpv',150,40);row.insertBefore(cv,row.querySelector('b'));productPreview(cv,key);}}
$('#setRedeem').onclick=async()=>{const r=await redeemCode($('#setCode').value,'pencils'),m=$('#setMsg');m.textContent=r.msg;m.className='up-msg '+(r.ok?'ok':'bad');
  if(r.ok){$('#setCode').value='';refreshPremiumUI();toast((r.key==='all'?'Everything':ENT[r.key].P.productName)+' unlocked ✦');}};
$('#setCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#setRedeem').click();});
for(const key of ['pencils','palettes','effects3d','smoke','clouds','gradients'])$(`#set_${key}`).onclick=()=>{const e=ENT[key];
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
  d3:()=>({on:D3.on,want:D3.want,band:D3.band,relief:!!(S&&S.relief)}), depth:()=>depthOf(S), tilt:(x,y)=>{tilt={x,y};D3.lastMove=performance.now();popParallax();},
  canvasToClient:(x,y)=>{const r=zoomer.getBoundingClientRect();return [r.left+x*r.width/W,r.top+y*r.height/H];},
  leakCheck:()=>{ // every filled CBN pixel must belong to a filled region
    const D=S.cbn.img.data;let bad=0;for(let i=0;i<W*H;i++)if(D[i*4+3]&&!S.cbn.filled[S.lab[i]])bad++;return bad;},
  premium:()=>({unlocked:Premium.unlocked(),state:Premium.state(),mode:PCFG.mode,ink:Object.assign({},ink),tool}),
  progress:()=>JSON.parse(JSON.stringify(prog)), settings:()=>Object.assign({},settings),
  saved:(n)=>({cbn:(LS.get('cbn.'+n,'')||'').split(',').filter(Boolean).length,free:!!LS.get('free.'+n,null)}),
  paintedFree:()=>{const d=S.free.ctx.getImageData(0,0,W,H).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;},
  rampAt:(x,y)=>{const r=(S.fx||[]).find(q=>q.kind==='rampfx');if(!r||!r.oc||!r.bb)return null;const d=r.oc.getContext('2d').getImageData((x|0)-r.bb[0],(y|0)-r.bb[1],1,1).data;return [d[0],d[1],d[2],d[3]];},
  fx:()=>({n:(S.fx||[]).length,kinds:(S.fx||[]).map(r=>r.kind),ms:Math.round(fxMs*10)/10,each:(S.fx||[]).map(r=>Math.round((r.ms||0)*10)/10),parts:fxTotal,running:!!fxRaf,rm:RM.matches}),
  pp:()=>({any:!!(S.pp&&S.pp.any),active:!!pps}), mix:()=>({...MIX}), owner:()=>ownerMode(), pvCount:()=>PVS.size,
  ppHeight:(x,y)=>{if(!S.pp)return 0;const a=S.pp.rx.getImageData(x|0,y|0,1,1).data[3],b=S.pp.ix.getImageData(x|0,y|0,1,1).data[3];return (a-b)/255;},
  tipNames:()=>SETS.map((t,ti)=>({id:t.id,names:(t.type==='plain'?t.colors.map(h=>({dataset:{c:h},classList:{contains:c=>c==='pencil'}})):t.items.map(p=>({dataset:{p:p.id},classList:{contains:()=>false}}))).map(el=>{const o=setIdx;setIdx=ti;const d=tipFor(el);setIdx=o;return d&&d[0]+' | '+d[1];})})),
  lines:()=>({...linesOf(S),under:!$('#lineUnder').hidden,col:!$('#lineCol').hidden,op:lineImg.style.opacity,vfill:(vline.querySelector('path')||{getAttribute:()=>null}).getAttribute('fill'),vauto:!!vline.querySelector('#vauto'),hist:(S.linesHist||[]).length,saved:LS.get('lines.'+S.n,null)}),
  composite:()=>composite().toDataURL('image/png').length, compositeAt:(x,y)=>{const d=composite().getContext('2d').getImageData(x|0,y|0,1,1).data;return [d[0],d[1],d[2],d[3]];},
  regionType:r=>regionType(r),
  fillAllOf:(k)=>{for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r])fillCBN(r);},
};

/* ---------- boot ---------- */
setInkPattern(); buildScenes(); applySettingsUI(); handleReturn(); ownerBar();
{const go=()=>{const start=(prog.current&&isUnlocked(prog.current)&&IDS.includes(prog.current))?prog.current:IDS[0];
 if(start)showScene(start); else $('#scap').textContent='No scene data found.';};
 Promise.race([idbHydrate().catch(()=>0),new Promise(r=>setTimeout(r,1500))]).then(go);}
window.EP_OK=true;try{sessionStorage.removeItem('ep.heal');}catch(e){}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadCtl||reloaded)return;reloaded=true;   // a new release took over: reload once so page + scripts match
    if(!S||!(S.free&&S.free.undo&&S.free.undo.length))location.reload();else toast('App updated · it will use the new version next time you open it');});
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update().catch(()=>0)).catch(err=>console.warn('SW not registered',err)));}
})();
