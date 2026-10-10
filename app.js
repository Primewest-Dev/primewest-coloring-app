/* The Last Ember Post · Coloring (prototype). Plain JS, no dependencies, works offline and from file://. */
(()=>{
'use strict';
/* ---------- build check: index.html, app.js and the config must come from the same release. If an old cached page is
   paired with this script (or the reverse), clear the offline cache once and reload fresh instead of breaking. ---------- */
const EP_BUILD=24;
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
const isUnlocked=n=>!settings.story||prog.unlocked.includes(n)||!!(CHM[n]&&CHM[n].free);   /* v16: bonus pages are always open */
const chName=n=>(CHM[n]&&CHM[n].label)||('Chapter '+n);
const isDone=n=>prog.done.includes(n);
const nextOf=n=>{const L=IDS.filter(k=>!(CHM[k]&&CHM[k].bonus)),i=L.indexOf(n);return i>=0&&i<L.length-1?CHM[L[i+1]]:null;};
const W=1600,H=900;
const EXTRA=['#1f1d22','#2b2320','#5a3a2a','#8b5a3c','#c47f4a','#e3b36b','#f2d38a','#f6e7c1','#ffcf9f','#e98a6a','#c9473d','#8e1f2c',
             '#6b2a4f','#a0579a','#6c5ba7','#3b3f8f','#2f6db5','#5aa7d6','#9fd3e0','#2f8a7e','#4c9a5b','#9cc36b','#3e5b34','#7d8c96'];
const PENCIL_R=[3,6.5,12], ERASER_R=[8,16,30];
/* v20: one smooth pen-tip size (1 = hair-thin ... 60 = very thick), shared by Pencil, brushes, Eraser, Pop Pencil and the Line pencil */
const penR=()=>Math.max(.5,penSize/2), eraR=()=>Math.max(2,penSize*1.25), ppR=()=>Math.max(3,penSize*1.25);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const app=$('#app'), stage=$('#stage'), zoomer=$('#zoomer'), layers=$('#layers'), lineImg=$('#line');
const strokeC=$('#stroke'), dimC=$('#dim'), glowC=$('#glow'), numC=$('#nums');
const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c};
[strokeC,dimC,glowC,numC].forEach(c=>{c.width=W;c.height=H});
const sctx=strokeC.getContext('2d'), dctx=dimC.getContext('2d'), gctx=glowC.getContext('2d'), nctx=numC.getContext('2d');
const covC=mk(), cov=covC.getContext('2d'), maskC=mk(), mctx=maskC.getContext('2d');
let mode='free', tool='pencil', penSize=Math.max(1,Math.min(60,+settings.penSize||13)), clip=settings.lineLock!==false, color=EXTRA[10], S=null, selNum=1;
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
  {id:'c-red',kind:'chrome',hex:'#d8434b',name:'Chrome ruby'},{id:'c-orange',kind:'chrome',hex:'#f08a3c',name:'Chrome tangerine'},{id:'c-green',kind:'chrome',hex:'#3fae6a',name:'Chrome jade'},
  {id:'c-teal',kind:'chrome',hex:'#2fb3b8',name:'Chrome lagoon'},{id:'c-violet',kind:'chrome',hex:'#8a5ad8',name:'Chrome violet'},{id:'c-pink',kind:'chrome',hex:'#ef6fae',name:'Chrome pink'},{id:'c-copper',kind:'chrome',hex:'#c47a4a',name:'Chrome copper'},
  {id:'w-amber',kind:'glow',hex:'#ffb347',name:'Lantern glow'},{id:'w-rose',kind:'glow',hex:'#ff7a9c',name:'Rose glow'},
  {id:'w-mint',kind:'glow',hex:'#7dffc4',name:'Mint glow'},{id:'w-sky',kind:'glow',hex:'#7cc8ff',name:'Sky glow'},
  {id:'w-violet',kind:'glow',hex:'#c79bff',name:'Violet glow'},
  {id:'tw-oak',kind:'wood',hex:'#b98a52',tex:'oak',name:'Oak'},{id:'tw-walnut',kind:'wood',hex:'#6b4428',tex:'walnut',name:'Walnut'},
  {id:'tw-cherry',kind:'wood',hex:'#9c4f35',tex:'cherry',name:'Cherry'},{id:'tw-pine',kind:'wood',hex:'#d9b27a',tex:'pine',name:'Pine'},
  {id:'tw-maple',kind:'wood',hex:'#e3c58f',tex:'maple',name:'Maple'},{id:'tw-drift',kind:'wood',hex:'#a59a8c',tex:'drift',name:'Driftwood'},
  {id:'tb-red',kind:'brick',hex:'#a8432f',tex:'red',name:'Red brick'},{id:'tb-tan',kind:'brick',hex:'#c9a06d',tex:'tan',name:'Tan brick'},{id:'tb-white',kind:'brick',hex:'#e8e2d6',tex:'white',name:'White brick'},
  {id:'ts-slate',kind:'stone',hex:'#5f6770',tex:'slate',name:'Slate'},{id:'ts-granite',kind:'stone',hex:'#9a958f',tex:'granite',name:'Granite'},
  {id:'ts-sand',kind:'stone',hex:'#d2b48a',tex:'sand',name:'Sandstone'},{id:'ts-marble',kind:'stone',hex:'#ece8e2',tex:'marble',name:'Marble'},{id:'ts-cobble',kind:'stone',hex:'#8d8378',tex:'cobble',name:'Cobblestone'},
  {id:'tf-blossom',kind:'flower',hex:'#f4b6c8',tex:'blossom',name:'Blossom'},{id:'tf-daisy',kind:'flower',hex:'#f3d65a',tex:'daisy',name:'Daisy'},
  {id:'tf-lavender',kind:'flower',hex:'#b9a3dd',tex:'lavender',name:'Lavender'},{id:'tf-forget',kind:'flower',hex:'#8fb8e8',tex:'forget',name:'Forget-me-not'},
  {id:'tf-rose',kind:'flower',hex:'#d9495b',tex:'rose',name:'Rose'},{id:'tf-mint',kind:'flower',hex:'#9fd8b8',tex:'mint',name:'Mint sprig'},
  {id:'fh-short',kind:'fur',hex:'#d9822b',tex:'short',name:'Short fur'},{id:'fh-long',kind:'fur',hex:'#f1e3c6',tex:'long',name:'Long fur'},
  {id:'fh-straight',kind:'fur',hex:'#e8cf8f',tex:'straight',name:'Straight hair'},{id:'fh-wavy',kind:'fur',hex:'#7b4526',tex:'wavy',name:'Wavy hair'},{id:'fh-curly',kind:'fur',hex:'#1e1b1a',tex:'curly',name:'Curly hair'},
  {id:'l-white',kind:'lightning',hex:'#cfe6ff',name:'White lightning'},{id:'l-blue',kind:'lightning',hex:'#3f9bff',name:'Blue lightning'},
  {id:'l-violet',kind:'lightning',hex:'#a45cff',name:'Violet lightning'},{id:'l-pink',kind:'lightning',hex:'#ff4fb8',name:'Pink lightning'},
  {id:'l-red',kind:'lightning',hex:'#ff3b3b',name:'Red lightning'},{id:'l-orange',kind:'lightning',hex:'#ff951f',name:'Orange lightning'},
  {id:'l-gold',kind:'lightning',hex:'#ffd21f',name:'Gold lightning'},{id:'l-green',kind:'lightning',hex:'#3dff7a',name:'Green lightning'},
  {id:'l-cyan',kind:'lightning',hex:'#27f0ff',name:'Cyan lightning'},
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
  /* v24: every effect set filled out to ~13 colors across the full range */
  {id:'m-ruby',kind:'metal',hex:'#b0303a',name:'Ruby metal'},{id:'m-sunset',kind:'metal',hex:'#d9752f',name:'Sunset copper'},{id:'m-brass',kind:'metal',hex:'#c2a83e',name:'Brass'},{id:'m-emerald',kind:'metal',hex:'#2f8a5a',name:'Emerald metal'},{id:'m-teal',kind:'metal',hex:'#2e8b8b',name:'Teal metal'},{id:'m-sapphire',kind:'metal',hex:'#3060b0',name:'Sapphire metal'},{id:'m-violet',kind:'metal',hex:'#7a4ab0',name:'Violet metal'},{id:'m-pink',kind:'metal',hex:'#d47aa0',name:'Pink metal'},{id:'m-black',kind:'metal',hex:'#2b2e33',name:'Gunmetal'},{id:'m-platinum',kind:'metal',hex:'#e5e4e2',name:'Platinum'},{id:'g-ruby',kind:'glitter',hex:'#d42a3c',name:'Ruby glitter'},{id:'g-tangerine',kind:'glitter',hex:'#f2862e',name:'Tangerine glitter'},{id:'g-lemon',kind:'glitter',hex:'#f2dc3a',name:'Lemon glitter'},{id:'g-lime',kind:'glitter',hex:'#9ad83a',name:'Lime glitter'},{id:'g-teal',kind:'glitter',hex:'#2fb8b0',name:'Teal glitter'},{id:'g-pink',kind:'glitter',hex:'#ff7ac8',name:'Pink glitter'},{id:'g-black',kind:'glitter',hex:'#2a2a35',name:'Black glitter'},{id:'n-red',kind:'neon',hex:'#ff3b4e',name:'Neon red'},{id:'n-yellow',kind:'neon',hex:'#fff23a',name:'Neon yellow'},{id:'n-green',kind:'neon',hex:'#39ff6a',name:'Neon green'},{id:'n-teal',kind:'neon',hex:'#2affd5',name:'Neon teal'},{id:'n-blue',kind:'neon',hex:'#3b7bff',name:'Neon blue'},{id:'n-magenta',kind:'neon',hex:'#ff2bd6',name:'Neon magenta'},{id:'n-white',kind:'neon',hex:'#f4fbff',name:'Neon white'},{id:'n-gold',kind:'neon',hex:'#ffcc33',name:'Neon gold'},{id:'w-ember',kind:'glow',hex:'#ff6a5a',name:'Ember glow'},{id:'w-sun',kind:'glow',hex:'#ffe066',name:'Sun glow'},{id:'w-lime',kind:'glow',hex:'#c6ff6b',name:'Lime glow'},{id:'w-teal',kind:'glow',hex:'#5ff0e0',name:'Teal glow'},{id:'w-blue',kind:'glow',hex:'#6f8cff',name:'Blue glow'},{id:'w-pink',kind:'glow',hex:'#ff9de0',name:'Pink glow'},{id:'w-white',kind:'glow',hex:'#fff7ea',name:'Candle white'},{id:'w-gold',kind:'glow',hex:'#ffd27a',name:'Gold glow'},{id:'p-red',kind:'pulse',hex:'#ff3d4a',name:'Red pulse'},{id:'p-lemon',kind:'pulse',hex:'#fff04a',name:'Lemon pulse'},{id:'p-lime',kind:'pulse',hex:'#b6ff3b',name:'Lime pulse'},{id:'p-green',kind:'pulse',hex:'#4dff8a',name:'Green pulse'},{id:'p-blue',kind:'pulse',hex:'#3f7bff',name:'Blue pulse'},{id:'p-purple',kind:'pulse',hex:'#a24bff',name:'Purple pulse'},{id:'p-pink',kind:'pulse',hex:'#ff7ab8',name:'Pink pulse'},{id:'p-white',kind:'pulse',hex:'#f6f8ff',name:'White pulse'},{id:'j-fireopal',kind:'jewel',hex:'#ff6a2a',name:'Fire opal'},{id:'j-citrine',kind:'jewel',hex:'#f5d000',name:'Citrine'},{id:'j-peridot',kind:'jewel',hex:'#9acd32',name:'Peridot'},{id:'j-aqua',kind:'jewel',hex:'#5fd4d0',name:'Aquamarine'},{id:'j-tanzanite',kind:'jewel',hex:'#4b3fb5',name:'Tanzanite'},{id:'j-pinksap',kind:'jewel',hex:'#e8508f',name:'Pink sapphire'},{id:'j-diamond',kind:'jewel',hex:'#e8f4ff',name:'Diamond'},{id:'j-onyx',kind:'jewel',hex:'#23232b',name:'Onyx'},{id:'l-lime',kind:'lightning',hex:'#b6ff3b',name:'Lime lightning'},{id:'l-magenta',kind:'lightning',hex:'#ff3bf0',name:'Magenta lightning'},{id:'l-indigo',kind:'lightning',hex:'#5b5bff',name:'Indigo lightning'},{id:'l-ice',kind:'lightning',hex:'#e6f7ff',name:'Ice lightning'},{id:'s-crimson',kind:'smoke',hex:'#a33a44',name:'Crimson smoke'},{id:'s-amber',kind:'smoke',hex:'#c99a3e',name:'Amber smoke'},{id:'s-gold',kind:'smoke',hex:'#c8a84e',name:'Gold smoke'},{id:'s-moss',kind:'smoke',hex:'#6f8a4a',name:'Moss smoke'},{id:'s-ocean',kind:'smoke',hex:'#4a6fa5',name:'Ocean smoke'},{id:'s-rose',kind:'smoke',hex:'#c48aa0',name:'Rose smoke'},{id:'s-ivory',kind:'smoke',hex:'#e8e2d4',name:'Ivory smoke'},{id:'s-ink',kind:'smoke',hex:'#2d3350',name:'Ink smoke'},{id:'k-sunset',kind:'cloud',hex:'#f4a59a',name:'Sunset cloud'},{id:'k-peach',kind:'cloud',hex:'#ffcfa8',name:'Peach cloud'},{id:'k-lemon',kind:'cloud',hex:'#fff1b0',name:'Lemon cloud'},{id:'k-mint',kind:'cloud',hex:'#c8f2dc',name:'Mint cloud'},{id:'k-teal',kind:'cloud',hex:'#a8e6e0',name:'Teal cloud'},{id:'k-lavender',kind:'cloud',hex:'#d4c8f2',name:'Lavender cloud'},{id:'k-lilac',kind:'cloud',hex:'#f2c8ec',name:'Lilac cloud'},{id:'k-night',kind:'cloud',hex:'#5a6a8f',name:'Midnight cloud'},{id:'c-yellow',kind:'chrome',hex:'#e8d23a',name:'Chrome lemon'},{id:'tw-mahogany',kind:'wood',hex:'#7a3a2a',tex:'cherry',name:'Mahogany'},{id:'tw-teak',kind:'wood',hex:'#a8723c',tex:'oak',name:'Teak'},{id:'tw-ebony',kind:'wood',hex:'#2e2420',tex:'walnut',name:'Ebony'},{id:'tw-birch',kind:'wood',hex:'#ead9b8',tex:'maple',name:'Birch'},{id:'tw-pred',kind:'wood',hex:'#a8463a',tex:'drift',name:'Painted red'},{id:'tw-pblue',kind:'wood',hex:'#4a6fa5',tex:'drift',name:'Painted blue'},{id:'tw-pgreen',kind:'wood',hex:'#5a8a5a',tex:'drift',name:'Painted green'},{id:'tb-brown',kind:'brick',hex:'#7a4a32',tex:'red',name:'Brown brick'},{id:'tb-orange',kind:'brick',hex:'#c8683a',tex:'red',name:'Orange brick'},{id:'tb-burgundy',kind:'brick',hex:'#6e2a2e',tex:'red',name:'Burgundy brick'},{id:'tb-yellow',kind:'brick',hex:'#d9b24a',tex:'tan',name:'Yellow brick'},{id:'tb-sand',kind:'brick',hex:'#d8c09a',tex:'tan',name:'Sand brick'},{id:'tb-grey',kind:'brick',hex:'#8a8a8a',tex:'white',name:'Grey brick'},{id:'tb-charcoal',kind:'brick',hex:'#4a4a50',tex:'white',name:'Charcoal brick'},{id:'tb-pink',kind:'brick',hex:'#d48a8a',tex:'white',name:'Pink brick'},{id:'tb-blue',kind:'brick',hex:'#5a7aa5',tex:'white',name:'Blue painted brick'},{id:'tb-green',kind:'brick',hex:'#5a8a6a',tex:'white',name:'Green painted brick'},{id:'ts-basalt',kind:'stone',hex:'#3a3d42',tex:'slate',name:'Basalt'},{id:'ts-greenslate',kind:'stone',hex:'#4a5f55',tex:'slate',name:'Green slate'},{id:'ts-blueslate',kind:'stone',hex:'#4a5a70',tex:'slate',name:'Blue slate'},{id:'ts-redrock',kind:'stone',hex:'#a8553a',tex:'sand',name:'Red rock'},{id:'ts-goldsand',kind:'stone',hex:'#d9b45a',tex:'sand',name:'Gold sandstone'},{id:'ts-jade',kind:'stone',hex:'#5a9a7a',tex:'marble',name:'Jade stone'},{id:'ts-rosemarble',kind:'stone',hex:'#e8c4c4',tex:'marble',name:'Rose marble'},{id:'ts-lapis',kind:'stone',hex:'#2f4f9a',tex:'granite',name:'Lapis'},{id:'tf-poppy',kind:'flower',hex:'#e0453a',tex:'rose',name:'Poppy'},{id:'tf-sunflower',kind:'flower',hex:'#f29a2e',tex:'daisy',name:'Sunflower'},{id:'tf-gold',kind:'flower',hex:'#e8c24a',tex:'daisy',name:'Buttercup'},{id:'tf-leaf',kind:'flower',hex:'#6fa85a',tex:'mint',name:'Green sprig'},{id:'tf-teal',kind:'flower',hex:'#5ac8c0',tex:'forget',name:'Teal bloom'},{id:'tf-violet',kind:'flower',hex:'#8a5ad8',tex:'lavender',name:'Violet'},{id:'tf-white',kind:'flower',hex:'#f6f4ee',tex:'blossom',name:'White blossom'},{id:'fh-red',kind:'fur',hex:'#a8402a',tex:'wavy',name:'Red fur'},{id:'fh-blonde',kind:'fur',hex:'#f0d48a',tex:'straight',name:'Blonde hair'},{id:'fh-brown',kind:'fur',hex:'#6a4428',tex:'short',name:'Brown fur'},{id:'fh-grey',kind:'fur',hex:'#8a8a8a',tex:'short',name:'Grey fur'},{id:'fh-white',kind:'fur',hex:'#f4f0e8',tex:'long',name:'White fur'},{id:'fh-black',kind:'fur',hex:'#1a1818',tex:'straight',name:'Black hair'},{id:'fh-blue',kind:'fur',hex:'#4a6fb5',tex:'short',name:'Blue fur'},{id:'fh-pink',kind:'fur',hex:'#f29ac0',tex:'long',name:'Pink fur'},
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
/* v23: tapered loop: each pass starts slow, builds, ends slow (smoothstep on the loop phase) and fades in/out at the loop ends, so nothing snaps */
function lightPulseE(d,t,speed,count,dir){let best=0;for(let p=0;p<count;p++){const u=((t*speed)+p/count)%1;let pos=u*u*(3-2*u);if(dir==='reverse')pos=1-pos;else if(dir==='bounce')pos=pos<.5?pos*2:2-pos*2;
  const e=d-pos,env=Math.sin(Math.PI*u);best=Math.max(best,Math.exp(-e*e*24)*env);}return best;}
const RAMP_WAVE={rainbow:'sawtooth',aurora:'smooth',cyber:'triangle',vaporwave:'smooth',miami:'triangle'};
const RAMP_LUT={};function rampLUT(k){if(RAMP_LUT[k])return RAMP_LUT[k];const cs=(RAMPS[k]||METAL[k]||RAMPS.rainbow).map(hex2rgb),L=new Uint8ClampedArray(256*3);
  for(let i=0;i<256;i++){const pos=Math.min(.9999,i/255)*(cs.length-1),j=pos|0,f=pos-j,a=cs[j],b=cs[j+1];for(let c=0;c<3;c++)L[i*3+c]=a[c]+(b[c]-a[c])*f;}return RAMP_LUT[k]=L;}
const rampRgb=(k,t)=>{const L=rampLUT(k),i=Math.max(0,Math.min(255,Math.round(t*255)))*3;return [L[i],L[i+1],L[i+2]];};
const pingpong=t=>{t-=Math.floor(t);return t<.5?t*2:2-t*2;};
const RAMP_LEN=320;   // px of stroke per full run through the ramp
for(const [k,n] of [['rainbow','Rainbow'],['tropical','Tropical'],['ocean','Ocean'],['fire','Fire'],['sunset','Sunset'],['aurora','Aurora'],['cyber','Cyber'],['vaporwave','Vaporwave'],
  ['miami','Miami'],['gold','Gold ramp'],['chrome','Chrome ramp'],['copper','Copper ramp']])PREMIUM.splice(PREMIUM.length-2,0,{id:'r-'+k,kind:'ramp',ramp:k,hex:RAMPS[k][Math.floor(RAMPS[k].length/2)],name:n});
const PREM={};PREMIUM.forEach(p=>PREM[p.id]=p);
PREM['c-any']={id:'c-any',kind:'chrome',hex:'#d9dde3',name:'Chrome finish'};
const ANY_KINDS={metal:'Metallic',chrome:'Chrome',glitter:'Glitter',jewel:'Jewel',neon:'Neon',lightning:'Lightning',wood:'Wood',brick:'Brick',stone:'Stone',flower:'Flowers',fur:'Fur & Hair',glow:'Glowing',pulse:'Pulse',smoke:'Smoke',cloud:'Cloud'};
for(const k in ANY_KINDS)if(k!=='chrome')PREM['any-'+k]={id:'any-'+k,kind:k,hex:'#ffffff',name:ANY_KINDS[k]+' finish'};
const anyId=k=>k==='chrome'?'c-any':'any-'+k;   // Chrome finish: any colour, as chrome (not a pencil of its own)
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
/* ---------- v14 texture pencils: a flat colour plus a subtle, small pattern that is anchored to the page (a 256 px seamless tile,
   so neighbouring strokes and fills line up), contained in the lines like any colour. Wood, brick, stone and flowers. ---------- */
const TEXK=new Set(['wood','brick','stone','flower','fur']),TEXDEF={wood:'oak',brick:'red',stone:'granite',flower:'blossom',fur:'short'};
/* v15 Fur & Hair: the style (short / long fur, straight / wavy / curly hair) stays with the last fur pencil picked, so Any color keeps it */
let furStyle=(()=>{try{return JSON.parse(localStorage.getItem('ep-furStyle'))||'short';}catch(_){return 'short';}})();
const FURPAL=['#f3e0a6','#e8cf8f','#d9a441','#d9822b','#c0642a','#f1e3c6','#e9d9bf','#c8a27a','#a0714a','#7b4526','#5a3521','#3b2518','#1e1b1a','#2e2c2b','#4d4d50','#8a8a8e','#b3b4b8','#d6d7da','#f7f5f0'];
const texVariant=(k,hex)=>{if(k==='fur')return furStyle;const p=PREMIUM.find(q=>q.kind===k&&q.hex===hex);return p&&p.tex||TEXDEF[k];};
function pnoise(seed,cx,cy){cy=cy||cx;const g=new Float32Array((cx+1)*(cy+1));for(let j=0;j<=cy;j++)for(let i=0;i<=cx;i++)g[j*(cx+1)+i]=hash2((i%cx)*31+seed*101,(j%cy)*17+seed*7);
  const sx=256/cx,sy=256/cy;return (x,y)=>{x=((x%256)+256)%256;y=((y%256)+256)%256;const fx=x/sx,fy=y/sy,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty),q=(a,b)=>g[b*(cx+1)+a];
    return (q(ix,iy)*(1-u)+q(ix+1,iy)*u)*(1-v)+(q(ix,iy+1)*(1-u)+q(ix+1,iy+1)*u)*v;};}
/* v16: page-size textures never repeat. Value noise on an unbounded hashed lattice (same cell sizes as the small preview tiles) */
function bnoise(seed,sx,sy){sy=sy||sx;return (x,y)=>{const fx=x/sx,fy=y/sy,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty),q=(a,b)=>hash2(a*31+seed*101,b*17+seed*7+99991);
    return (q(ix,iy)*(1-u)+q(ix+1,iy)*u)*(1-v)+(q(ix,iy+1)*(1-u)+q(ix+1,iy+1)*u)*v;};}
const TEXCACHE={},TEXBIG=[];
function bigCache(key,make){const i=TEXBIG.findIndex(e=>e[0]===key);if(i>=0){const e=TEXBIG.splice(i,1)[0];TEXBIG.push(e);return e[1];}const v=make();TEXBIG.push([key,v]);if(TEXBIG.length>5)TEXBIG.shift();return v;}
/* big=true: a full-page (W x H) texture with no repeat anywhere on the page (strokes, fills, Color by Number); small 256 tiles only feed previews / icons */
function texTile(k,v,rgb,big){const key=k+v+rgb.join();if(big)return bigCache('t'+key,()=>texGen(k,v,rgb,W,H,true));if(TEXCACHE[key])return TEXCACHE[key];return TEXCACHE[key]=texGen(k,v,rgb,256,256,false);}
function texGen(k,v,rgb,w,h,big){const n=256,im=new ImageData(w,h),D=im.data,sh=(c,f)=>[c[0]*f,c[1]*f,c[2]*f],lum=.3*rgb[0]+.59*rgb[1]+.11*rgb[2];
  const NZ=(s,cx,cy)=>big?bnoise(s,256/cx,256/(cy||cx)):pnoise(s,cx,cy);
  const put=(i,c)=>{D[i*4]=Math.max(0,Math.min(255,c[0]));D[i*4+1]=Math.max(0,Math.min(255,c[1]));D[i*4+2]=Math.max(0,Math.min(255,c[2]));D[i*4+3]=255;};
  if(k==='wood'){const P={oak:[9,7,.10,.05,1],walnut:[14,10,.12,.04,0],cherry:[7,5,.07,.03,0],pine:[5,9,.16,.03,0],maple:[16,4,.05,.03,0],drift:[6,12,.10,.09,0]}[v]||[9,7,.1,.05,1];
    const [rings,warp,amp,fib,pores]=P,n1=NZ(3,4,4),n2=NZ(5,4,64),n3=NZ(9,16,128),n4=big?bnoise(13,700,300):null;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const t=(y+warp*(n1(x,y)-.5)*2+(n4?90*n4(x,y):0))/n*rings,r=t-Math.floor(t),ring=Math.pow(r,v==='pine'?6:3.5);
      let f=1-amp*ring-fib*(n2(x,y)-.5)*2-.035*(n3(x,y)-.5)*2;if(pores&&hash2(x,y>>1)<.035)f-=.07;if(v==='drift'){const c=Math.abs(n2(x*1,y)-.5);if(c<.012)f-=.16;f+=.05*(n3(x,y)-.5);}
      put(y*w+x,sh(rgb,f));}}
  else if(k==='brick'&&big){const mort=lum>170?mix(rgb,[120,112,104],.45):mix(rgb,[222,214,200],.62),n1=NZ(11,32,32);   /* v16: page-size brick: course heights, brick lengths and offsets vary, so no grid repeats */
    let y0=0,row=0;while(y0<h){const bh=14+Math.floor(hash2(row,901)*5),xs=[];let x0=-Math.floor(hash2(row,907)*36);while(x0<w){xs.push(x0);x0+=26+Math.floor(hash2(row*131+xs.length,913)*16);}xs.push(x0);
      for(let y=y0;y<Math.min(h,y0+bh);y++){const ly=y-y0;let c=0;for(let x=0;x<w;x++){while(xs[c+1]<=x)c++;const lx=x-xs[c];
        if(lx<2||ly<2){put(y*w+x,sh(mort,.97+.06*hash2(x,y)));continue;}const tone=1+(hash2(c*7+row*977,row*3+c*31)-.5)*.13+(n1(x,y)-.5)*.08+(hash2(x*3,y*5)-.5)*.05;
        put(y*w+x,sh(rgb,tone-(ly===2||lx===2?.05:0)));}}y0+=bh;row++;}}
  else if(k==='brick'){const bw=32,bh=16,mort=lum>170?mix(rgb,[120,112,104],.45):mix(rgb,[222,214,200],.62),n1=NZ(11,32,32);
    for(let y=0;y<h;y++){const row=(y/bh)|0,off=row%2?bw/2:0;for(let x=0;x<w;x++){const xx=big?x+off:(x+off)%n,col=(xx/bw)|0,lx=xx%bw,ly=y%bh;
      if(lx<2||ly<2){put(y*w+x,sh(mort,.97+.06*hash2(x,y)));continue;}const tone=1+(hash2(col*7+row,row*3+col)-.5)*.13+(n1(x,y)-.5)*.08+(hash2(x*3,y*5)-.5)*.05;
      put(y*w+x,sh(rgb,tone-(ly===2||lx===2?.05:0)));}}}
  else if(k==='stone'){const n1=NZ(21,8,8),n2=NZ(23,2,24),n3=NZ(27,16,16),n5=NZ(29,1,12);
    if(v==='cobble'){const S=32,Gx=big?Math.ceil(w/S)+2:8,Gy=big?Math.ceil(h/S)+2:8,pt=(i,j)=>{const I=big?i:((i%8)+8)%8,J=big?j:((j%8)+8)%8;return [(i+.2+.6*hash2(I,J+40))*S,(j+.2+.6*hash2(I+40,J))*S,hash2(I*9,J*5)];};
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){let d1=1e9,d2=1e9,c=0;const ci=(x/S)|0,cj=(y/S)|0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const p=pt(ci+di,cj+dj);
          let dx=p[0]-x,dy=p[1]-y;const d=Math.hypot(dx,dy);if(d<d1){d2=d1;d1=d;c=p[2];}else if(d<d2)d2=d;}
        const e=d2-d1;let f=1+(c-.5)*.14+(n3(x,y)-.5)*.08-Math.min(.1,d1/S*.12);if(e<2.4)f=.72+.1*e/2.4;put(y*w+x,sh(rgb,f));}}
    else for(let y=0;y<h;y++)for(let x=0;x<w;x++){const hh=hash2(x,y);let f=1+(n1(x,y)-.5)*.1;
      if(v==='granite'){if(hh<.07)f-=.22;else if(hh>.95)f+=.15;else if(hh>.9)f-=.08;}
      else if(v==='slate'){f+=(n2(x,y)-.5)*.16+(hh-.5)*.04;}
      else if(v==='sand'){f+=(n5(x,y+6*n1(x,y))-.5)*.12+(hh-.5)*.08;}
      else if(v==='marble'){const t=Math.sin(2*Math.PI*(x/n*2+y/n+2.2*n1(x,y)+.6*n3(x,y))),vein=Math.exp(-Math.abs(t)*14);f=1-.2*vein-.04*(n3(x,y)-.5);}
      put(y*w+x,sh(rgb,f));}}
  else if(k==='fur'){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=`rgb(${rgb.map(Math.round)})`;x.fillRect(0,0,w,h);
    const lt=mix(rgb,WHITE,.34).map(Math.round),dk=rgb.map(q=>Math.round(q*.62)),P={short:[1100,9,1.1,0],long:[650,34,1.2,1.2],straight:[520,90,.9,0],wavy:[520,90,1,4],curly:[420,0,1,0]}[v]||[1100,9,1.1,0];
    const N=Math.round(P[0]*w*h/65536),offs=big?[0]:[-n,0,n];
    x.lineCap='round';for(let i=0;i<N;i++){const r=q=>hash2(i*7+q,i*13+q*3),sx=r(1)*w,sy=r(2)*h-(big?P[1]:0),L=P[1]*(.6+.8*r(3)),col=r(4)<.5?lt:dk;x.strokeStyle=`rgba(${col},${.3+.4*r(5)})`;x.lineWidth=P[2];
      for(const ox of offs)for(const oy of offs){x.beginPath();if(v==='curly'){const R0=2.5+2*r(6),a0=r(7)*6.283;x.arc(sx+ox,sy+oy,R0,a0,a0+4.2);}
        else{x.moveTo(sx+ox,sy+oy);for(let t=3;t<=L;t+=3)x.lineTo(sx+ox+P[3]*Math.sin(t/9+r(8)*6.283)+(v==='long'?(r(9)-.5)*t*.15:0),sy+oy+t);}x.stroke();}}
    return x.getImageData(0,0,w,h);}
  else if(k==='flower'){const C={blossom:['#fff4f7','#e6a23c'],daisy:['#ffffff','#c8871a'],lavender:['#f1eaff','#8e6cc7'],forget:['#f4f9ff','#f0c93e'],rose:['#ffd6dc','#8f1e2e'],mint:['#f2fff7','#3f8f63']}[v]||['#ffffff','#e6a23c'];
    const pet=mix(hex2rgb(C[0]),rgb,.25),ctr=hex2rgb(C[1]),S=32,wr=q=>big?q:((q%8)+8)%8;
    const cell=(i,j)=>{const I=wr(i),J=wr(j);return [[(i+.2+.6*hash2(I+3,J+60))*S,(j+.2+.6*hash2(I+60,J+3))*S,3.6+hash2(I,J*3)*1.4,hash2(I*5,J)*6.283],[(i+.5+.4*(hash2(I+7,J+80)-.5))*S+S/2,(j+.5+.4*(hash2(I+80,J+7)-.5))*S+S/2,2.2,hash2(I,J*7)*6.283]];};
    const CC=new Map(),cellC=(i,j)=>{const kk=i*100003+j;let e=CC.get(kk);if(!e){e=cell(i,j);CC.set(kk,e);}return e;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let c=sh(rgb,1+(hash2(x,y)-.5)*.04);const ci=Math.floor(x/S),cj=Math.floor(y/S);
      for(let dj=-1;dj<=0;dj++)for(let di=-1;di<=0;di++)for(const [px,py,R,rot] of cellC(ci+di,cj+dj)){const dx=x-px,dy=y-py;if(Math.abs(dx)>R+1||Math.abs(dy)>R+1)continue;
        const d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),edge=R*(.5+.5*Math.abs(Math.cos(2.5*(a+rot))));if(d<R*.3)c=mix(ctr,rgb,.15);else if(d<edge)c=mix(pet,rgb,.18+.3*d/R);}
      put(y*w+x,c);}}
  return im;}
function texShadeTile(k,v){const make=()=>{const im=texTile(k,v,[150,150,150],true),c=document.createElement('canvas');c.width=W;c.height=H;const o=new ImageData(W,H);
  for(let i=0;i<W*H;i++){const d=(im.data[i*4]-150)/150;if(d>0){o.data[i*4]=o.data[i*4+1]=o.data[i*4+2]=255;o.data[i*4+3]=Math.min(255,d*330);}else o.data[i*4+3]=Math.min(255,-d*300);}
  c.getContext('2d').putImageData(o,0,0);return c;};return bigCache('sh'+k+v,make);}
function inkTile(k,hex,style,big){if(big&&((k==='plain'&&!style)||style==='air'))big=false;   /* v16: big = a full-page tile, so no repeat is visible anywhere on the page */
  if(big)return bigCache('i'+k+hex+(style||'')+(TEXK.has(k)?texVariant(k,hex):''),()=>inkTile0(k,hex,style,true));return inkTile0(k,hex,style,false);}
function inkTile0(k,hex,style,big){
  const n=256,w=big?W:n,h=big?H:n,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const rgb=hex2rgb(hex);
  if(TEXK.has(k)&&!style){x.putImageData(texTile(k,texVariant(k,hex),rgb,big),0,0);return c;}
  if(k==='plain'&&!style){x.fillStyle=hex;x.fillRect(0,0,n,n);x.globalCompositeOperation='destination-in';x.drawImage(grain,0,0);return c;}
  const im=x.createImageData(w,h),D=im.data,T=Math.PI*2;
  const vn=new Float32Array(17*17);for(let i=0;i<vn.length;i++)vn[i]=hash2(i*7+3,i*13+1);   // low-frequency noise (watercolor)
  for(let i=0;i<17;i++){vn[i*17+16]=vn[i*17];vn[16*17+i]=vn[i];}
  const BN=big?bnoise(41,16):null,W1=big?bnoise(43,190,150):null,W2=big?bnoise(47,120,210):null;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=yy*w+xx,j=i*4,g=big?(hash2(xx*3+17,yy*5+29)*.55+hash2(xx*7+5,yy*11+7777)*.45):grainA[i]/255,wp=big?W1(xx,yy)-.5:0,wq=big?W2(xx,yy)-.5:0;let col=rgb,a=255;
    if(style==='water'){const fx=xx/16,fy=yy/16,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,q=(u,v)=>vn[v*17+u];
      const v=big?BN(xx,yy):(q(ix,iy)*(1-tx)+q(ix+1,iy)*tx)*(1-ty)+(q(ix,iy+1)*(1-tx)+q(ix+1,iy+1)*tx)*ty; col=rgb.map(c=>c*(.88+.14*v));a=110+110*v;}
    else if(style==='air'){a=255;}
    else if(k==='metal'){let v=.55*(.5+.5*Math.sin(T*(xx+yy)/n+5*wp))+.45*(.5+.5*Math.sin(T*2*(xx-yy)/n+1.3+5*wq));v=Math.pow(v,1.25);
      col=metalAt(rgb,v);a=205+50*g;}
    else if(k==='glitter'){const h=hash2(xx,yy);col=rgb.map(c=>c*(.78+.18*g));a=200+40*g;
      if(h<.075){col=mix(rgb,WHITE,.7+.3*hash2(yy,xx));a=255;}else if(h<.11){col=rgb.map(c=>c*.45);a=255;}}
    else if(k==='neon'||k==='lightning'){col=mix(rgb,WHITE,.28);a=225+30*g;}
    else if(k==='chrome'){const t=(xx*.35+yy)/n*2+.06*Math.sin(T*xx/n*2+4*wq)+.9*wp;col=chromeAt(rgb,t);a=235+20*g;}
    else if(k==='glow'){col=mix(rgb,WHITE,.18);a=230+25*g;}
    else if(k==='pulse'){col=mix(rgb,WHITE,.1*g);a=225+30*g;}
    else if(k==='jewel'){const f=Math.abs(Math.sin(T*(xx*.9+yy*.45)/n*2+4*wp))*.6+Math.abs(Math.sin(T*(xx*.3-yy*.8)/n*3+4*wq))*.4;
      col=f>.9?mix(rgb,WHITE,.75):mix(rgb.map(c=>c*.55),mix(rgb,WHITE,.3),f);a=235+20*g;}
    else if(k==='smoke'||k==='cloud'){const fx=xx/16,fy=yy/16,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,q=(u,v)=>vn[v*17+u];
      const v=big?BN(xx,yy):(q(ix,iy)*(1-tx)+q(ix+1,iy)*tx)*(1-ty)+(q(ix,iy+1)*(1-tx)+q(ix+1,iy+1)*tx)*ty;
      if(k==='smoke'){col=rgb.map(c=>Math.min(255,c*(.8+.3*v)));a=150+95*v;}else{col=mix(rgb,WHITE,.2+.35*v);a=170+85*v;}}
    D[j]=col[0];D[j+1]=col[1];D[j+2]=col[2];D[j+3]=a;}
  x.putImageData(im,0,0);
  if(k==='glitter'&&!style){x.fillStyle='rgba(255,255,255,.95)';  // star glints
    const NS=Math.round(22*w*h/65536);for(let s=0;s<NS;s++){const gx=big?hash2(s,91)*w:12+hash2(s,91)*(n-24),gy=big?hash2(91,s+3)*h:12+hash2(91,s)*(n-24),L=2+hash2(s,s)*4;x.fillRect(gx-L,gy-.6,2*L,1.2);x.fillRect(gx-.6,gy-L,1.2,2*L);}}
  return c;}
function setGrainColor(hex){grainPat=sctx.createPattern(inkTile('plain',hex),'repeat');}
function strokeStyle(){return tool==='airbrush'?'air':tool==='watercolor'?'water':null;}
const inkKind=()=>ink.kind==='mix'?((ink.mix&&ink.mix.finish)||'plain'):ink.kind;
/* v23 Adjust: per-pencil Hue, Saturation, Brightness, Contrast, Warmth, Opacity and Glow. Saved per pencil; they change only what you
   draw with THAT pencil (the colour is adjusted at the ink, opacity and the static glow when the stroke / fill is laid down). */
const ADJDEF=[['h','Hue',-180,180,0,1,'°','Hue: turn the stroke\'s color around the color wheel'],['s','Saturation',0,200,100,1,'%','Saturation: grey to vivid'],['b','Brightness',-50,50,0,1,'','Brightness: darker to lighter'],
  ['c','Contrast',50,150,100,1,'%','Contrast: soft to punchy (lights lighter, darks darker)'],['w','Warmth',-50,50,0,1,'','Warmth: cooler (blue) to warmer (amber)'],['o','Opacity',10,100,100,1,'%','Opacity: see-through to solid'],
  ['g','Glow',0,100,0,1,'%','Glow: a soft, still glow around the stroke (separate from the animated Glowing set)']];
let ADJ=LS.get('adj',{});if(!ADJ||typeof ADJ!=='object')ADJ={};
const adjKey=()=>ink?ink.kind+':'+(ink.id||ink.base||ink.hex):'';
function curAdj(){return null;}   /* v24: Adjust edits the LAST stroke / fill (see lastOp below), never the pencil for future strokes */
function adjVal(a,k){const d=ADJDEF.find(q=>q[0]===k);return a&&a[k]!=null?a[k]:d[4];}
function adjHex(hex,a){if(!a)return hex;let [h,s2,l]=rgb2hsl(hex2rgb(hex));h+=adjVal(a,'h');s2*=adjVal(a,'s')/100;let c=hex2rgb(hsl2hex(h,s2,l));
  const b=adjVal(a,'b')/100,ct=adjVal(a,'c')/100,w=adjVal(a,'w')/50;c=b>0?mix(c,WHITE,b*.8):c.map(v=>v*(1+b));c=c.map(v=>(v-128)*ct+128);c=[c[0]+w*38,c[1]+w*6,c[2]-w*38];
  return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function adjSync(){if(!ink)return;if(ink.hex!==ink._ao||ink.base==null)ink.base=ink.hex;const a=curAdj();ink.hex=a?adjHex(ink.base,a):ink.base;ink._ao=ink.hex;}
function adjGlowDraw(c,src,hex){const a=curAdj(),g=a?adjVal(a,'g'):0;if(g<=0)return;c.save();c.globalAlpha=Math.min(1,.35+g/100*.65);c.shadowColor=hex;c.shadowBlur=6+g*.34;c.shadowOffsetX=W*3;c.drawImage(src,-W*3,0);if(g>60){c.shadowBlur=3+g*.12;c.drawImage(src,-W*3,0);}c.restore();}   // shadow only (the shape itself is drawn by the caller)
const adjOp=()=>{const a=curAdj();return a?adjVal(a,'o')/100:1;};
/* v24 Adjust last stroke: one press-hold-release stroke (or one fill) owns its own Adjust values. We keep the layer pixels from just
   before and just after it; moving a slider re-renders only that stroke from those, live. A new stroke starts with fresh defaults and the
   previous one keeps its look (it is baked into the picture, so autosave keeps it). Undo removes the stroke with its adjustments. */
function lastOpCapture(ctx,x,y,w,h,kind){if(!S||mode==='cbn')return;const u=S.free.undo[S.free.undo.length-1];if(!u)return;const M=52;
  const bx=Math.max(0,(x|0)-M),by=Math.max(0,(y|0)-M),bw=Math.min(W-bx,Math.ceil(w)+2*M),bh=Math.min(H-by,Math.ceil(h)+2*M);if(bw<=0||bh<=0)return;
  const pulse=ctx!==S.free.ctx,src=pulse?u.p:u.f,B=new ImageData(bw,bh);if(src){const sd=src.data,bd=B.data;for(let r=0;r<bh;r++){const o=((by+r)*W+bx)*4;bd.set(sd.subarray(o,o+bw*4),r*bw*4);}}
  const A=ctx.getImageData(bx,by,bw,bh),ad=A.data,bd=B.data,mk8=new Uint8Array(bw*bh);let any=0;for(let i=0,j=0;i<mk8.length;i++,j+=4)if(ad[j]!==bd[j]||ad[j+1]!==bd[j+1]||ad[j+2]!==bd[j+2]||ad[j+3]!==bd[j+3]){mk8[i]=1;any++;}
  if(!any)return;const n=undoKey(),recs=[];for(const e of (S.fxUndo||[]))if(e.n===n)for(const q of e.m)if(q[3]==null&&!recs.some(z=>z[0]===q[0]))recs.push([q[0],q[0].hex]);
  S.lastOp={kind,pulse,bx,by,bw,bh,B,A,M:mk8,n,hex:ink.base||ink.hex,name:ink.id&&PREM[ink.id]?PREM[ink.id].name:ink.kind==='mix'?'Mix · '+colorName(ink.base||ink.hex):colorName(ink.base||ink.hex),recs,a:{...adjCarry}};if(opAdj())lastOpRender();   /* v24: a new stroke starts from the previous stroke's Adjust values */
  if($('#adjust')&&!$('#adjust').hidden)setTimeout(()=>{adjBuild();adjFlash();},0);}
let adjCarry=LS.get('adjCarry',{});if(!adjCarry||typeof adjCarry!=='object')adjCarry={};
function opAdj(){const L=S&&S.lastOp;return L&&ADJDEF.some(([k,, , ,d])=>L.a[k]!=null&&L.a[k]!==d)?L.a:null;}
function adjMatrix(a){const h=adjVal(a,'h')*Math.PI/180,c=Math.cos(h),s=Math.sin(h),S2=adjVal(a,'s')/100;
  const Hm=[.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928,.213-c*.213+s*.143,.715+c*.285+s*.140,.072-c*.072-s*.283,.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072];
  const Sm=[.213+.787*S2,.715-.715*S2,.072-.072*S2,.213-.213*S2,.715+.285*S2,.072-.072*S2,.213-.213*S2,.715-.715*S2,.072+.928*S2],R=[];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)R[i*3+j]=Sm[i*3]*Hm[j]+Sm[i*3+1]*Hm[3+j]+Sm[i*3+2]*Hm[6+j];return R;}
function adjRGB(a,m,r,g,b){let R=m[0]*r+m[1]*g+m[2]*b,G=m[3]*r+m[4]*g+m[5]*b,B=m[6]*r+m[7]*g+m[8]*b;const br=adjVal(a,'b')/100,ct=adjVal(a,'c')/100,w=adjVal(a,'w')/50;
  if(br>0){R+=(255-R)*br*.8;G+=(255-G)*br*.8;B+=(255-B)*br*.8;}else if(br<0){R*=1+br;G*=1+br;B*=1+br;}
  R=(R-128)*ct+128+w*38;G=(G-128)*ct+128+w*6;B=(B-128)*ct+128-w*38;return [R<0?0:R>255?255:R,G<0?0:G>255?255:G,B<0?0:B>255?255:B];}
function opHex(L,a){if(!a)return L.hex;const c=hex2rgb(L.hex),q=adjRGB(a,adjMatrix(a),c[0],c[1],c[2]);return '#'+q.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
function lastOpRender(){const L=S&&S.lastOp;if(!L)return;const a=L.a,m=adjMatrix(a),op=adjVal(a,'o')/100,g=adjVal(a,'g'),hex=opHex(L,a),{bw,bh,B,A,M}=L,O=new ImageData(bw,bh),od=O.data,ad=A.data;
  let base=B.data;
  if(g>0){const mc=document.createElement('canvas');mc.width=bw;mc.height=bh;const mi=new ImageData(bw,bh);for(let i=0;i<M.length;i++)if(M[i])mi.data[i*4+3]=ad[i*4+3];mc.getContext('2d').putImageData(mi,0,0);
    const gc=document.createElement('canvas');gc.width=bw;gc.height=bh;const gx=gc.getContext('2d');gx.putImageData(B,0,0);adjGlowDraw2(gx,mc,hex,g,bw);base=gx.getImageData(0,0,bw,bh).data;}
  const plain=adjVal(a,'h')===0&&adjVal(a,'s')===100&&adjVal(a,'b')===0&&adjVal(a,'c')===100&&adjVal(a,'w')===0;
  for(let i=0,j=0;i<M.length;i++,j+=4){if(!M[i]){od[j]=base[j];od[j+1]=base[j+1];od[j+2]=base[j+2];od[j+3]=base[j+3];continue;}
    let r=ad[j],gg=ad[j+1],b=ad[j+2];if(!plain){const q=adjRGB(a,m,r,gg,b);r=q[0];gg=q[1];b=q[2];}
    if(op>=1){od[j]=r;od[j+1]=gg;od[j+2]=b;od[j+3]=ad[j+3];continue;}
    const a1=ad[j+3]/255*op,a0=base[j+3]/255*(1-op),ao=a1+a0;if(ao<=0){od[j+3]=0;continue;}od[j]=(r*a1+base[j]*a0)/ao;od[j+1]=(gg*a1+base[j+1]*a0)/ao;od[j+2]=(b*a1+base[j+2]*a0)/ao;od[j+3]=ao*255;}
  const ctx=L.pulse?(S.pulse&&S.pulse.ctx):S.free.ctx;if(!ctx)return;ctx.putImageData(O,L.bx,L.by);dirty(L.pulse?'pulse':'free');
  for(const [r,h0] of L.recs){const nh=plain?h0:opHex({hex:h0},a);if(r.hex!==nh){r.hex=nh;r.tint=null;r.shade=null;r.cf=null;r.nm=null;r.texC=null;r.sf=null;r.lc=null;r.bolt=null;}}
  if(L.recs.length){dirty('fx');}}
function adjGlowDraw2(c,src,hex,g,bw){c.save();c.globalAlpha=Math.min(1,.35+g/100*.65);c.shadowColor=hex;c.shadowBlur=6+g*.34;c.shadowOffsetX=bw*3;c.drawImage(src,-bw*3,0);if(g>60){c.shadowBlur=3+g*.12;c.drawImage(src,-bw*3,0);}c.restore();}
let adjRaf=0;function lastOpRenderSoon(){if(adjRaf)return;adjRaf=requestAnimationFrame(()=>{adjRaf=0;lastOpRender();});}
function adjFlash(){const L=S&&S.lastOp;let c=$('#adjHL');if(!L){if(c)c.remove();return;}if(!c){c=document.createElement('canvas');c.id='adjHL';c.className='adj-hl';c.width=W;c.height=H;}layers.appendChild(c);
  const x=c.getContext('2d');x.clearRect(0,0,W,H);const mc=document.createElement('canvas');mc.width=L.bw;mc.height=L.bh;const mi=new ImageData(L.bw,L.bh);for(let i=0;i<L.M.length;i++)if(L.M[i]){mi.data[i*4]=255;mi.data[i*4+1]=179;mi.data[i*4+2]=92;mi.data[i*4+3]=255;}mc.getContext('2d').putImageData(mi,0,0);
  for(const [dx,dy] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,2],[-2,2],[2,-2]])x.drawImage(mc,L.bx+dx,L.by+dy);x.globalCompositeOperation='destination-out';x.drawImage(mc,L.bx,L.by);x.globalCompositeOperation='source-over';
  c.classList.remove('go');void c.offsetWidth;c.classList.add('go');}
function setInkPattern(){adjSync();const st=strokeStyle();const ftx=ink&&ink.kind==='fur'&&(ink.tex||(PREM[ink.id]&&PREM[ink.id].tex));if(ftx&&ftx!==furStyle){furStyle=ftx;try{localStorage.setItem('ep-furStyle',JSON.stringify(furStyle));}catch(_){}}grainPat=sctx.createPattern(inkTile(st?'plain':inkKind(),ink.hex,st,true),'repeat');const fa=ink.kind==='mix'&&ink.mix&&ink.mix.amt?ink.mix.amt.finish:1;if(fa&&Math.abs(fa-1)>.02&&TEXK.has(inkKind())&&grainPat.setTransform)grainPat.setTransform(new DOMMatrix().scale(fa));}
/* fill shading for the tap-to-fill tool (premium inks get a metallic gradient + highlight, sparkle, or a neon core) */
function shader(bx,by,bw,bh){const rgb=hex2rgb(ink.hex),K=inkKind();
  if(TEXK.has(K)){const D=texTile(K,texVariant(K,ink.hex),rgb,true).data,fa=ink.kind==='mix'&&ink.mix&&ink.mix.amt?ink.mix.amt.finish||1:1;return (x,y)=>{x=(x/fa)|0;y=(y/fa)|0;const j=(Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x)))*4;return [D[j],D[j+1],D[j+2]];};}   /* v14: textures are page-anchored, so fills and strokes line up */
  if(K==='ramp'){const k=ink.ramp;return (x,y)=>rampRgb(k,pingpong(((x-bx)+(y-by)*.6)/RAMP_LEN));}
  if(K==='jewel'){const hx=bx+bw*.3,hy=by+bh*.25,sx=Math.max(6,bw*.12),sy=Math.max(6,bh*.1);
    const wj=bnoise(61,170,130);return (x,y)=>{const q=4*(wj(x,y)-.5),f=Math.abs(Math.sin(((x-bx)*.9+(y-by)*.45)*.045+q))*.6+Math.abs(Math.sin(((x-bx)*.3-(y-by)*.8)*.06-q))*.4;   /* v16: facets warped by non-repeating noise */
      const c=f>.92?mix(rgb,WHITE,.7):mix(rgb.map(v=>v*.55),mix(rgb,WHITE,.3),f);const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,hl*.7);};}
  if(K==='smoke'){const cx=bx+bw/2,cy=by+bh/2,sn=bnoise(53,22),sn2=bnoise(59,7);return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1))),n=.65*sn(x,y)+.35*sn2(x,y);   /* v16: smooth non-repeating noise, no 8 px blocks */
    return [rgb[0],rgb[1],rgb[2],Math.round(200-110*d+30*(n-.5))];};}
  if(K==='cloud'){const cx=bx+bw*.45,cy=by+bh*.4;return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));
    const c=mix(mix(rgb,WHITE,.45),rgb.map(v=>v*.86),d*d);return [c[0],c[1],c[2],Math.round(255-60*d*d)];};}
  if(K==='metal'){const hx=bx+bw*.3,hy=by+bh*.26,sx=Math.max(8,bw*.24),sy=Math.max(8,bh*.18);
    return (x,y)=>{const u=((x-bx)/bw+(y-by)/bh)/2;let v=.5+.45*Math.sin(u*Math.PI*2.1-.5);let c=metalAt(rgb,v);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,hl*.55);};}
  if(K==='chrome'){const hx=bx+bw*.28,hy=by+bh*.22,sx=Math.max(4,bw*.08),sy=Math.max(4,bh*.05);
    const wc=bnoise(67,200,160);return (x,y)=>{const t=((y-by)/(bh||1))*.95+((x-bx)/(bw||1))*.18+.03*Math.sin(x*.05+5*wc(x,y))+.06*(wc(x,y)-.5);let c=chromeAt(rgb,t);
      const hl=Math.exp(-(((x-hx)/sx)**2+((y-hy)/sy)**2));return mix(c,WHITE,Math.min(1,hl*1.2));};}
  if(K==='glow'){const cx=bx+bw/2,cy=by+bh/2;const core=mix(rgb,WHITE,.35);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,d);};}
  if(K==='glitter')return (x,y)=>{const h=hash2(x,y),g=hash2(x*3+17,y*5+29);
    return h<.06?mix(rgb,WHITE,.75+.25*hash2(y,x)):h<.1?rgb.map(c=>c*.5):rgb.map(c=>c*(.8+.18*g));};
  if(K==='neon'||K==='lightning'){const cx=bx+bw/2,cy=by+bh/2,R=Math.max(bw,bh)/2||1;const core=mix(rgb,WHITE,.45);
    return (x,y)=>{const d=Math.min(1,Math.hypot((x-cx)/(bw/2||1),(y-cy)/(bh/2||1)));return mix(core,rgb,Math.pow(d,.8));};}
  return ()=>rgb;}
/* entitlement: demo unlock, codes, and a hook for Stripe / license servers (see premium-config.js) */
const RAWCFG=window.EP_PREMIUM_CONFIG||{};
const PCFG=Object.assign({mode:'demo',verifyUrl:'',licenseCheckUrl:''},RAWCFG);
PCFG.products=Object.assign({
  pencils:{productId:RAWCFG.productId||'emberpost-premium-pencils',productName:RAWCFG.productName||'Premium Pencils',price:RAWCFG.price||'$2.99',
    stripePaymentLink:RAWCFG.stripePaymentLink||'',demoCodes:RAWCFG.demoCodes||[],storageKey:RAWCFG.storageKey||'ep.premium.v1'},
  palettes:{productId:'emberpost-all-palettes',productName:'All Palettes',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.palettes.v1'},
  effects3d:{productId:'emberpost-effects-3d',productName:'Pop Fill & 3D',price:'$1.99',stripePaymentLink:'',demoCodes:[],storageKey:'ep.premium.effects3d.v1'},
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
    b.innerHTML=`<div class="th"><img src="${thumbOf(n)}" alt="">${lk?LOCK:''}</div><div class="tx"><b>${chName(n)}</b><span>${esc(lk?c.teaser:c.title)}</span></div>`;
    b.onclick=()=>showScene(n);nav.appendChild(b);});
  const sc=document.createElement('button');sc.className='scene showcase';sc.title='See the premium effects';
  sc.innerHTML=`<div class="th"><img id="showThumb" alt="">${''}</div><div class="tx"><b>✦ Effects</b><span>Pop Fill + gold</span></div>`;
  sc.onclick=openShowcase;nav.appendChild(sc);if(showcaseURL)sc.querySelector('img').src=showcaseURL;
  if(S)$$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===S.n));}
function storyStrip(){
  const c=CHM[S.n]||{title:S.d.title,teaser:S.d.caption,story:S.d.caption}, reveal=!settings.story||isDone(S.n);
  $('#stitle').textContent=`${chName(S.n)} · ${c.title}`;
  $('#scap').textContent=reveal?c.story:c.teaser+(c.teaser!==c.story?' \u2026':'');
  app.classList.toggle('teaser',!reveal); app.classList.toggle('storyon',!!settings.story);}
function pencilSVG(c){return `<svg viewBox="0 0 30 74"><path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${c}"/>
 <rect x="8.5" y="19" width="13" height="47" fill="${c}"/><rect x="10.5" y="19" width="2.5" height="47" fill="#fff" opacity=".22"/>
 <rect x="18" y="19" width="3.5" height="47" fill="#000" opacity=".18"/><rect x="8.5" y="64" width="13" height="9" rx="1.5" fill="#c8ad80"/></svg>`}
const TEXICON={};function texIconURL(k,v,hex){const key=k+v+hex;if(TEXICON[key])return TEXICON[key];const im=texTile(k,v,hex2rgb(hex)),t=document.createElement('canvas');t.width=t.height=256;t.getContext('2d').putImageData(im,0,0);
  const c=document.createElement('canvas');c.width=26;c.height=94;c.getContext('2d').drawImage(t,0,0,40,144,0,0,26,94);return TEXICON[key]=c.toDataURL('image/png');}
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
  if(TEXK.has(p.kind)){const t=texIconURL(p.kind,p.tex||texVariant(p.kind,c),c);return `<svg viewBox="0 0 30 74"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="13" height="47"><image href="${t}" width="13" height="47" preserveAspectRatio="none"/></pattern></defs><path d="M15 1 L8.5 19 H21.5 Z" fill="#e9cfa6"/><path d="M15 1 L12.4 8.2 H17.6 Z" fill="${c}"/><rect x="8.5" y="19" width="13" height="47" fill="url(#${id})" transform="translate(0 0)"/><rect x="8.5" y="64" width="13" height="9" rx="1.5" fill="#c8ad80"/><rect x="18" y="19" width="3.5" height="47" fill="#000" opacity=".12"/></svg>`;}
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
{const HU=[...Array(24)].map((_,i)=>i*15);   // v11: the full hue wheel in light / mid / deep, plus neutrals, skin and earth tones
 THEMES.push({id:'spec-light',name:'Spectrum Light',colors:HU.map(h=>hsl2hex(h,.72,.8))},{id:'spec',name:'Spectrum',colors:HU.map(h=>hsl2hex(h,.78,.52))},{id:'spec-deep',name:'Spectrum Deep',colors:HU.map(h=>hsl2hex(h,.72,.27))},
  {id:'neutrals',name:'Neutrals',colors:['#ffffff','#f4f1ea','#e2ddd3','#c9c3b8','#aaa49a','#8a857c','#6b6760','#4e4b46','#34322f','#1c1b1a','#e3e8ee','#b9c2cc','#8793a0','#56606c','#2e353d','#101418']},
  {id:'skin',name:'Skin Tones',colors:['#fbe3d3','#f6d2bb','#efc0a2','#e7b08d','#dca07a','#cf8f68','#bd7b56','#a86a47','#8f573a','#77472f','#5e3824','#46291b','#f3cfb0','#e0b48a','#c7996f','#9e7353']},
  {id:'earth2',name:'Earth Tones',colors:['#f1e3c6','#e0c89a','#cba877','#b28958','#8f6a40','#6e4f2e','#4d3620','#9a6a4a','#b5754f','#8c4a2f','#6a3a26','#7f7a4a','#5f6b3a','#a39a72','#c2b280','#3b2f23']});}
const SETS=[{id:'book',name:'Book palette',product:null,type:'plain',colors:EXTRA}]
  .concat(THEMES.map(t=>({id:t.id,name:t.name,product:'palettes',type:'plain',colors:t.colors})))
  .concat([['metal','Metallic'],['chrome','Chrome'],['glitter','Glitter'],['jewel','Jewel'],['neon','Neon'],['lightning','Lightning'],['glow','Glowing'],['pulse','Pulse'],['ramp','Gradients','gradients'],['smoke','Smoke','smoke'],['cloud','Clouds','clouds'],['wood','Wood'],['brick','Brick'],['stone','Stone'],['flower','Flowers'],['fur','Fur & Hair'],['brush','Brushes']]
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
/* v22: which effect sliders a set shows. With Mix on, the sliders follow the mixed finish / animation / particles (so Speed reaches
   Mix strokes too). Every effect set also gets Contrast and Hue. */
const FKS={chrome:['shimmer','shimmerSpeed'],metal:['shimmer','shimmerSpeed'],jewel:['shimmer','shimmerSpeed'],shimmer:['shimmer','shimmerSpeed'],glitter:['sparkle','twinkleSpeed'],pulse:['pulseSpeed'],glow:['glowStr','glowSpeed'],neon:['neonSpeed'],lightning:['boltStr','boltSpeed'],smoke:['smokeSpeed'],water:['partSpeed'],fire:['partSpeed'],sparks:['partSpeed'],snow:['partSpeed'],bubbles:['partSpeed'],stars:['partSpeed'],leaves:['partSpeed']};
let FXLINK=[];function fxKeysFor(set){let k=null;if(MIX.on){const u=[];for(const m of [MIX.finish,MIX.anim,MIX.part])for(const q of (FKS[m]||[]))if(!u.includes(q))u.push(q);if(u.length)k=u;}
  if(!k&&set&&FKS[set.id])k=FKS[set.id].slice();if(!k)return null;
  const sp=k.filter(isSpd),st=k.filter(q=>!isSpd(q));FXLINK=sp.length>1?sp:[];   // one button each: strength (Shimmer/Flash/…), Speed (drives every mixed effect), Contrast, Hue
  return [...st.slice(0,1),...sp.slice(0,1)];}   // v23: Contrast and Hue moved into Adjust (per pencil)
function buildPalette(){
  const set=SETS[setIdx],own=owned(set),fr=$('#freerow');if(!fr)return;fr.innerHTML='';
  const bar=$('#palbox');
  {const sn=bar.querySelector('.sname');sn.textContent=set.name;sn.title=set.name;sn.style.fontSize='';for(let f=13;f>=11&&sn.scrollWidth>sn.clientWidth+1;f--)sn.style.fontSize=f+'px';}   // shrink long names a little; ellipsis after that
  bar.querySelector('.scount').textContent=`${set.type==='plain'?set.colors.length:set.items.length} ${set.id==='brush'?'brushes':'pencils'}`;
  let state='';if(!own){if(set.product==='palettes'){const ps=Trials.palScene();state=(ps==null||(S&&ps===S.n))?'Preview on this page':'Locked';}
    else{const l=Trials.left(set.id);state=l?`Free try: ${l} left`:'Locked';}}
  bar.querySelector('.sstate').textContent=own?(set.product?'Owned':''):state;
  bar.classList.toggle('locked',!own);bar.querySelector('.slock').hidden=own;
  if(bar.querySelector('.sdots'))bar.querySelector('.sdots').innerHTML=SETS.map((t,i)=>`<i class="${i===setIdx?'on':''} ${owned(t)?'':'lk'}"></i>`).join('');
  let host=fr;
  if(set.product){const g=document.createElement('div');g.id='pgroup';g.className='pgroup'+(own?'':' locked');
    g.innerHTML=`<div class="plabel"><span class="plock">${LOCK}</span><span class="ptxt">${esc(set.name)}${own?' ✓':''}</span></div><div class="pitems"></div>`;fr.appendChild(g);host=g.querySelector('.pitems');}
  {let g0=null;const lab=host===fr?null:fr.querySelector('.plabel');if(lab){const cv=pvCanvas('pstrip',118,30);lab.appendChild(cv);
    pvAdd(cv,t=>drawFxPreview(cv,MIX.on&&set.type==='ink'&&set.id!=='brush'?specOfMix(set.items.slice(0,3).map(p=>p.hex)):specOfSet(set),t));
    const fks=fxKeysFor(set),fk=fks&&fks[0];if(fk){fks.forEach(q=>lab.appendChild(fxSlider(q)));g0=host.parentNode;requestAnimationFrame(()=>{if(g0.isConnected)g0.style.minWidth=Math.ceil(lab.scrollWidth+22)+'px';});}}}
  $('#mixBtn')&&$('#mixBtn').classList.toggle('on',MIX.on);
  if(set.type==='plain')set.colors.forEach(h=>{const b=document.createElement('button');b.className='pencil'+(set.id==='jewel'?' jewelc':'')+(own?'':' dim');b.dataset.c=h;b.title=h;b.innerHTML=pencilSVG(h);
      b.onclick=()=>usePlain(set,h);host.appendChild(b);});
  else set.items.forEach(p=>{const b=document.createElement('button');b.className='pencil premium '+p.kind+(GEMS.has(p.id)?' gem':'')+(p.kind==='neon'||p.kind==='glow'?' n-'+p.id.slice(2):'')+(own?'':' dim');
      b.dataset.p=p.id;b.title=p.name;if(p.kind==='neon'||p.kind==='glow')b.style.color=p.hex;b.innerHTML=premiumIcon(p);b.onclick=()=>usePremium(set,p);host.appendChild(b);});
  /* v18: no separate 'Any color' button; the one color wheel at the end of the row does it for effect sets */
  {const m=$('#moreSets');if(m){m.hidden=set.id!=='book';m.onclick=()=>flipSet(1);}}
  {const sf=$('#setfx');if(sf){sf.innerHTML='';let lab=fr.querySelector('.plabel');const ks=fxKeysFor(set);if(!lab&&ks){lab=document.createElement('div');lab.className='plabel';ks.forEach(q=>lab.appendChild(fxSlider(q)));}if(lab)sf.appendChild(lab);const pb=$('#palbox');pb&&pb.classList.toggle('hasfx',!!(lab&&lab.querySelector('.fxw')));}}   /* v22: in Mix the sliders for the mixed effects show on any set */   /* v20: the set's effect preview + sliders (Shimmer, Speed, Glow…) sit in the pencil box header beside ‹ set ›   /* v20: More sets is a small link in the pencil box header */
  markColor();fitSoon();}
function anyColors(set){ // this page's colour guide first, then the book palette and the full colour range (deduped)
  /* v16: groups from a palette pack you don't own come back locked (padlock, dimmed, tap = upgrade). Free groups go first, so a color that is also free stays free */
  const out=[],seen=new Set(),add=(name,cs,lk)=>{const g=[];for(const h of cs){const k=h.toLowerCase();if(seen.has(k))continue;seen.add(k);g.push(h);}if(g.length)out.push([name,g,!!lk]);};
  if(set&&set.id==='fur')add('Fur & hair colors',FURPAL);   /* v15: blonde → calico orange, cream, browns, black, gray, white */
  if(S)add(`This page's color guide`,S.d.palette);add('Book palette',EXTRA);
  for(const id of ['spec-light','spec','spec-deep','neutrals','skin','earth2']){const t=SETS[SETI[id]];if(t)add(t.name,t.colors,!owned(t));}
  for(const t of SETS)if(t.type==='plain'&&t.id!=='book')add(t.name,t.colors,!owned(t));
  return out.sort((a,b)=>a[2]-b[2]);}
function anyGroupsHTML(g,named){return g.map(([n,cs,lk])=>`<h4 class="${lk?'lk':''}">${lk?`<span class="alock">${LOCK}</span>`:''}${esc(n)}${lk?' <small>· Palettes pack</small>':''}</h4><div class="agrid${lk?' lk':''}">${cs.map(h=>`<button class="asw${lk?' lk':''}" data-c="${h}" ${lk?'data-lk="1" ':''}style="background:${h}" ${named?`aria-label="${esc(colorName(h))}${lk?' (locked)':''}"`:`title="${h}${lk?' · locked':''}"`}></button>`).join('')}</div>`).join('');}
function anyPicker(set,show=true){let d=$('#anyPop');if(d)d.remove();if(!show)return;
  d=document.createElement('div');d.id='anyPop';d.className='anypop';d.setAttribute('role','dialog');d.setAttribute('aria-label','Any color');
  const g=anyColors(set);d.innerHTML=`<header><b>${esc(set.name)} · any color</b><button class="x" aria-label="Close">×</button></header>`+anyGroupsHTML(g,false);
  d.querySelector('.x').onclick=()=>anyPicker(set,false);
  d.onclick=e=>{const b=e.target.closest('.asw');if(!b)return;if(b.dataset.lk){anyPicker(set,false);openUpgrade(null,'palettes');return;}const base=PREM[anyId(set.id)],p={...base,hex:b.dataset.c,name:base.name};anyPicker(set,false);usePremium(set,p,true);buildPalette();};
  document.body.appendChild(d);const r=$('#wheelBtn').getBoundingClientRect();d.style.left=Math.max(8,Math.min(innerWidth-d.offsetWidth-8,r.left+r.width/2-d.offsetWidth/2))+'px';d.style.top=Math.max(8,r.top-d.offsetHeight-10)+'px';
  setTimeout(()=>document.addEventListener('pointerdown',function f(e){if(!d.isConnected||d.contains(e.target)){if(!d.isConnected)document.removeEventListener('pointerdown',f,true);return;}document.removeEventListener('pointerdown',f,true);if(!e.target.closest('#wheelBtn'))d.remove();},true),0);}
function wheelPicker(show=true){let d=$('#anyPop');if(d)d.remove();if(!show)return;
  d=document.createElement('div');d.id='anyPop';d.className='anypop';d.setAttribute('role','dialog');d.setAttribute('aria-label','Color wheel');
  d.innerHTML=`<header><b>Any color · every color</b><button class="x" aria-label="Close">×</button></header>`+anyGroupsHTML(anyColors(),true);
  d.querySelector('.x').onclick=()=>wheelPicker(false);
  d.onclick=e=>{const b=e.target.closest('.asw');if(!b)return;wheelPicker(false);if(b.dataset.lk){openUpgrade(null,'palettes');return;}pickColor(b.dataset.c);toast(mode==='cbn'?`${tcase(colorName(b.dataset.c))} · ready for Free Color (in Color by Number the numbers choose the colors)`:tcase(colorName(b.dataset.c)));};
  d.addEventListener('pointerover',e=>{const b=e.target.closest('.asw');if(b)b.title=colorName(b.dataset.c)+(b.dataset.lk?' · locked':'');});
  document.body.appendChild(d);const r=$('#wheelBtn').getBoundingClientRect();d.style.left=Math.max(8,Math.min(innerWidth-d.offsetWidth-8,r.left+r.width/2-d.offsetWidth/2))+'px';d.style.top=Math.max(8,r.top-d.offsetHeight-10)+'px';
  setTimeout(()=>document.addEventListener('pointerdown',function f(e){if(!d.isConnected){document.removeEventListener('pointerdown',f,true);return;}if(d.contains(e.target))return;document.removeEventListener('pointerdown',f,true);if(!e.target.closest('#wheelBtn'))d.remove();},true),0);}
function flipSet(d){anyPicker(null,false);setIdx=(setIdx+d+SETS.length)%SETS.length;for(let k=0;k<SETS.length&&!setOK(setIdx);k++)setIdx=(setIdx+(d||1)+SETS.length)%SETS.length;settings.pset=SETS[setIdx].id;LS.set('settings',settings);buildPalette();$('#colors').scrollLeft=mode==='free'?0:$('#numrow').offsetWidth;}   /* v16: in Free Color the guide row is gone (wheel sits at the end), so show the set from its start */
/* v24: grabbing a pencil means a pencil stroke: 3D -> Pop Pencil, 2D -> Pencil (from Fill, Pop Fill, Eraser or Pop Erase). The picked color
   is kept; to fill, tap Fill afterwards (tools no longer swap the color back to their own last pick). The Any color wheel and Mix don't switch tools. */
function autoDraw(){if(mode==='cbn')return;const t=toolSet==='3d'?'poppencil':'pencil';if(tool===t)return;
  if(t==='poppencil'&&settings.ppColor===false){settings.ppColor=true;LS.set('settings',settings);const b=$('#ppColor');if(b)b.setAttribute('aria-pressed','true');}
  setTool(t);}
function usePlain(set,h){
  if(!owned(set)){const ps=Trials.palScene();
    if(ps!=null&&S&&ps!==S.n){openUpgrade(null,'palettes');return;}
    if(ps==null){Trials.setPalScene(S.n);toast(`Preview: themed palettes are free on this page`);buildPalette();}}
  pickColor(h);if(set.id==='jewel'&&ink.kind==='plain')ink.fx='shimmer';autoDraw();}
function usePremium(set,p,noSwitch=false){
  if(!owned(set)&&Trials.left(set.id)<=0){openUpgrade(p.id,set.product);return;}
  if(!owned(set))toast(`Free try: ${p.name} · ${Trials.left(set.id)} ${Trials.left(set.id)===1?'stroke':'strokes'} left (a fill uses 3)`);
  pickPremium(p);if(p.kind!=='brush'&&!noSwitch)autoDraw();}
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
  for(const [key,sub] of [['pencils','Metallic, chrome, glitter, neon, glow, pulse + brushes'],['palettes','Sunset, Ocean, Forest and 11 more palettes: the full spectrum, neutrals, skin and earth tones'],['effects3d','Pop Pencil, 3D Pop and the 3D views'],['smoke','5 drifting smoke pencils'],['clouds','5 billowing cloud pencils'],['gradients','Rainbow + 11 gradient ramps that shift along the stroke']]){
    const on=ENT[key].unlocked(),b=$(`#set_${key} b`),sm=$(`#set_${key} small`);if(b){b.textContent=on?'Lock again (demo)':'Unlock';sm.textContent=on?`Unlocked on this device (${(ENT[key].state()||{}).source||'demo'})`:sub;}}
  ownerBar();if(!$('#mixer').hidden)buildMixer();
  const pt=$('#popTries');if(pt)pt.textContent=ENT.effects3d.unlocked()?'':`Free tries: ${Trials.popsLeft()} left`;
  markColor();}
function pickPremium(p){if(mode==='cbn'&&p.kind!=='brush')setTimeout(()=>toast(`${PNAME[p.name]||tcase(p.name)} finish · tap a numbered area`),30);if(MIX.on){MIX.on=false;$('#mixer').hidden=true;$('#mixBtn').classList.remove('on');}
  if(p.kind==='chrome')enableTilt();
  if(p.kind==='brush'){setTool(p.id);} else {ink={kind:p.kind,hex:p.hex,id:p.id,ramp:p.ramp};color=p.hex;if(tool==='eraser')setTool(drawTool());}
  setInkPattern();$$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});markColor();}
function buildColors(){
  const nr=$('#numrow');nr.innerHTML='';
  // v13: the color guide is a row of colored pencils (number on the pencil in Color by Number), then the color wheel at the end
  S.d.palette.forEach((h,i)=>{const k=i+1,b=document.createElement('button');b.className='sw swp';b.dataset.k=k;b.style.setProperty('--c',h);
    b.innerHTML=pencilSVG(h)+`<span class="n">${k}</span><span class="left"></span>`;b.onclick=()=>pickNum(k);nr.appendChild(b);});
  /* v18: ONE color wheel, in its own box at the right end of the pencil row. On an effect set (Chrome, Glitter, Wood...) it gives
     that effect in any color (was the separate 'Any color' button); on a plain set it picks any plain color. */
  const old=$('#wheelBtn');if(old)old.remove();
  const wb=document.createElement('button');wb.id='wheelBtn';wb.className='wheelbtn';wb.setAttribute('aria-label','Any color: every color');wb.innerHTML='<i></i><span>Any<br>color</span>';
  wb.onclick=e=>{e.stopPropagation();const st=SETS[setIdx];if(st&&st.type==='ink'&&ANY_KINDS[st.id]){if($('#anyPop'))anyPicker(st,false);else anyPicker(st);}else{if($('#anyPop'))wheelPicker(false);else wheelPicker();}};$('#palbody').appendChild(wb);
  buildPalette();
}
function markColor(){setTimeout(sizeUI,0);const sl=$('#saveLoop');if(sl)sl.hidden=!(S&&S.pulseUsed&&mode==='free');
  $$('#numrow .sw').forEach(b=>b.classList.toggle('on',mode==='cbn'?+b.dataset.k===selNum:S.d.palette[b.dataset.k-1]===color));
  $$('#freerow .pencil:not(.premium)').forEach(b=>b.classList.toggle('on',(ink.kind==='plain'||ink.id==='c-any')&&b.dataset.c===color));const cb=$('#chromeBtn');if(cb){cb.classList.toggle('on',!!settings.chromeFinish);cb.setAttribute('aria-pressed',String(!!settings.chromeFinish));}
  $$('#freerow .premium').forEach(b=>b.classList.toggle('on',b.dataset.p===tool||b.dataset.p===ink.id));
  {const ab=$('#wheelBtn'),st=SETS[setIdx];if(ab&&st){const fx=st.type==='ink'&&!!ANY_KINDS[st.id];ab.title=fx?`Any color as ${st.name}: every color in the book's guide plus the full color range`:'Any color: pick any plain color from the guide and the full color range';ab.classList.toggle('fx',fx);const k=st.id,mine=ink.kind===k&&!PREM[tool],sw=ab.querySelector('i');   /* v13: the last pick wins; the Any color swatch shows the active color of this effect, from the grid or a pencil */
    ab.classList.toggle('on',ink.id===anyId(k));ab.classList.toggle('cur',mine);if(sw)sw.style.background=mine?ink.hex:'conic-gradient(#f44,#fa3,#ee4,#4c6,#3cd,#46f,#a5f,#f4a,#f44)';ab.dataset.c=mine?ink.hex:'';}}
}
function pickNum(k){ if(mode==='free'){pickColor(S.d.palette[k-1]);return;} selNum=k;markColor();highlight();drawNums();}
function pickColor(h){color=h;ink=settings.chromeFinish&&!MIX.on?{kind:'chrome',hex:h,id:'c-any'}:{kind:'plain',hex:h,id:null};if(ink.id==='c-any')enableTilt();if(tool==='eraser'||tool==='poperase')setTool(backTool());if(MIX.on)mixInk();setInkPattern();markColor();
  $$('#pgroup .brush').forEach(b=>{b.innerHTML=premiumIcon(PREM[b.dataset.p]);});}
/* v16: the bottom bar follows the tool. Pencil shows the drawing pencils, Fill the fill colors, Pop Pencil its options plus pencils,
   Pop Fill (pencils too, for Color while popping) / Eraser / Pop Erase their options. Each of Pencil (incl. brushes), Fill and Pop Pencil remembers its last pencil or color. */
let TMEM={};const TMEMS={'2d':TMEM,'3d':{}},LASTT={},CTX={pencil:['Pencil','Drawing pencils · flip sets with ‹ ›, hover a pencil for its name, or pick any color with the wheel'],fill:['Fill','Fill colors · pick a color here, then tap an area to fill it'],
  poppencil:['Pop Pencil','Paint over an area to lift it or press it in · with Color while popping on, it also paints with the pencil you pick'],pop:['Pop Fill','Tap an area to raise it (or press it in with Inset) · stays inside the lines like Fill · the slider sets the area you last tapped · Color while popping fills it too'],
  eraser:['Eraser','Rub out color · set the size with the Size slider · tap Eraser again, any pencil or any tool to go back'],poperase:['Pop Erase','Tap a raised or inset part to flatten it · tap Pop Erase again, any pencil or any tool to go back']};
const LASTD={};const isEr=t=>t==='eraser'||t==='poperase';const backTool=()=>LASTD[toolSet]&&inToolSet(LASTD[toolSet])?LASTD[toolSet]:drawTool();
const toolGroup=t=>PREM[t]?'pencil':(t==='pencil'||t==='fill'||t==='poppencil'||t==='pop')?t:null;
const sameInk=(a,b)=>a&&b&&a.kind===b.kind&&a.hex===b.hex&&(a.id||null)===(b.id||null)&&JSON.stringify(a.mix||null)===JSON.stringify(b.mix||null)&&(a.ramp||null)===(b.ramp||null);
function ctxBar(t,anim){const g=toolGroup(t)||t,c=CTX[g]||CTX.pencil,prev=app.dataset.ctx;app.dataset.ctx=g;const tg=$('#ctxtag'),hn=$('#ctxhint');
  if(tg){tg.textContent=PREM[t]?PREM[t].name:c[0];hn.textContent=c[1];const cd=$('#ctxcard');if(cd)cd.innerHTML=`<b>${esc(c[0])}</b><span>${esc(c[1])}</span>`;}
  if(anim&&prev!==g){const b=$('#bottom');b.classList.remove('ctxswap');void b.offsetWidth;b.classList.add('ctxswap');clearTimeout(ctxBar.t);ctxBar.t=setTimeout(()=>b.classList.remove('ctxswap'),420);}}
/* v17: 2D and 3D have separate tool sets. 2D: Pencil, Fill, Eraser (+ brushes). 3D: Fill, Pop Fill, Pop Pencil, Pop Erase, Eraser.
   The 2D / 3D switch at the left of the pencil bar swaps the toolbar and pencils; each set remembers its own tool and colors. */
let toolSet='2d';
const SET_TOOLS={'2d':['pencil','fill','eraser'],'3d':['fill','pop','poppencil','poperase','eraser']};
const inToolSet=(t,s=toolSet)=>PREM[t]?true:SET_TOOLS[s].includes(t);   /* v24: brushes work over 3D too */
const setOK=i=>true;   /* v24: every set (brushes too) is usable in 3D */   // brushes are 2D only (they can't color through Pop Fill)
const drawTool=()=>toolSet==='3d'?'fill':'pencil';
/* v18: the 2D / 3D buttons ONLY swap which tools are shown. They never touch the picture: the 3D relief, pops, colors, line
   shading and settings stay exactly as they are (the relief view simply stays on wherever the page has 3D). */
function setToolSet(s){app.classList.toggle('set3d',s==='3d');if(s===toolSet){modeLabels();return;}
  const memG=q=>q==='pop'?'fill':toolGroup(q),g0=memG(tool);if(g0)TMEM[g0]={ink:{...ink},color,setIdx,tool};LASTT[toolSet]=tool;
  toolSet=s;TMEM=TMEMS[s];
  let t=LASTT[s]&&inToolSet(LASTT[s],s)?LASTT[s]:(s==='3d'?({pencil:'fill',eraser:'eraser',fill:'fill'}[tool]||'fill'):({pop:'fill',poppencil:'pencil',poperase:'eraser',fill:'fill',eraser:'eraser'}[tool]||'pencil'));
  const g1=memG(t),m=g1&&TMEM[g1];if(m){ink={...m.ink};color=m.color;if(m.setIdx!==setIdx){setIdx=m.setIdx;settings.pset=SETS[setIdx].id;LS.set('settings',settings);}}
  if(!setOK(setIdx)){setIdx=0;settings.pset=SETS[0].id;LS.set('settings',settings);}
  if(MIX.on&&s==='3d'&&t!=='fill'&&t!=='poppencil')t='fill';
  tool=t;setTool(t);buildPalette();if(S)markColor();modeLabels();}
/* v18: if the set bar can't fit on one line, stack it so the set selector gets its own row right above the pencils */
function setbarFit(){const bar=$('#setbar');if(!bar)return;bar.classList.remove('stack');const k=[...bar.children].filter(e=>e.offsetParent&&e.offsetWidth);
  const tops=new Set(k.map(e=>Math.round(e.offsetTop/6)));if(tops.size>1)bar.classList.add('stack');}
let fitRaf=0;const fitSoon=()=>{cancelAnimationFrame(fitRaf);fitRaf=requestAnimationFrame(setbarFit);};
function setTool(t){if(!inToolSet(t))t=t==='pop'||t==='poppencil'||t==='poperase'?'fill':drawTool();const memG=q=>q==='pop'?'fill':toolGroup(q),g0=memG(tool),g1=memG(t);let rebuild=false;   /* v16: Pop Fill shares Fill's color */
  if(g0)TMEM[g0]={ink:{...ink},color,setIdx,tool};
  if(false&&g1&&g1!==g0&&TMEM[g1]){const m=TMEM[g1];if(g1==='pencil'&&t==='pencil'&&PREM[m.tool])t=m.tool;
    if(!sameInk(m.ink,ink)){ink={...m.ink};color=m.color;if(m.setIdx!==setIdx){setIdx=m.setIdx;settings.pset=SETS[setIdx].id;LS.set('settings',settings);}rebuild=true;}}
  ctxBar(t,true);if(!isEr(t))LASTD[toolSet]=t;
  tool=t;$$('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));app.classList.toggle('tool-pop',t==='pop'||t==='poppencil');app.classList.toggle('tool-pp',t==='poppencil');
  if(t!=='pop'&&t!=='poppencil'&&$('#idea3d').classList.contains('on'))idea3d(false);
  if(t==='pop'||t==='poppencil'){enableTilt();refreshPremiumUI();}else if(rebuild)buildPalette();setInkPattern();if(S)markColor();fitSoon();{const bk=$('#ctxBack');if(bk)bk.hidden=!isEr(t);}sizeUI();}

async function showScene(n){
  if(!isUnlocked(n)){const i=IDS.indexOf(n),prev=IDS[i-1];toast(`Locked · finish Chapter ${prev} to unlock`);
    const b=$(`.scene[data-n="${n}"]`);if(b){b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');}return;}
  if(S&&S.n!==n)saveNow();
  if(!S||S.n!==n){mode='free';D3.want=true;D3.fresh=true;}   /* v18: a page opens in 3D Free Color (2D only where the page has no 3D) */
  S=await loadScene(n); resetZoom(); prog.current=n; saveProg(); fxsForScene(n);
  $$('.scene').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  storyStrip();
  lineImg.src=S.d.line; lineImg.onload=()=>{scheduleLineTint();linesApply();linesDoneGlow();}; layers.innerHTML=''; layers.appendChild(S.cbn.c); layers.appendChild(S.free.c); if(S.pulse)layers.appendChild(S.pulse.c);
  renderPops(); ppAttach(S); fxAttach(); fxStart(); LTS=null; ltRender(); if($('#idea3d').classList.contains('on'))idea3d(false); loadVectorLines(n);
  selNum=firstOpen()||1; buildColors(); setMode(mode,true);
  needDepth(n).then(()=>{if(S.n!==n)return;cleanPops(S);apply3D(true);});
}
function setMode(m,force){
  if(m===mode&&!force)return; mode=m; app.classList.toggle('cbn',m==='cbn'); app.classList.toggle('free',m==='free');
  $$('.mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));modeLabels();
  S.cbn.c.style.display=m==='cbn'?'':'none'; S.free.c.style.display=m==='free'?'':'none'; scheduleLineTint(); try{renderIdeas();}catch(e){} if(!linesDefault(S.lines))scheduleLines(); fxSetList(S);if(S.fxC){S.fxC.style.display='';fxDraw(performance.now());fxStart();}
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
  const r=S.lab[(y|0)*W+(x|0)]; if(!r)return;
  if(tool==='eraser'){cbnErase(r);return;}
  if(S.cbn.filled[r]){if(cbnFinishKinds().length&&allowPremiumUse(3)){cbnFinish([r]);toast('Finish applied ✦');}return;}   // re-finish an already coloured area
  if(S.num[r]!==selNum){shake();return;}
  if(cbnFinishKinds().length&&!allowPremiumUse(3))return;   // same free-try / lock rules as Free Color
  const before=S.cbn.hist.length;fillCBN(r);const b=S.cbn.hist[S.cbn.hist.length-1];if(b&&S.cbn.hist.length>before)cbnFinish(b);
}
/* Color by Number finishes: the numbered colour is painted as usual (so numbering and completion are unchanged) and the
   picked pencil's effect (chrome, glitter, pulse, glow, metal, jewel, smoke, clouds, gradient, Mix) lives on top of it. */
function cbnFinishKinds(){if(!ink||ink.kind==='plain'||ink.kind==='brush')return [];if(ink.kind==='ramp')return ['rampfx'];const ks=fxKindsOf(ink),K=inkKind();if(TEXK.has(K))ks.unshift('texfx|'+K+'|'+texVariant(K,ink.hex));return ks;}
function cbnFinish(rs){const ks=cbnFinishKinds();if(!ks.length||!rs.length)return;
  const byHex={};for(const r of rs){const h=ink.kind==='ramp'?'r:'+ink.ramp:S.d.palette[S.num[r]-1]||ink.hex;(byHex[h]=byHex[h]||[]).push(r);}
  for(const h of Object.keys(byHex)){const m=new ImageData(W,H);
    for(const r of byHex[h]){const b=r*4,bx=S.bb[b],by=S.bb[b+1];for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],j=i*4;if(ink.kind==='ramp'){const X=i%W,Y=(i/W)|0;m.data[j]=Math.round(pingpong(((X-bx)+(Y-by)*.6)/RAMP_LEN)*255);}m.data[j+3]=255;}}
    const mc=mk();mc.getContext('2d').putImageData(m,0,0);
    if(ink.kind==='ramp')fxAdd(['rampfx'],ink.ramp,mc);else fxAdd(ks,h,mc);}}
function cbnErase(r){const c=S.cbn;if(!c.filled[r])return;c.filled[r]=0;paintRegion(r,[0,0,0],0);if(S.tgt[r]){c.doneT[S.num[r]]--;c.done--;}c.complete=false;
  for(const h of c.hist){const i=h.indexOf(r);if(i>=0)h.splice(i,1);}highlight();drawNums();progress();dirty('cbn');fxClip();}
function shake(){stage.classList.remove('shake');void stage.offsetWidth;stage.classList.add('shake');}
let toastT=0;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),1600);}

/* ---------- free color ---------- */
function snap(){if(S)S.lastOp=null;const f=S.free,er=tool==='eraser'&&mode==='free';S.useq=(S.useq||0)+1;f.undo.push({id:S.useq,t:Date.now(),f:f.ctx.getImageData(0,0,W,H),p:S.pulseUsed?S.pulse.ctx.getImageData(0,0,W,H):null,
    x:er?{l:S.ltr?S.ltr.getContext('2d').getImageData(0,0,W,H):null,rx:S.pp&&S.pp.any?S.pp.rx.getImageData(0,0,W,H):null,ix:S.pp&&S.pp.any?S.pp.ix.getImageData(0,0,W,H):null,pops:JSON.stringify((S.pops||[]).map(({k,anim,...p})=>p))}:null});if(f.undo.length>15){f.undo.shift();const lo=f.undo[0].id;S.fxUndo=(S.fxUndo||[]).filter(e=>e.n>=lo);}}
const undoKey=()=>{const u=S&&S.free&&S.free.undo[S.free.undo.length-1];return u?u.id:0;};
function unsnap(u){S.free.ctx.putImageData(u.f,0,0);if(u.x){const X=u.x;if(X.l&&S.ltr){S.ltr.getContext('2d').putImageData(X.l,0,0);dirty('ltr');if(typeof ltRender==='function')ltRender();}if(X.rx&&S.pp){S.pp.rx.putImageData(X.rx,0,0);S.pp.ix.putImageData(X.ix,0,0);ppRender(S);dirty('pp');}const ps=JSON.parse(X.pops||'[]');if(ps.length!==(S.pops||[]).length){S.pops=ps;renderPops();dirty('pop');}}if(S.pulse){if(u.p)S.pulse.ctx.putImageData(u.p,0,0);else S.pulse.ctx.clearRect(0,0,W,H);dirty('pulse');}}
/* glow inks: soft light halo spilling around the colour (committed with blurred shadows in 'screen') */
function haloDraw(c,src,hex){c.save();c.shadowColor=hex;c.shadowBlur=34;c.globalAlpha=.9;c.drawImage(src,0,0);c.shadowBlur=14;c.globalAlpha=1;c.drawImage(src,0,0);
  c.globalCompositeOperation='screen';c.shadowBlur=0;c.globalAlpha=.35;c.drawImage(src,0,0);c.restore();}
/* pulse inks live on their own layer, which breathes (CSS animation) in the app and is flattened into saved PNGs */
function pulseLayer(){if(!S.pulse){const c=mk();c.className='pulse-layer';S.pulse={c,ctx:c.getContext('2d',{willReadFrequently:true})};
    c.style.setProperty('--pc','#ffb35c');under3D(c);}return S.pulse;}
function fillFree(x,y){
  const r=S.lab[(y|0)*W+(x|0)]; if(!r)return; if(!allowPremiumUse(3))return; snap();
  const b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;
  showTry(r); const pulse=ink.kind==='pulse', halo=ink.kind==='glow', tc=pulse?pulseLayer().ctx:S.free.ctx;
  {const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p];m.data[(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3]=255;}const mc=mk();mc.getContext('2d').putImageData(m,bx,by);fxCoverOld(mc,bx,by,bw,bh,halo?1:adjOp(),pulse);}
  const im=halo?new ImageData(bw,bh):tc.getImageData(bx,by,bw,bh),D=im.data,sh=shader(bx,by,bw,bh);
  const op=halo?1:adjOp();for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],x=i%W,y=(i/W)|0,j=(y-by)*bw*4+(x-bx)*4,c=sh(x,y);if(op<1){const a0=D[j+3]/255,a1=(c[3]??255)/255*op,ao=a1+a0*(1-a1)||1;for(let q=0;q<3;q++)D[j+q]=(c[q]*a1+D[j+q]*a0*(1-a1))/ao;D[j+3]=ao*255;}else{D[j]=c[0];D[j+1]=c[1];D[j+2]=c[2];D[j+3]=c[3]??255;}}
  if(halo){const t=document.createElement('canvas');t.width=W;t.height=H;t.getContext('2d').putImageData(im,bx,by);haloDraw(tc,t,ink.hex);}
  else tc.putImageData(im,bx,by);
  {const a=curAdj();if(a&&adjVal(a,'g')>0){const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],j=(((i/W)|0)-by)*bw*4+((i%W)-bx)*4;m.data[j+3]=255;}const t=mk();t.getContext('2d').putImageData(m,bx,by);adjGlowDraw(tc,t,ink.hex);}}
  if(pulse){S.pulseUsed=true;dirty('pulse');} dirty('free');
  if(ink.kind==='ramp'){const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p],X=i%W,Y=(i/W)|0,j=((Y-by)*bw+(X-bx))*4;m.data[j]=Math.round(pingpong(((X-bx)+(Y-by)*.6)/RAMP_LEN)*255);m.data[j+3]=255;}
    const mc=mk();mc.getContext('2d').putImageData(m,bx,by);fxAdd(['rampfx'],ink.ramp,mc);}
  {const ks=fxKindsOf(ink);if(ks.length){const m=new ImageData(bw,bh);for(let p=S.off[r];p<S.off[r+1];p++){const i=S.pix[p];m.data[(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3]=255;}
    const mc=mk();mc.getContext('2d').putImageData(m,bx,by);fxAdd(ks,ink.hex,mc);}}
  lastOpCapture(tc,bx,by,bw,bh,'fill');
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
  strokeC.style.opacity=tool==='eraser'?'':String(adjOp());stroke={last:[x,y],path:[[x,y]],region:locked?r:0,er:tool==='eraser',st:strokeStyle(),neon:(ink.kind==='neon'||ink.kind==='glow'||(ink.kind==='mix'&&ink.mix.finish==='neon'))&&!strokeStyle(),pulse:ink.kind==='pulse'&&!strokeStyle()&&tool!=='eraser',dirty:null,
    pen:ptype==='pen',inPt:[x,y],exit:null,brace:null};
  lastStroke={snapped:onInk,start:r,regions:locked&&r?[r]:[],breaks:0,locked};
  strokeC.style.filter=stroke.neon?(ink.kind==='glow'?`drop-shadow(0 0 8px ${ink.hex}) drop-shadow(0 0 18px ${ink.hex})`:`drop-shadow(0 0 3px ${ink.hex}) drop-shadow(0 0 9px ${ink.hex})`):'';
  if(stroke.region)setMask(r);
  if(ink.kind==='ramp'&&!stroke.er&&!stroke.st){rampC=rampC||mk();rampT=rampT||mk();rampC.getContext('2d').clearRect(0,0,W,H);rampT.getContext('2d').clearRect(0,0,W,H);stroke.ramp={k:ink.ramp,d:0,last:[x,y]};}
  if(inkKind()==='fur'&&!stroke.er&&!stroke.st){furC=furC||mk();furC.getContext('2d').clearRect(0,0,W,H);stroke.fur={dx:0,dy:1,has:false,s:0,lx:x,ly:y,lanes:null};}
  if(!stroke.er)showTry(r||labAt(x,y));
  stamp(x,y,pr); flush();
}
function stamp(x,y,pr){
  const p=(pr>0&&pr!==.5)?pr:.5;
  if(stroke.er){const R=eraR()/zoomSizeDiv(),P=S.pp;   /* v24: one eraser for everything under it: color, Pulse, tracing, Pop Pencil heights (and Pop Fill shapes, at the end) */
    const cs=[S.free.ctx];if(S.pulse)cs.push(S.pulse.ctx);if(S.ltr&&mode==='free')cs.push(S.ltr.getContext('2d'));if(P&&P.any&&mode==='free'){cs.push(P.rx,P.ix);stroke.ppEr=true;}
    for(const c of cs){c.save();c.globalCompositeOperation='destination-out';c.globalAlpha=.85;c.drawImage(tip,x-R,y-R,2*R,2*R);c.restore();}
    {const r=S.lab[(y|0)*W+(x|0)];if(r)(stroke.erR||(stroke.erR=new Set())).add(r);}
    if(S.pulse)dirty('pulse');if(S.ltr&&mode==='free'){dirty('ltr');stroke.ltEr=true;}return;}
  let R=penR()*(.65+.7*p)/zoomSizeDiv();
  if(stroke.st==='air'){R*=2.4;cov.globalAlpha=.16;for(let k=0;k<16;k++){const a=Math.random()*6.283,d=R*Math.sqrt(-2*Math.log(Math.random()+1e-6))*.42,rr=1+Math.random()*1.8;
      cov.drawImage(tip,x+Math.cos(a)*d-rr,y+Math.sin(a)*d-rr,2*rr,2*rr);}}
  else if(stroke.st==='water'){R*=2.3;cov.globalAlpha=.09;cov.drawImage(tip,x-R,y-R,2*R,2*R);}
  else{const j=R*.15,rich=['metal','glitter','neon','jewel','chrome','lightning'].includes(inkKind())||TEXK.has(inkKind());if(ink.kind==='smoke'||ink.kind==='cloud'){R*=1.5;cov.globalAlpha=ink.kind==='smoke'?.4+.3*p:.5+.35*p;cov.drawImage(tip,x-R,y-R,2*R,2*R);}else{
    cov.globalAlpha=rich?.75+.25*p:.45+.4*p; cov.drawImage(tip,x-R+(Math.random()-.5)*j,y-R+(Math.random()-.5)*j,2*R,2*R);}if(stroke.ramp)rampStamp(x,y,R);if(stroke.fur)furStamp(x,y,R);}
  const d=stroke.dirty,a=[x-R-2,y-R-2,x+R+2,y+R+2];
  stroke.dirty=d?[Math.min(d[0],a[0]),Math.min(d[1],a[1]),Math.max(d[2],a[2]),Math.max(d[3],a[3])]:a;
  {const q=stroke.bbx;stroke.bbx=q?[Math.min(q[0],a[0]),Math.min(q[1],a[1]),Math.max(q[2],a[2]),Math.max(q[3],a[3])]:a.slice();}
}
let furC=null;
const FURP={short:{n:16,life:[.7,1.3],gap:.35,amp:0,lam:1,lw:1.05},long:{n:13,life:[2.4,4],gap:.5,amp:.07,lam:4,lw:1.15},straight:{n:17,life:[5,10],gap:0,amp:0,lam:1,lw:.85},
  wavy:{n:15,life:[6,12],gap:0,amp:.32,lam:2.3,lw:.95},curly:{n:11,life:[6,12],gap:0,curl:.2,lw:.95}};
function furStamp(x,y,R){const f=stroke.fur,c=furC.getContext('2d'),rgb=hex2rgb(ink.hex),P=FURP[furStyle]||FURP.short;
  c.save();c.globalCompositeOperation='destination-over';c.fillStyle=ink.hex;c.beginPath();c.arc(x,y,R+1.5,0,6.283);c.fill();c.restore();   /* flat colour under the strands */
  const ds=Math.hypot(x-f.lx,y-f.ly),s0=f.s;f.s+=ds;const px0=f.lx,py0=f.ly;f.lx=x;f.ly=y;if(!f.has)return;
  const lt=mix(rgb,WHITE,.36).map(Math.round),dk=rgb.map(q=>Math.round(q*.6)),lum=.3*rgb[0]+.59*rgb[1]+.11*rgb[2];
  const newLane=L=>{L.off=(Math.random()*2-1)*.92;L.ph=Math.random()*6.283;L.col=Math.random()<(lum<60?.7:.5)?lt:dk;L.a=.45+.45*Math.random();L.left=R*(P.life[0]+Math.random()*(P.life[1]-P.life[0]));L.on=true;L.prev=null;};
  if(!f.lanes){f.lanes=[];for(let i=0;i<P.n;i++){const L={};newLane(L);L.off=-.92+1.84*(i+Math.random()*.8)/P.n;L.left*=Math.random();f.lanes.push(L);}}
  const nx=-f.dy,ny=f.dx,sub=Math.max(1,Math.ceil(ds/1.5));c.lineCap='butt';c.lineJoin='round';c.lineWidth=Math.max(.8,Math.min(2,R*.07))*P.lw/Math.max(.6,Math.min(1.6,zoomSizeDiv()));
  for(const L of f.lanes){L.left-=ds;if(L.left<=0){if(L.on&&P.gap){L.on=false;L.prev=null;L.left=R*P.gap*(.5+Math.random());}else newLane(L);}
    if(!L.on)continue;c.strokeStyle=`rgba(${L.col},${L.a})`;c.beginPath();let st=!!L.prev;if(st)c.moveTo(L.prev[0],L.prev[1]);
    for(let k=1;k<=sub;k++){const t=k/sub,cx=px0+(x-px0)*t,cy=py0+(y-py0)*t,sv=s0+ds*t;let o=L.off*R,a=0;
      if(P.amp)o+=P.amp*R*Math.sin(sv/(P.lam*R)*6.283+L.ph*.25);
      if(P.curl){const rc=P.curl*R,th=sv/rc+L.ph;o+=Math.sin(th)*rc;a=Math.cos(th)*rc;}
      const qx=cx+nx*o+f.dx*a,qy=cy+ny*o+f.dy*a;if(!st){c.moveTo(qx,qy);st=true;}else c.lineTo(qx,qy);L.prev=[qx,qy];}
    c.stroke();}}
function moveStroke(x,y,pr){
  const [lx,ly]=stroke.last,dx=x-lx,dy=y-ly,dist=Math.hypot(dx,dy);
  if(stroke.fur&&dist>.5){const f=stroke.fur,ux=dx/dist,uy=dy/dist;if(!f.has){f.dx=ux;f.dy=uy;f.has=true;}else{f.dx=f.dx*.65+ux*.35;f.dy=f.dy*.65+uy*.35;const m=Math.hypot(f.dx,f.dy)||1;f.dx/=m;f.dy/=m;}}
  const step=Math.max(.5,(stroke.er?eraR():penR())*(stroke.st?.45:.3)/zoomSizeDiv()), n=Math.floor(dist/step);
  for(let i=1;i<=n;i++){const px=lx+dx*i/n,py=ly+dy*i/n; stroke.region?lockedStamp(px,py,pr):stamp(px,py,pr);}
  if(n){stroke.last=[x,y];const pl=stroke.path,q=pl&&pl[pl.length-1];if(q&&pl.length<800&&Math.hypot(x-q[0],y-q[1])>=3)pl.push([x,y]);} flush();
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
  sctx.globalCompositeOperation='source-in';if(stroke.ramp)sctx.drawImage(rampC,x,y,w,h,x,y,w,h);else if(stroke.fur)sctx.drawImage(furC,x,y,w,h,x,y,w,h);else{sctx.fillStyle=grainPat;sctx.fillRect(x,y,w,h);}sctx.restore();
}
function commitPaint(){
  let src=strokeC;if(!stroke.er&&stroke.st!=='water'){const b=stroke.bbx||[0,0,W,H],bx=b[0]-2,by=b[1]-2,bw=b[2]-b[0]+4,bh=b[3]-b[1]+4;
    if(!stroke.neon&&(fxOverlap(bx,by,bw,bh)||under3DAt(bx,by,bw,bh)))src=solidStroke(strokeC,bx,by,bw,bh);   /* v24: over 3D work / effects the colour lays on top solidly */
    fxCoverOld(src,bx,by,bw,bh,adjOp(),stroke.pulse);}
  if(!stroke.er){const c=stroke.pulse?pulseLayer().ctx:S.free.ctx;adjGlowDraw(c,strokeC,ink.hex);c.save();c.globalAlpha=adjOp();if(stroke.pulse){S.pulseUsed=true;dirty('pulse');}
    if(stroke.neon&&ink.kind==='glow'){haloDraw(c,strokeC,ink.hex);}
    else if(stroke.neon){c.shadowColor=ink.hex;c.shadowBlur=18;c.drawImage(strokeC,0,0);c.shadowBlur=6;c.drawImage(strokeC,0,0);c.shadowBlur=0;}
    else if(stroke.st==='water'){c.globalCompositeOperation='multiply';c.globalAlpha*=.9;}
    c.drawImage(src,0,0);c.restore();
    if(stroke.ramp){const tm=mk(),tx=tm.getContext('2d');tx.drawImage(rampT,0,0);tx.globalCompositeOperation='destination-in';tx.drawImage(strokeC,0,0);fxAdd(['rampfx'],stroke.ramp.k,tm);}
    else fxAdd(fxKindsOf(ink),ink.hex,strokeC,0,0,stroke.path);}
}
function eraserEnd(st){if(!S||mode!=='free')return;if(st.ppEr)ppRender(S);if(st.ltEr&&typeof ltRender==='function')ltRender();
  if(st.erR&&S.pops&&S.pops.length){const n0=S.pops.length;S.pops=S.pops.filter(p=>!(p.rs||[p.r]).some(r=>st.erR.has(r)));if(S.pops.length!==n0){renderPops();dirty('pop');}}}
function endStroke(){ if(!stroke)return; flush(); commitPaint(); if(stroke.er){setTimeout(fxClip,0);eraserEnd(stroke);}else if(stroke.bbx){const b=stroke.bbx;lastOpCapture(stroke.pulse?S.pulse.ctx:S.free.ctx,b[0],b[1],b[2]-b[0],b[3]-b[1],'stroke');}
  dirty('free'); strokeC.style.filter='';strokeC.style.opacity='';
  cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);stroke=null;}
function cancelStroke(){ if(!stroke)return; cov.clearRect(0,0,W,H);sctx.clearRect(0,0,W,H);strokeC.style.filter='';
  const u=S.free.undo.pop(); if(u)unsnap(u); stroke=null;}


/* ---------- v19: Color the lines only (Line pencil) ----------
   When on, every stroke paints ONLY on the original outlines (the line art is always kept underneath, even when the lines are
   faded or hidden), on a trace layer that sits above the line art. Drag = trace a line in the chosen color; tap a line = recolor
   that stretch of line; Eraser rubs out tracing only. Its own undo + autosave. Off = the app behaves exactly as before. */
const LT={on:false};let LTS=null;
const ltrOf=st=>st.ltr||(st.ltr=mk());
function ltMask(){if(S.ltM)return S.ltM;const m=inkMap();if(!m)return null;const M=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(m[i]){M[i]=1;continue;}   // 1 px grow so the antialiased line edges are covered
    if((x>0&&m[i-1])||(x<W-1&&m[i+1])||(y>0&&m[i-W])||(y<H-1&&m[i+W]))M[i]=1;}
  const c=mk(),x=c.getContext('2d'),im=x.createImageData(W,H);for(let i=0;i<M.length;i++)if(M[i])im.data[i*4+3]=255;x.putImageData(im,0,0);
  return (S.ltM={M,c});}
let ltTmp=null,ltSC=null;
function ltRender(){const v=$('#ltrV');if(!v)return;const x=v.getContext('2d');v.style.transform=zoomer.style.transform;x.clearRect(0,0,W,H);if(!S)return;if(S.ltr)x.drawImage(S.ltr,0,0);
  if(LTS&&LTS.moved){const mm=ltMask();if(!mm)return;if(LTS.er){x.save();x.globalCompositeOperation='destination-out';x.drawImage(ltSC,0,0);x.restore();return;}
    ltTmp=ltTmp||mk();const t=ltTmp.getContext('2d');t.clearRect(0,0,W,H);t.drawImage(ltSC,0,0);t.globalCompositeOperation='destination-in';t.drawImage(mm.c,0,0);t.globalCompositeOperation='source-over';x.drawImage(ltTmp,0,0);}}
function ltColor(){return (ink&&ink.kind!=='mix'&&ink.hex)||color;}
function ltWidth(){return Math.max(2,penSize*1.5)/zoomSizeDiv();}
function ltSnap(){S.ltrUndo=S.ltrUndo||[];const c=mk();if(S.ltr)c.getContext('2d').drawImage(S.ltr,0,0);S.ltrUndo.push({t:Date.now(),c});if(S.ltrUndo.length>15)S.ltrUndo.shift();}
function ltUndo(){const u=S.ltrUndo.pop();if(!u)return;const x=ltrOf(S).getContext('2d');x.clearRect(0,0,W,H);x.drawImage(u.c,0,0);dirty('ltr');ltRender();}
function ltDown(x,y){if(!ltMask()){toast('Lines are still loading');return false;}ltSC=ltSC||mk();const c=ltSC.getContext('2d');c.clearRect(0,0,W,H);
  LTS={er:tool==='eraser'||tool==='poperase',last:[x,y],start:[x,y],moved:false,w:ltWidth(),col:ltColor()};return true;}
function ltMove(x,y){if(!LTS)return;const c=ltSC.getContext('2d');if(!LTS.moved&&Math.hypot(x-LTS.start[0],y-LTS.start[1])*scrScale()<5)return;
  if(!LTS.moved){LTS.moved=true;c.fillStyle=LTS.col;c.beginPath();c.arc(LTS.start[0],LTS.start[1],LTS.w/2,0,6.2832);c.fill();}
  c.strokeStyle=LTS.er?'#000':LTS.col;c.lineWidth=LTS.er?LTS.w*1.6:LTS.w;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(LTS.last[0],LTS.last[1]);c.lineTo(x,y);c.stroke();LTS.last=[x,y];
  cancelAnimationFrame(ltMove.r);ltMove.r=requestAnimationFrame(ltRender);}
function ltUp(x,y){const L=LTS;LTS=null;if(!L)return;
  if(!L.moved){ltTap(L.start[0],L.start[1],L.er);return;}
  ltSnap();const d=ltrOf(S).getContext('2d');
  if(L.er){d.save();d.globalCompositeOperation='destination-out';d.drawImage(ltSC,0,0);d.restore();}
  else{const mm=ltMask();ltTmp=ltTmp||mk();const t=ltTmp.getContext('2d');t.clearRect(0,0,W,H);t.drawImage(ltSC,0,0);t.globalCompositeOperation='destination-in';t.drawImage(mm.c,0,0);t.globalCompositeOperation='source-over';d.drawImage(ltTmp,0,0);}
  dirty('ltr');ltRender();}
/* tap a line: that stretch of line (connected outline pixels, up to ~150 px along the line from the tap) takes the color */
function ltTap(x,y,er){const mm=ltMask();if(!mm)return;const M=mm.M;x|=0;y|=0;let s=-1;
  for(let r=0;r<=10&&s<0;r++)for(let dy=-r;dy<=r&&s<0;dy++)for(let dx=-r;dx<=r;dx++){const u=x+dx,v=y+dy;if(u>=0&&v>=0&&u<W&&v<H&&M[v*W+u]){s=v*W+u;break;}}
  if(s<0){toast('Tap right on a line (or drag along it) to color it');return;}
  const LIM=150,seen=new Uint8Array(W*H);let q=[s];seen[s]=1;const px=[s];
  for(let d=0;d<LIM&&q.length;d++){const nq=[];for(const i of q){const ix=i%W,iy=(i/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const u=ix+dx,v=iy+dy;if(u<0||v<0||u>=W||v>=H)continue;const j=v*W+u;if(!seen[j]&&M[j]){seen[j]=1;nq.push(j);px.push(j);}}}q=nq;}
  ltSnap();const d=ltrOf(S).getContext('2d');let x0=W,y0=H,x1=0,y1=0;for(const i of px){const a=i%W,b=(i/W)|0;if(a<x0)x0=a;if(a>x1)x1=a;if(b<y0)y0=b;if(b>y1)y1=b;}
  const w=x1-x0+1,h=y1-y0+1,im=d.getImageData(x0,y0,w,h),D=im.data,rgb=hex2rgb(ltColor());
  for(const i of px){const j=(((i/W)|0)-y0)*w*4+((i%W)-x0)*4;if(er){D[j+3]=0;}else{D[j]=rgb[0];D[j+1]=rgb[1];D[j+2]=rgb[2];D[j+3]=255;}}
  d.putImageData(im,x0,y0);dirty('ltr');ltRender();}
function ltSet(on){LT.on=!!on;app.classList.toggle('ltmode',LT.on);for(const id of ['#lnTrace','#ltBtn']){const b=$(id);if(b){b.classList.toggle('on',LT.on);b.setAttribute('aria-pressed',String(LT.on));}}
  if(LT.on){ltMask();toast('Color the lines only: drag along a line or tap it · stays on the lines, even hidden ones');}else toast('Color the lines only: off');}

/* ---------- deep zoom (to 8x): pinch + two-finger pan, wheel toward cursor, space/middle-drag pan, + / − / fit ----------
   Lines switch to a vector overlay (data/scene_NN_line.js, traced from the app's own line art) once zoomed in, so they stay crisp.
   Numbers are redrawn on a screen-resolution overlay; small unnumbered regions get their number once they are big enough on screen. */
const MAXZ=8, VEC_FROM=1.35, NUM_FROM=1.5;
let Z={z:1,x:0,y:0};
/* v16 Smart Grab: pointer mode = auto | hand | draw (default auto). In Auto, zooming IN switches to Draw and zooming OUT to the Hand
   (grab and pull to pan), as Miles described. Flip the rule with ONE setting: settings.grabRule='in-hand' (zoom in = hand, zoom out = draw).
   Space held = a temporary hand. Tools are never changed by it. Two-finger pinch / pan keeps working on touch. */
const GRAB={auto:'draw',lastZ:1};
const grabMode=()=>settings.grab||'auto';
function handOn(){const m=grabMode();return spaceDown||m==='hand'||(m==='auto'&&GRAB.auto==='hand');}
function grabAutoZoom(z0,z1){if(Math.abs(z1-z0)<.001)return;const zin=z1>z0,rule=settings.grabRule==='in-hand'?'in-hand':'in-draw';GRAB.auto=(z1<=1.001)?'draw':(zin===(rule==='in-draw'))?'draw':'hand';grabUI();}   /* back at the whole page there is nothing to pan, so Auto returns to drawing */
function grabUI(){const m=grabMode(),h=handOn();stage.classList.toggle('handmode',h);$$('#grabSw button').forEach(b=>{b.classList.toggle('on',b.dataset.g===m);b.classList.toggle('eff',m==='auto'&&b.dataset.g===(h?'hand':'draw'));b.setAttribute('aria-pressed',String(b.dataset.g===m));});
  const a=$('#grabAuto');if(a)a.title=`Auto (Smart Grab): zoom ${settings.grabRule==='in-hand'?'in to grab and pan, zoom out to draw':'in to draw, zoom out to grab and pan'} · now: ${h?'Hand':'Draw'}`;}
function setGrab(m){settings.grab=m;LS.set('settings',settings);grabUI();toast(m==='hand'?'Hand: grab and pull to pan':m==='draw'?'Draw: clicks draw and color':'Auto: zoom in to draw, zoom out to grab and pan');}
const vline=$('#vline'), numO=$('#numsO'), nox=numO.getContext('2d');
function stageSize(){return [stage.clientWidth||1,stage.clientHeight||1];}
function zoomSizeDiv(){return settings.sizeZoom===false?1:Z.z;}
function visWin(sw,sh){if(!app.classList.contains('phfill'))return [0,sw,0,sh];const w=$('#stagewrap').getBoundingClientRect(),r=stage.getBoundingClientRect();   /* v21: the part of the stage you can see (phone fill: the page is wider than the screen) */
  return [Math.max(0,w.left-r.left),Math.min(sw,w.right-r.left),Math.max(0,w.top-r.top),Math.min(sh,w.bottom-r.top)];}
function applyZoom(){const [sw,sh]=stageSize();Z.z=Math.min(MAXZ,Math.max(1,Z.z));const [vl,vr,vt,vb]=visWin(sw,sh);
  Z.x=Math.min(vl,Math.max(vr-sw*Z.z,Z.x));Z.y=Math.min(vt,Math.max(vb-sh*Z.z,Z.y));
  zoomer.style.transform=`translate(${Z.x}px,${Z.y}px) scale(${Z.z})`;{const lv=$('#ltrV');if(lv)lv.style.transform=zoomer.style.transform;}if(GRAB.lastZ!==Z.z){grabAutoZoom(GRAB.lastZ,Z.z);GRAB.lastZ=Z.z;}
  $('#zoomPct').textContent=Math.round(Z.z*100)+'%';$('#zoomOut').disabled=Z.z<=1.001;$('#zoomIn').disabled=Z.z>=MAXZ-.001;
  const k=sw/W*Z.z; vline.setAttribute('viewBox',`${(-Z.x/k).toFixed(2)} ${(-Z.y/k).toFixed(2)} ${(W/Z.z).toFixed(2)} ${(H/Z.z).toFixed(2)}`);
  const vec=Z.z>=VEC_FROM&&vline.dataset.n==(S&&S.n); app.classList.toggle('vec',vec);
  app.classList.toggle('zoomnums',Z.z>=NUM_FROM); scheduleNums(); popParallax();}
function resetZoom(){Z={z:1,x:0,y:0};GRAB.lastZ=1;GRAB.auto='draw';applyZoom();grabUI();}   /* scene change / Fit: whole page, so Auto goes back to drawing */
function zoomAt(z1,mx,my){const [sw,sh]=stageSize();if(mx==null){mx=sw/2;my=sh/2;}const z0=Z.z;z1=Math.min(MAXZ,Math.max(1,z1));
  Z.x=mx-(mx-Z.x)*z1/z0;Z.y=my-(my-Z.y)*z1/z0;Z.z=z1;applyZoom();}
stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();
  if(e.ctrlKey||Math.abs(e.deltaY)>=Math.abs(e.deltaX))zoomAt(Z.z*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY-r.top);
  else{Z.x-=e.deltaX;applyZoom();}},{passive:false});
$('#zoomIn').onclick=()=>zoomAt(Z.z*1.6);$('#zoomOut').onclick=()=>zoomAt(Z.z/1.6);$('#zoomFit').onclick=()=>{if(phPortrait()){phFill(!app.classList.contains('phfill'));settings.phFit=!app.classList.contains('phfill');LS.set('settings',settings);}else resetZoom();};
/* v21: phone portrait opens with the page filling the height (pan with two fingers, pinch to zoom); ⤢ toggles Fit (whole page) / Fill */
const phPortrait=()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches;
function phFill(on){app.classList.toggle('phfill',!!on);const f=$('#zoomFit');if(f){f.title=on?'Fit: show the whole page':'Fill: page fills the screen height';f.classList.toggle('on',!on);}
  requestAnimationFrame(()=>{resetZoom();if(on){const [sw]=stageSize(),[vl,vr]=visWin(sw,1);Z.x=0;applyZoom();}});}
function phFillAuto(){phFill(phPortrait()&&!settings.phFit);}
matchMedia('(max-width:600px) and (orientation:portrait)').addEventListener('change',phFillAuto);
setTimeout(phFillAuto,0);
/* v21: one-time tip on phones held upright */
function sideTip(){if(settings.sideTip||!phPortrait())return;const t=document.createElement('div');t.id='sideTip';t.className='sidetip';t.setAttribute('role','status');
  t.innerHTML='<div><b>Turn your phone sideways to see the whole page</b><span>Or pinch and drag with two fingers · ⤢ shows the whole page</span></div><button aria-label="Got it">Got it</button>';
  t.querySelector('button').onclick=()=>{settings.sideTip=1;LS.set('settings',settings);t.remove();};document.body.appendChild(t);}
setTimeout(sideTip,1200);
let spaceDown=false;
$$('#grabSw button').forEach(b=>b.onclick=()=>setGrab(b.dataset.g));grabUI();
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){spaceDown=true;stage.classList.add('panready');grabUI();e.preventDefault();}
  if(!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){if(e.key==='+'||e.key==='=')zoomAt(Z.z*1.6);else if(e.key==='-')zoomAt(Z.z/1.6);else if(e.key==='0')resetZoom();}});
document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;stage.classList.remove('panready');grabUI();}});
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
window.addEventListener('resize',()=>{applyZoom();fitSoon();});
try{new ResizeObserver(fitSoon).observe(document.querySelector('#bottom'));}catch(e){}

/* ---------- pointer input ---------- */
const ptrs=new Map(); let pinch=null, down=null;
function toCanvas(e){const r=zoomer.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];}
stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return; if(e.target.closest&&e.target.closest('.zoomui,.grabui,.tryrow,.nudge,.ideasbar'))return;
  stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.button===1||spaceDown){e.preventDefault();down={x:e.clientX,y:e.clientY,id:e.pointerId,pan:true,zx:Z.x,zy:Z.y};stage.classList.add('panning');return;}
  if(ptrs.size===2){cancelStroke();down=null;const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,z:Z.z,x:Z.x,y:Z.y};return;}
  if(ptrs.size>2)return;
  if(handOn()){e.preventDefault();down={x:e.clientX,y:e.clientY,id:e.pointerId,pan:true,zx:Z.x,zy:Z.y};stage.classList.add('panning');return;}   /* v16 Smart Grab: hand = pan, the tool stays as it is */
  const [x,y]=toCanvas(e); down={x:e.clientX,y:e.clientY,cx:x,cy:y,t:performance.now(),id:e.pointerId,zx:Z.x,zy:Z.y};
  if(LT.on&&S){down.lt=ltDown(x,y)?1:2;return;}   /* v19: Color the lines only */
  // a one-finger / pen stroke with a drawing tool always draws (never pans); other tools pan when dragged while zoomed
  if(mode==='free'&&(tool==='pencil'||tool==='eraser'||tool==='airbrush'||tool==='watercolor'))beginStroke(x,y,e.pressure,e.pointerType);
  else if(tool==='poppencil'){ppBegin(x,y);down.pp=!!pps;if(pps&&mode==='free'&&settings.ppColor!==false)beginStroke(x,y,e.pressure,e.pointerType);}   // Color while popping: raise + paint in one stroke
});
stage.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const r=stage.getBoundingClientRect();
    const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top,z=Math.min(MAXZ,Math.max(1,pinch.z*d/pinch.d));
    Z.z=z;Z.x=mx-(pinch.mx-pinch.x)*z/pinch.z;Z.y=my-(pinch.my-pinch.y)*z/pinch.z;applyZoom();return;}
  if(down&&down.lt===1&&e.pointerId===down.id){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ev of (evs.length?evs:[e])){const [x,y]=toCanvas(ev);ltMove(x,y);}return;}
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
  if(down.lt){if(down.lt===1){if(e.type==='pointerup')ltUp();else{LTS=null;ltRender();}}down=null;return;}
  if(pps){ppEnd();if(stroke){const r=stroke.region||labAt(down.cx,down.cy);endStroke();helperAfterColor(r);}down=null;return;}
  if(stroke){const r=stroke.region||labAt(down.cx,down.cy);endStroke();helperAfterColor(r);}
  else if(e.type==='pointerup'&&moved<14){ if(mode==='cbn'&&tool==='pop')popTap(down.cx,down.cy); else if(mode==='cbn'&&tool==='poperase')popErase(down.cx,down.cy); else if(mode==='cbn'&&tool!=='poppencil')tapCBN(down.cx,down.cy); else if(mode==='cbn'){} else if(tool==='fill')fillFree(down.cx,down.cy); else if(tool==='pop')popTap(down.cx,down.cy); else if(tool==='poperase')popErase(down.cx,down.cy); }
  down=null;
}
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
stage.addEventListener('contextmenu',e=>e.preventDefault());


/* ---------- 3D Pop: distance-transform height map -> bevel lighting (top-left light), inner shadow, soft drop shadow ---------- */
const POP={depth:Math.abs(+(settings.popDepth||60)),pressed:settings.popMode==='pressed'||settings.popMode==='inset',flat:settings.popMode==='flat',whole:settings.popWhole!==false};
POP.whole=true;
{const h=typeof settings.popH==='number'?Math.max(-1,Math.min(1,settings.popH)):(POP.pressed?-.6:.6);POP.hv=Math.abs(h);POP.flat=h===0;POP.pressed=h<0;POP.depth=Math.max(10,Math.round(POP.hv*100));}
const popH=()=>POP.flat?0:(POP.pressed?-1:1)*POP.hv;   // v12: one two-way height: + raises, 0 flat, - insets
function setPopH(v){v=Math.max(-1,Math.min(1,Math.round(v*100)/100));POP.flat=v===0;if(v)POP.pressed=v<0;POP.hv=Math.abs(v);if(v)POP.depth=Math.max(10,Math.round(POP.hv*100));
  settings.popH=v;settings.popMode=POP.flat?'flat':POP.pressed?'inset':'raised';LS.set('settings',settings);popUI();}
const popModeName=()=>POP.pressed?'Inset':'Raise';
function chamfer(d,w,h){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}}
function popRender(st,pop,sh,li){ // draws one pop into shadow ctx `sh` and light ctx `li` (both W×H)
  const rs0=pop.rs||[pop.r],inG=new Set(rs0),A=adjacency(st),rs=rs0.slice();
  const one=rs0.length===1;   // v13: a single line-enclosed area keeps its holes, so enclosed shapes (clouds, lightning, stars) get a clean frame
  if(!one)for(const r of rs0)for(const b of A[r])if(!inG.has(b)&&st.cnt[b]<6000&&[...A[b]].every(q=>inG.has(q)||q===b)){inG.add(b);rs.push(b);}  // fill enclosed holes (stars, specks)
  let bx0=W,by0=H,bx1=-1,by1=-1;for(const r of rs){const b=r*4;if(st.bb[b+2]<0)continue;bx0=Math.min(bx0,st.bb[b]);by0=Math.min(by0,st.bb[b+1]);bx1=Math.max(bx1,st.bb[b+2]);by1=Math.max(by1,st.bb[b+3]);}
  if(bx1<0)return;const D=(4+pop.depth*.22)*(pop.hz!=null?.45+.9*pop.hz:1)*(pop.k==null?1:.3+.7*pop.k),M=Math.ceil(D*1.6)+10;
  const x0=Math.max(0,bx0-M),y0=Math.max(0,by0-M),x1=Math.min(W-1,bx1+M),y1=Math.min(H-1,by1+M),w=x1-x0+1,h=y1-y0+1;
  const m=new Uint8Array(w*h);for(const r of rs)for(let p=st.off[r];p<st.off[r+1];p++){const i=st.pix[p],x=i%W-x0,y=((i/W)|0)-y0;m[y*w+x]=1;}
  if(!one){ // close the mask across thin line ink (rays, outlines between same-group regions) so lines don't read as grooves
    const R=5,cham=(src)=>{const o=new Float32Array(w*h);for(let i=0;i<w*h;i++)o[i]=src(i)?1e9:0;chamfer(o,w,h);return o;};
    const dOut=cham(i=>!m[i]),dil=new Uint8Array(w*h);for(let i=0;i<w*h;i++)dil[i]=dOut[i]<=R;
    const dIn=cham(i=>dil[i]);for(let i=0;i<w*h;i++)if(!m[i]&&dIn[i]>R)m[i]=1;}
  const d=new Float32Array(w*h),INF=1e9;for(let i=0;i<w*h;i++)d[i]=m[i]?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}
  const hg=new Float32Array(w*h);for(let i=0;i<w*h;i++){const t=Math.min(1,d[i]/D);hg[i]=t*t*(3-2*t);}
  const im=new ImageData(w,h),P=im.data,sg=pop.pressed?-1:1,bw=bx1-bx0+1,bh=by1-by0+1,bgp=one&&isBackdrop(st,rs0[0]);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!m[i])continue;
    const gx=(hg[i+1]-hg[i-1])*.5,gy=(hg[i+w]-hg[i-w])*.5,dot=sg*(gx+gy)*.7071*D*.9;   // light from the top-left
    const j=i*4,u=((x+x0-bx0)/bw+(y+y0-by0)/bh)/2,amb=sg*(.5-u)*.16;       // soft top-left sheen across the face
    const v=dot+amb-(pop.pressed&&!bgp?.28*hg[i]:0);   // inset: darker toward the middle (the pressed background keeps the older even look)
    if(v>0){P[j]=255;P[j+1]=250;P[j+2]=240;P[j+3]=Math.min(28,v*60);}   /* v16: lit side shows the real color (faint sheen only), shadow side stays dark */else{P[j]=16;P[j+1]=10;P[j+2]=5;P[j+3]=Math.min(165,-v*230);}}
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
  if((st.pops||[]).length){const mark=new Uint8Array(st.N);for(const p of st.pops)for(const q of (p.rs||[p.r]))mark[q]=1;const rm=regionMask(st,mark);for(const c of [sh,li]){c.save();c.globalCompositeOperation='destination-in';c.drawImage(rm,0,0);c.restore();}}   // v12: strictly inside the popped areas
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
/* v16: Pop Fill (was 3D Pop) works like Fill: one tap raises (or, with Inset, presses in) the line-enclosed area at the slider height;
   tapping it again re-applies the current direction / height; the slider then drives that last-tapped area. With Color while popping
   on, the same tap also fills the area with the current pencil or effect (Free Color) or its numbered color (Color by Number). */
function popTap(x,y){const r=labAt(x,y);if(!r)return;S.pops=S.pops||[];S.popNext={};const i=S.pops.findIndex(p=>(p.rs||[p.r]).includes(r));
  if(POP.flat){if(i>=0){S.pops.splice(i,1);renderPops();dirty('pop');toast('Flattened');}else toast('Flat: set the slider to Raise or Inset, then tap an area');S.popSel={k:'pop',r};return;}
  const T=depthOf(S),pressed=(T&&T.lv[r]<0)?true:!!POP.pressed,depth=Math.max(10,Math.round(POP.depth)),fin=()=>{renderPops();dirty('pop');if(S&&S.popSel&&S.popSel.r===r)popSelect('pop',r);};
  S.popSel={k:'pop',r};
  if(i>=0){const p=S.pops[i];if(p.anim)return;const same=p.pressed===pressed&&p.depth===depth;p.pressed=pressed;p.depth=depth;if(same)fin();else{p.anim=1;popAnim(p,0,1,()=>{delete p.anim;fin();});}}
  else{if(!Effects3D.unlocked()){if(Trials.popsLeft()<=0){openUpgrade(null,'effects3d');return;}Trials.spendPop();refreshPremiumUI();
      const l=Trials.popsLeft();toast(l?`Pop Fill · free tries: ${l} left`:'That was your last free Pop Fill ✦');}
    const p={r,rs:[r],depth,pressed,hz:null};S.pops.push(p);p.anim=1;popAnim(p,0,1,()=>{delete p.anim;fin();});}
  if(settings.ppColor!==false)popColor(x,y,r);}
function popColor(x,y,r){if(mode==='free'){if(ink&&ink.kind==='brush')return;fillFree(x,y);}else if(!S.cbn.filled[r]&&S.num[r]===selNum)tapCBN(x,y);}
function shake(){stage.classList.remove('shake');void stage.offsetWidth;stage.classList.add('shake');try{navigator.vibrate&&navigator.vibrate(15);}catch(e){}}
function popRestyle(){applySelHeight(popH());}   // v13: the slider / switch drive only the selected section
/* v13: the Pop height slider follows the section you last drew in or tapped (Pop Pencil, 3D Pop, Pop Erase). Moving it sets
   that one section's height (whole line-enclosed area, + raise / - inset / 0 flat); other sections keep their own heights. */
function popSelect(k,r){if(!S||!r)return;S.popSel={k,r};const h=selHeight();if(h!=null){POP.hv=Math.abs(h)||POP.hv;if(h){POP.pressed=h<0;POP.flat=false;}popUI(Math.round(h*100));}}
function selHeight(){if(!S||!S.popSel)return null;const {k,r}=S.popSel;
  if(k==='pop'){const p=(S.pops||[]).find(q=>(q.rs||[q.r]).includes(r));return p?(p.pressed?-1:1)*Math.min(1,p.depth/100):0;}
  const P=S.pp;if(!P)return 0;const b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;if(bw<=0)return 0;
  const d=P.rx.getImageData(bx,by,bw,bh).data,e=P.ix.getImageData(bx,by,bw,bh).data,n=S.off[r+1]-S.off[r],st=Math.max(1,(n/4000)|0);let best=0;
  for(let q=S.off[r];q<S.off[r+1];q+=st){const i=S.pix[q],j=(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3,v=(d[j]-e[j])/255;if(Math.abs(v)>Math.abs(best))best=v;}return best;}
function applySelHeight(v){if(!S||!S.popSel)return false;const {k,r}=S.popSel;
  if(k==='pop'){S.pops=S.pops||[];const i=S.pops.findIndex(q=>(q.rs||[q.r]).includes(r));
    if(!v){if(i>=0){S.pops.splice(i,1);renderPops();dirty('pop');}return true;}
    if(i>=0){const p=S.pops[i];p.depth=Math.max(10,Math.round(Math.abs(v)*100));p.pressed=v<0;}else S.pops.push({r,rs:[r],depth:Math.max(10,Math.round(Math.abs(v)*100)),pressed:v<0,hz:null});
    renderPops();dirty('pop');return true;}
  const P=ppCanvases(S),b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;if(bw<=0)return false;
  const R=P.rx.getImageData(bx,by,bw,bh),I=P.ix.getImageData(bx,by,bw,bh),a=Math.round(Math.abs(v)*255);
  for(let q=S.off[r];q<S.off[r+1];q++){const i=S.pix[q],j=(((i/W)|0)-by)*bw*4+((i%W)-bx)*4+3;R.data[j]=v>0?a:0;I.data[j]=v<0?a:0;}
  P.rx.putImageData(R,bx,by);P.ix.putImageData(I,bx,by);clearTimeout(applySelHeight.t);applySelHeight.t=setTimeout(()=>{ppRender(S);dirty('pp');},40);return true;}
function popUI(show){const hs=$('#ppH');if(hs){const v=show!=null?show:Math.round(popH()*100);if(+hs.value!==v)hs.value=v;const nb=$('#ppHn');if(nb&&document.activeElement!==nb)nb.value=fxNum(v/100);const o=$('#ppHv');if(o)o.textContent=v>0?'Raise '+v:v<0?'Inset '+(-v):'Flat';hs.style.setProperty('--p',((v+100)/2)+'%');}
  const m=$('#popMode');m.setAttribute('aria-pressed',String(POP.pressed));m.dataset.m=popModeName().toLowerCase();
  m.querySelectorAll('i').forEach(b=>b.classList.toggle('on',b.dataset.v===m.dataset.m));}
/* Pop Erase: flattens a manual pop (2D) or the template relief of an area (3D modes); tap again in 3D to restore */
function popErase(x,y){const r=labAt(x,y);if(!r||!S)return;const hadPop=(S.pops||[]).some(q=>(q.rs||[q.r]).includes(r));S.popSel={k:hadPop?'pop':'pp',r};setTimeout(()=>popUI(0),0);if(ppEraseAt(r)){toast('Flattened');return;}
  {const i=(S.pops||[]).findIndex(p=>(p.rs||[p.r]).includes(r));if(i>=0){S.pops.splice(i,1);renderPops();dirty('pop');toast('Flattened');return;}if(!D3.on){toast('Nothing raised here');return;}}   /* v16: Pop Fill shapes flatten first, in 2D and 3D; in 3D a second tap flattens the page relief */
  const T=depthOf(S);if(!T)return;S.flat3d=S.flat3d||[];const fl=new Set(S.flat3d);
  if(!T.lv[r]){toast('Already flat');return;}
  const rs=POP.whole?objectOf(S,r):[r],back=rs.every(q=>fl.has(q));
  rs.forEach(q=>back?fl.delete(q):fl.add(q));S.flat3d=[...fl];fl.size?LS.set('flat3d.'+S.n,S.flat3d):LS.del('flat3d.'+S.n);
  S.relief=null;apply3D(true);toast(back?'3D restored':'Flattened · tap again to restore');}
let tilt={x:0,y:0};
function popParallax(){relParallax();if(!S||!S.popSh)return;S.popSh.style.transform=S.popLi.style.transform='';}   // v12: pops stay put inside their lines (no parallax drift over neighbours)
stage.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!S||!((S.pops&&S.pops.length)||D3.on))return;D3.lastMove=performance.now();const r=stage.getBoundingClientRect();
  tilt={x:((e.clientX-r.left)/r.width-.5)*2.4,y:((e.clientY-r.top)/r.height-.5)*2.4};popParallax();});
let orientOn=false;
function enableTilt(){if(orientOn)return;const go=()=>{orientOn=true;window.addEventListener('deviceorientation',e=>{if(e.gamma==null)return;
    tilt={x:Math.max(-1,Math.min(1,e.gamma/30))*1.2,y:Math.max(-1,Math.min(1,(e.beta-40)/30))*1.2};D3.lastMove=performance.now();popParallax();});};
  try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')DeviceOrientationEvent.requestPermission().then(s=>s==='granted'&&go()).catch(()=>{});
    else if(window.DeviceOrientationEvent)go();}catch(e){}}
/* ---------- 3D modes: per-scene depth template (data/scene_NN_depth.js, from build_depth.py) ---------- */
const pad2=n=>String(n).padStart(2,'0');
function needDepth(n){return new Promise(res=>{if((window.EP_DEPTH||{})[n])return res(window.EP_DEPTH[n]);const c=CHM[n];if(!c||!c.data||c.nodepth)return res(null);
  const sc=document.createElement('script');sc.src=c.data.replace(/\.js$/,'_depth.js');sc.onload=()=>res((window.EP_DEPTH||{})[n]||null);sc.onerror=()=>res(null);document.head.appendChild(sc);});}
const depthOf=st=>st&&(window.EP_DEPTH||{})[st.n]||null;
function objectOf(st,r){const T=depthOf(st),o=T.ob[r],l=T.lv[r],out=[];for(let q=1;q<st.N;q++)if(T.ob[q]===o&&T.lv[q]===l)out.push(q);return out;}
function cleanPops(st){const T=depthOf(st);if(!T||!st.pops||!st.pops.length)return;const n0=st.pops.length;
  st.pops=st.pops.filter(p=>(p.rs||[p.r]).length);/* v13: every area can stay popped, the open background too */if(st.pops.length!==n0){renderPops(st);savePops(st);}}
const D3={on:false,want:true,band:false,lastMove:0,fresh:true};
const allowed3D=n=>n===FREE_3D_SCENE||Effects3D.unlocked();
const FREE_3D_SCENE=4;
function modeLabels(){const a=toolSet==='3d';$$('.mode').forEach(b=>b.textContent=b.dataset.mode==='cbn'?(a?'3D by Number':'Color by Number'):(a?'3D Free Color':'Free Color'));
  for(const [id,on] of [['#btn2d',!a],['#btn3d',a]]){const b=$(id);if(b){b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}}}   /* v18: two separate 2D / 3D buttons, first in the bottom bar */
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
    if(v>0){P[j]=255;P[j+1]=250;P[j+2]=238;P[j+3]=Math.min(46,v*90);}   /* v16: the lit side keeps the real color (soft sheen only) */else{P[j]=44;P[j+1]=27;P[j+2]=12;P[j+3]=Math.min(160,-v*230);}}
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
  if(want&&!allowed3D(S.n)){D3.on=false;if(!quiet)openUpgrade(null,'effects3d');}
  else D3.on=want;
  $$('.rel-sh,.rel-li').forEach(c=>c.remove());
  app.classList.toggle('d3',D3.on);
  if(D3.on){if(!S.relief)S.relief=buildRelief(S);const f=S.free.c.nextSibling;layers.insertBefore(S.relief.sh,S.pulse?S.pulse.c.nextSibling:f);layers.insertBefore(S.relief.li,S.relief.sh.nextSibling);
    if(S.popSh){S.popSh.style.display='';S.popLi.style.display='';}}   /* v16: Pop Fill / Pop Pencil / Pop Erase all work in the 3D view too */
  else if(S.popSh){S.popSh.style.display='';S.popLi.style.display='';}
  if(!D3.on&&D3.band)bandView(false);
  if(D3.fresh){D3.fresh=false;setToolSet(D3.on?'3d':'2d');}else if(!D3.on&&toolSet==='3d')setToolSet('2d');
  modeLabels();popParallax();sway();}
function set3D(v){D3.want=v;settings.view3d=v;LS.set('settings',settings);if(v)enableTilt();
  if(v&&S&&!allowed3D(S.n)){D3.want=false;settings.view3d=false;LS.set('settings',settings);openUpgrade(null,'effects3d');modeLabels();return;}
  if(!S)return;needDepth(S.n).then(()=>{apply3D(false);if(v&&!D3.on&&!depthOf(S)){D3.want=false;settings.view3d=false;LS.set('settings',settings);modeLabels();toast('3D isn\'t available on this page yet · staying in 2D');return;}toast(D3.on?(mode==='cbn'?'3D by Number':'3D Free Color')+' · color right onto the relief':(mode==='cbn'?'Color by Number':'Free Color'));});}
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
/* v11 effect sliders (remembered): Shimmer / Sparkle go from Off (standard, still) to Full; Pulse speed; Glow strength */
const FXS={shimmer:{lab:'Shimmer',def:.7,min:0,max:1,step:.05,tip:'Shimmer: how much chrome, metallic and jewel light moves (Off = still, standard)'},
  sparkle:{lab:'Sparkle',def:.7,min:0,max:1,step:.05,tip:'Sparkle: how much glitter twinkles (Off = still, standard)'},
  shimmerSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Shimmer speed: slower to faster (chrome, metallic, jewel)'},
  twinkleSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Twinkle speed: slower to faster'},neonSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Neon flicker speed: slower to faster'},
  glowSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Glowing breathing speed: slower to faster'},boltSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Lightning flash speed: slower to faster'},
  boltStr:{lab:'Flash',def:1,min:0,max:2,step:.01,tip:'Lightning flash intensity: calm glow only (0) to blinding'},
  pulseSpeed:{lab:'Speed',def:1,min:.02,max:2.5,step:.01,tip:'Pulse speed: slow to fast'},smokeSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Smoke drift speed: near-still crawl to faster'},partSpeed:{lab:'Speed',def:1,min:.02,max:3,step:.01,tip:'Particle speed (water, fire, sparks, snow, bubbles, stars, leaves)'},fxContrast:{lab:'Contrast',def:1,min:.6,max:1.6,step:.01,tip:'Contrast: soft and subtle to sharp and punchy highlights'},fxHue:{lab:'Hue',def:0,min:-25,max:25,step:1,tip:'Hue: a gentle tint of the effect colour (0 = unchanged)'},glowStr:{lab:'Glowing',def:1,min:.2,max:2,step:.05,tip:'Glowing strength: soft to strong (the animated Glowing set)'}};
/* v22: Speed sliders run on a log curve (0.02x crawl .. max), so the slow end gets most of the travel */
const isSpd=k=>/Speed$/.test(k),spdPos=(k,v)=>{const f=FXS[k];return Math.log(Math.max(f.min,Math.min(f.max,v))/f.min)/Math.log(f.max/f.min);},spdVal=(k,p)=>{const f=FXS[k];return Math.round(f.min*Math.pow(f.max/f.min,p)*1000)/1000;};
function motionLvl(k){const v=settings[k];if(typeof v==='number'&&isFinite(v))return v;return FXS[k].def*(RM.matches&&(k==='shimmer'||k==='sparkle')?.5:1);}
const fxsLabel=(k,v)=>k==='fxHue'?(v>0?'+':'')+Math.round(v)+'°':(k==='shimmer'||k==='sparkle')?(v<=0?'Off':v>=.99?'Full':Math.round(v*100)+'%'):(k==='pulseSpeed'?(v<.2?'crawl':v<.8?'slow':v>1.6?'fast':'normal'):/Speed$/.test(k)?(v<.1?(Math.round(v*1000)/1000):(Math.round(v*100)/100))+'×':Math.round(v*100)+'%');
const fxNum=v=>String(v<.1?Math.round(v*1000)/1000:Math.round(v*100)/100);
const FXPIC=['shimmer','sparkle','shimmerSpeed','twinkleSpeed','neonSpeed','glowSpeed','boltSpeed','boltStr','pulseSpeed','glowStr','smokeSpeed','partSpeed'];
let fxsT=0;function setFxs(k,v){settings[k]=v;if(FXLINK.includes(k))for(const q of FXLINK)settings[q]=Math.max(FXS[q].min,Math.min(FXS[q].max,v));clearTimeout(fxsT);fxsT=setTimeout(()=>{LS.set('settings',settings);if(S){const o={};FXPIC.forEach(q=>{if(typeof settings[q]==='number')o[q]=settings[q];});LS.set('fxs.'+S.n,o);}},250);applyFxs();}   /* v22: slider values are saved with the picture too */
function fxsForScene(n){const o=LS.get('fxs.'+n,null);if(o&&typeof o==='object')for(const q of FXPIC)if(typeof o[q]==='number'&&isFinite(o[q]))settings[q]=o[q];applyFxs();}
function fxFilter(){if(!S||!S.fxC)return;if(S.fxC.style.filter)S.fxC.style.filter='';return;const c=motionLvl('fxContrast'),h=motionLvl('fxHue'),f=(Math.abs(c-1)>.005?`contrast(${c.toFixed(2)}) `:'')+(Math.abs(h)>=.5?`hue-rotate(${Math.round(h)}deg)`:'');if(S.fxC.style.filter!==f.trim())S.fxC.style.filter=f.trim();}
function applyFxs(){app.style.setProperty('--pulseDur',(2.4/motionLvl('pulseSpeed')).toFixed(2)+'s');$$('.fxs').forEach(l=>{const k=l.dataset.k,v=motionLvl(k),i=l.querySelector('input[type=range]'),nb=l.querySelector('.fxn');if(document.activeElement!==i)i.value=isSpd(k)?spdPos(k,v):v;if(nb&&document.activeElement!==nb)nb.value=fxNum(v);l.querySelector('em').textContent=fxsLabel(k,v);const wb=l.closest('.fxw');if(wb){const bb=wb.querySelector('.fxb b');if(bb)bb.textContent=fxsLabel(k,v);wb.classList.toggle('off',(k==='shimmer'||k==='sparkle')&&v<=0);}l.classList.toggle('off',(k==='shimmer'||k==='sparkle')&&v<=0);});
  fxFilter();if(S&&S.fxC){fxDraw(performance.now());fxStart();}}
function numBox(nb,mn,mx,set){const rd=()=>{const v=parseFloat(String(nb.value).replace(',','.'));return isFinite(v)?Math.max(mn,Math.min(mx,v)):null;};
  nb.addEventListener('input',()=>{const v=rd();if(v!=null)set(v);});nb.addEventListener('change',()=>{const v=rd();if(v!=null){set(v);nb.value=fxNum(v);}});
  nb.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){nb.dispatchEvent(new Event('change'));nb.blur();}});['pointerdown','click','keyup'].forEach(ev=>nb.addEventListener(ev,e=>e.stopPropagation()));}
function fxSliderRow(k){const f=FXS[k],l=document.createElement('label');l.className='fxs';l.dataset.k=k;l.title=f.tip;
  l.innerHTML=`<span>${f.lab}</span><input type="range" min="${isSpd(k)?0:f.min}" max="${isSpd(k)?1:f.max}" step="${isSpd(k)?.001:f.step}" value="${isSpd(k)?spdPos(k,motionLvl(k)):motionLvl(k)}" aria-label="${esc(f.tip)}"><input type="number" class="fxn" min="${f.min}" max="${f.max}" step="0.01" value="${fxNum(motionLvl(k))}" inputmode="decimal" aria-label="${esc(f.lab)} value"><em>${fxsLabel(k,motionLvl(k))}</em>`;
  const i=l.querySelector('input[type=range]'),nb=l.querySelector('.fxn');i.oninput=()=>setFxs(k,isSpd(k)?spdVal(k,+i.value):+i.value);   /* v13: typed values (e.g. 0.3), clamped to the slider's range, both stay in sync */
  numBox(nb,f.min,f.max,v=>setFxs(k,v));['pointerdown','click'].forEach(ev=>l.addEventListener(ev,e=>e.stopPropagation()));return l;}
/* v22: each effect setting is a compact button showing its value; tapping it opens a small slider popover (tap outside closes) */
function fxSlider(k){const f=FXS[k],w=document.createElement('span');w.className='fxw';w.dataset.k=k;
  w.innerHTML=`<button type="button" class="fxb" title="${esc(f.tip)}"><span>${f.lab}</span><b>${fxsLabel(k,motionLvl(k))}</b></button>`;
  const pop=document.createElement('div');pop.className='fxpop';pop.hidden=true;pop.appendChild(fxSliderRow(k));w.appendChild(pop);
  const btn=w.querySelector('.fxb');btn.onclick=e=>{e.stopPropagation();const open=pop.hidden;fxPopClose();if(!open)return;pop.hidden=false;btn.classList.add('on');
    const r=btn.getBoundingClientRect(),pw=pop.offsetWidth,ph=pop.offsetHeight,vw=innerWidth;let x=Math.max(6,Math.min(vw-pw-6,r.left+r.width/2-pw/2)),y=r.top-ph-8;if(y<6)y=r.bottom+8;
    pop.style.left=x+'px';pop.style.top=y+'px';const i=pop.querySelector('input[type=range]');i&&i.focus({preventScroll:true});};
  ['pointerdown','click'].forEach(ev=>pop.addEventListener(ev,e=>e.stopPropagation()));return w;}
function fxPopClose(){$$('.fxpop').forEach(p=>{if(!p.hidden){p.hidden=true;}});$$('.fxb.on').forEach(b=>b.classList.remove('on'));}
document.addEventListener('pointerdown',e=>{if(!e.target.closest||!e.target.closest('.fxw'))fxPopClose();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')fxPopClose();});
let fxNow=0,PCLK=0,pclkLast=0,CCLK=0,CFIX=false;const CLK={};let BFIX=false;   /* v13: one clock per Speed slider (glitter, neon, glow, lightning) */   /* v13: CCLK = the chrome shimmer clock (runs at the Speed slider's rate) */
const GEMS=new Set(['g-emerald','g-sapphire','g-amethyst','g-rose']);
const FXCAP={smoke:70,cloud:12,twinkle:70,total:230};
function fxKindsOf(k){ // ink -> list of live effects
  if(!k)return [];if(k.kind==='mix'){const m=k.mix||{},o=[];if(m.finish==='jewel')o.push('shimmer');
    if(m.anim==='pulse')o.push('pulsefx');if(m.anim==='glow')o.push('glowfx');if(m.anim==='shimmer')o.push('shimmer');if(m.anim==='lightning')o.push('boltfx');
    if(m.finish==='chrome')o.push('mirror');if(m.finish==='metal')o.push('shine');if(m.finish==='jewel')o.push('jshine');if(m.finish==='neon')o.push('neonfx');if(m.part==='glitter')o.push('twinkle');if(m.part==='smoke')o.push('smoke');if(m.part==='cloud')o.push('cloud');if(PTYPES.includes(m.part))o.push('pt'+m.part);return [...new Set(o)];}
  if(k.kind==='jewel')return ['shimmer','jshine'];if(k.fx==='shimmer'||GEMS.has(k.id))return ['shimmer'];if(k.kind==='metal')return ['shine'];
  if(k.kind==='chrome')return ['mirror'];if(k.kind==='pulse')return ['pulsefx'];if(k.kind==='neon')return ['neonfx'];if(k.kind==='lightning')return ['boltfx'];
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
/* v16: every stroke / fill gets its OWN effect record with its own seed, phase, speed, direction (from the stroke path) and light type,
   so two strokes of the same effect never move in sync. Capped per colour and in total; past the cap a new stroke joins the newest record. */
/* v22 motion: no light ever spins or rings in circles any more. Every moving light follows the direction the stroke was drawn in (or the
   long axis of a filled area), sweeps one way then back (or again at a jittered angle), and each cycle gets its own seeded speed, angle,
   rest gap and a wavy, noise-bent front, so big areas never move as one stamp and neighbours never sync. */
const LIGHTS=['sweep','star','double','chaser','sweep'];let lightN=(Math.random()*5)|0;
const LIGHTS21=['sweep','bloom','star','ripple','double','chaser','beam'],FINK=new Set(['shine','mirror','jshine','neonfx']);let lightN21=(Math.random()*7)|0;   // finishes keep their build-21 light set and look
function vnoise1(x,s){const i=Math.floor(x),f=x-i,a=hash2(i,s),b=hash2(i+1,s),u=f*f*(3-2*f);return a+(b-a)*u;}
function vnoise3(x,y,z,s){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const h=(i,j,k)=>hash2(i+k*7919,j*31337+s);const l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(h(X,Y,Z),h(X+1,Y,Z),u),l(h(X,Y+1,Z),h(X+1,Y+1,Z),u),v),l(l(h(X,Y,Z+1),h(X+1,Y,Z+1),u),l(h(X,Y+1,Z+1),h(X+1,Y+1,Z+1),u),v),w);}
function flowDir(r){if(r.pathDir)return r.dir;if(r.pdir!=null&&r.pdirN===r.pts.length)return r.pdir;const P=r.pts;let mx=0,my=0;for(const q of P){mx+=q[0];my+=q[1];}
  const n=Math.max(1,P.length);mx/=n;my/=n;let a=0,b=0,c=0;for(const q of P){const dx=q[0]-mx,dy=q[1]-my;a+=dx*dx;b+=dx*dy;c+=dy*dy;}
  let d=P.length>8?.5*Math.atan2(2*b,a-c):(r.dir||0);if((r.seed||0)%2)d+=Math.PI;r.pdirN=P.length;return r.pdir=d;}   // fills: the area's long axis (dominant direction)
const RUNS={};function runDir(c,sd){let R=RUNS[sd];if(!R)R=RUNS[sd]={s:[0],d:[hash2(sd,3)<.5?1:-1]};   // v22: sweep one way for 2-4 cycles (random), then switch
  while(R.s[R.s.length-1]<=c){const k=R.s.length;R.s.push(R.s[k-1]+2+((hash2(k,sd+43)*3)|0));R.d.push(-R.d[k-1]);}let lo=0,hi=R.s.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(R.s[m]<=c)lo=m;else hi=m;}return R.d[lo];}
function flowSweep(r,T,per0,slot,o){o=o||{};const sd=((r.seed||1)+slot*7717)|0,pp=per0*(.9+.2*hash2(sd,5)),tt=Math.max(0,T/pp+hash2(sd,9)*3),c=Math.floor(tt),u=tt-c,J=o.jit!=null?o.jit:.26+.26*hash2(sd,23);
  const act=o.act?o.act[0]+o.act[1]*hash2(c,sd+11):.62+.3*hash2(c,sd+11),ease=o.ease!=null?1+(hash2(c,sd+13)-.5)*o.ease:.75+.5*hash2(c,sd+13);if(u>act)return {p:-1,c,sd};let q=Math.pow(u/act,ease);q=q*q*(3-2*q);   /* ease in/out: each pass speeds up, then slows to a near-stop before the next (or the reverse) */
  if(runDir(c,sd)<0)q=1-q;const jit=(hash2(c,sd+19)-.5)*2*J;   // per-cycle angle jitter (+/- 15..30 deg by default)
  return {p:q*(o.span||1.5)-(o.lead||.25),ang:(o.base!=null?o.base:flowDir(r))+jit+(slot&&o.base==null?hash2(sd,29)*.5-.25:0),c,sd,straight:!!o.straight};}
function flowBand(g,x0,y0,w,h,fs,wd,a){if(!fs||fs.p<-.9)return;const L=Math.hypot(w,h),N=fs.straight?1:Math.max(5,Math.min(12,Math.round(L/50))),st=L/N,Wc='rgba(255,255,255,';
  g.save();g.translate(x0+w/2,y0+h/2);g.rotate(fs.ang);for(let k=0;k<N;k++){const yy=-L/2+k*st,off=fs.straight?0:(vnoise1(k*.38+fs.c*2.3,fs.sd+31)-.5)*.34+(vnoise1(k*1.3+fs.c*5.1,fs.sd+37)-.5)*.06,
    xc=(fs.p+off-.5)*L,hw=wd*L*(fs.straight?1:.75+.5*vnoise1(k*.5+fs.c,fs.sd+41)),gr=g.createLinearGradient(xc-hw,0,xc+hw,0);
    gr.addColorStop(0,Wc+'0)');gr.addColorStop(.5,Wc+a+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(xc-hw,yy-.5,2*hw,st+1);}g.restore();}
function fxParams(path){const seed=1+((Math.random()*999983)|0);let dir=Math.random()*6.2832;if(path&&path.length>1){const a=path[0],b=path[path.length-1];if(Math.hypot(b[0]-a[0],b[1]-a[1])>6)dir=Math.atan2(b[1]-a[1],b[0]-a[0]);}
  lightN=(lightN+1)%LIGHTS.length;return {seed,ph:Math.random()*20,dir,pathDir:!!(path&&path.length>1),light:LIGHTS[lightN],sp:.8+Math.random()*.45};}
function fxRec(kind,hex,path){fxSetList(S);const same=S.fx.filter(q=>q.kind===kind&&q.hex===hex),lim=(kind==='smoke'||kind==='cloud'||kind.startsWith('texfx')||kind.startsWith('pt'))?3:6;
  if(same.length&&(same.length>=lim||S.fx.length>=40))return same[same.length-1];
  const m=mk(),r=Object.assign({kind,hex,mask:m,mx:m.getContext('2d',{willReadFrequently:true}),bb:null,pts:[],parts:[],dirty:true},fxParams(path));if(FINK.has(kind)){lightN21=(lightN21+1)%7;r.light=LIGHTS21[lightN21];}S.fx.push(r);return r;}
const LIGHTK=new Set(['mirror','shine','jshine','shimmer','twinkle','glowfx','neonfx','pulsefx']);
function lightClock(r){return r.kind==='twinkle'?(CLK.twinkleSpeed||0):r.kind==='glowfx'?(CLK.glowSpeed||0):r.kind==='neonfx'?(CLK.neonSpeed||0):r.kind==='pulsefx'?PCLK:CCLK;}
const glS=a=>Math.pow(a||1,1.5),glB=a=>Math.min(1,.3+.7*(a||1));   /* v24 glitter Size: low = tiny dim dot flashes, high = big bright stars */
function drawLight(x,r){if(FINK.has(r.kind))return drawLightV21(x,r);if(!r.light||!r.bb||RM.matches)return;const lv=motionLvl({twinkle:'sparkle',glowfx:'glowStr',neonfx:'neonSpeed',pulsefx:'pulseSpeed'}[r.kind]||'shimmer');if(lv<=0)return;
  const [bx,by,bw,bh]=r.bb,X0=bx/MQ|0,Y0=by/MQ|0,w=Math.max(2,Math.min(WQ-X0,Math.ceil(bw/MQ)+2)),h=Math.max(2,Math.min(HQ-Y0,Math.ceil(bh/MQ)+2));
  const c=r.lc||(r.lc=document.createElement('canvas'));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const g=c.getContext('2d');g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
  const per=3.2+(r.seed%1000)/1000*2.6,tt=lightClock(r)*(r.sp||1)+(r.ph||0),cyc=Math.floor(tt/per),u=tt/per-cyc,D=r.dir||0,cs=Math.cos(D),sn=Math.sin(D),L=Math.hypot(w,h),cx=w/2,cy=h/2,Wc='rgba(255,255,255,';
  const pick=k=>{const p=r.pts.length?r.pts[Math.floor(hash2(cyc*7+k,r.seed)*r.pts.length)]:[bx+bw/2,by+bh/2];return [p[0]/MQ-X0,p[1]/MQ-Y0];};
  const band=(pos,wd,a)=>{const x0=cx+cs*(pos-.5)*L,y0=cy+sn*(pos-.5)*L,gr=g.createLinearGradient(x0-cs*wd*L,y0-sn*wd*L,x0+cs*wd*L,y0+sn*wd*L);gr.addColorStop(0,Wc+'0)');gr.addColorStop(.5,Wc+a+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(0,0,w,h);};
  const L2=({bloom:'sweep',ripple:'double',beam:'chaser'})[r.light]||r.light;   // v22: old circular types (saved pictures) map to directional ones
  if(L2==='sweep')flowBand(g,0,0,w,h,flowSweep(r,tt,per,0),.09,.9);
  else if(L2==='double'){flowBand(g,0,0,w,h,flowSweep(r,tt,per,0),.05,.85);flowBand(g,0,0,w,h,flowSweep(r,tt,per*1.37,1),.035,.6);}
  else if(L2==='star'){for(let k=0;k<3;k++){const pk=per*(.7+.6*hash2(k,r.seed)),tk=tt/pk+hash2(k,r.seed+3)*5,ck=Math.floor(tk),q=tk-ck,[px,py]=(()=>{const p=r.pts.length?r.pts[Math.floor(hash2(ck*7+k,r.seed)*r.pts.length)]:[bx+bw/2,by+bh/2];return [p[0]/MQ-X0,p[1]/MQ-Y0];})(),a=hash2(ck,r.seed+k)<.3?0:Math.pow(Math.sin(Math.PI*q),3),R=(4+L*.1)*a*(.6+.6*hash2(ck,k+9))*(r.kind==='twinkle'?Math.min(1.6,glS(r.amt)):1);if(a<.03)continue;g.strokeStyle=Wc+a.toFixed(3)+')';g.lineWidth=1.2;g.beginPath();
      g.moveTo(px-R,py);g.lineTo(px+R,py);g.moveTo(px,py-R);g.lineTo(px,py+R);g.moveTo(px-R*.35,py-R*.35);g.lineTo(px+R*.35,py+R*.35);g.moveTo(px+R*.35,py-R*.35);g.lineTo(px-R*.35,py+R*.35);g.stroke();
      const gr=g.createRadialGradient(px,py,0,px,py,Math.max(1,R*.5));gr.addColorStop(0,Wc+a.toFixed(3)+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(px-R,py-R,2*R,2*R);}}
  else if(L2==='chaser'){const fs=flowSweep(r,tt,per,0),A=fs.ang!=null?fs.ang:flowDir(r),c2=Math.cos(A),s2=Math.sin(A),uu=fs.p<-.9?-9:fs.p;g.fillStyle='#fff';for(let j=-L/2;j<L/2;j+=7){const sh=(vnoise1(j*.03+fs.c*1.9,r.seed)-.5)*.5;for(let i=-L/2;i<L/2;i+=4.5){const dd=(i/L+.5)-uu-sh,a=Math.max(0,1-Math.abs(dd)/.12)**3;if(a<.12)continue;
      const jx=(hash2((i*9)|0,(j*7+r.seed)|0)-.5)*2.4,jy=(hash2((j*5)|0,(i*3+r.seed)|0)-.5)*2.4,px=cx+c2*i-s2*j+jx,py=cy+s2*i+c2*j+jy;if(px<0||py<0||px>w||py>h)continue;g.globalAlpha=a;g.fillRect(px-.7,py-.7,1.4,1.4);}}g.globalAlpha=1;}
  g.globalCompositeOperation='destination-in';g.drawImage(r.mask,X0*MQ,Y0*MQ,w*MQ,h*MQ,0,0,w,h);
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,(.3+.5*Math.min(1,lv))*(r.kind==='twinkle'?.8*glB(r.amt):1));x.imageSmoothingEnabled=true;x.drawImage(c,X0*MQ,Y0*MQ,w*MQ,h*MQ);x.restore();}
function drawLightV21(x,r){if(!r.light||!r.bb||RM.matches)return;const lv=motionLvl({twinkle:'sparkle',glowfx:'glowStr',neonfx:'neonSpeed',pulsefx:'pulseSpeed'}[r.kind]||'shimmer');if(lv<=0)return;
  const [bx,by,bw,bh]=r.bb,X0=bx/MQ|0,Y0=by/MQ|0,w=Math.max(2,Math.min(WQ-X0,Math.ceil(bw/MQ)+2)),h=Math.max(2,Math.min(HQ-Y0,Math.ceil(bh/MQ)+2));
  const c=r.lc||(r.lc=document.createElement('canvas'));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const g=c.getContext('2d');g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
  const per=3.2+(r.seed%1000)/1000*2.6,tt=lightClock(r)*(r.sp||1)+(r.ph||0),cyc=Math.floor(tt/per),u=tt/per-cyc,D=r.dir||0,cs=Math.cos(D),sn=Math.sin(D),L=Math.hypot(w,h),cx=w/2,cy=h/2,Wc='rgba(255,255,255,';
  const pick=k=>{const p=r.pts.length?r.pts[Math.floor(hash2(cyc*7+k,r.seed)*r.pts.length)]:[bx+bw/2,by+bh/2];return [p[0]/MQ-X0,p[1]/MQ-Y0];};
  const band=(pos,wd,a)=>{const x0=cx+cs*(pos-.5)*L,y0=cy+sn*(pos-.5)*L,gr=g.createLinearGradient(x0-cs*wd*L,y0-sn*wd*L,x0+cs*wd*L,y0+sn*wd*L);gr.addColorStop(0,Wc+'0)');gr.addColorStop(.5,Wc+a+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(0,0,w,h);};
  const L2=r.light;
  if(L2==='sweep')band(u*1.4-.2,.09,.9);
  else if(L2==='double'){band(u*1.4-.2,.05,.85);band(u*1.4-.38,.035,.6);}
  else if(L2==='bloom'){const [px,py]=pick(0),R=Math.max(6,L*.45)*(.2+.8*u),a=Math.sin(Math.PI*u),gr=g.createRadialGradient(px,py,0,px,py,R);gr.addColorStop(0,Wc+(.95*a).toFixed(3)+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(0,0,w,h);}
  else if(L2==='ripple'){const [px,py]=pick(0);g.lineWidth=1.6;for(let k=0;k<3;k++){const q=u-k*.18;if(q<=0)continue;g.strokeStyle=Wc+(.9*(1-q)).toFixed(3)+')';g.beginPath();g.arc(px,py,q*L*.5,0,6.2832);g.stroke();}}
  else if(L2==='star'){for(let k=0;k<3;k++){const q=(u*1.5+k*.33)%1,[px,py]=pick(k),a=Math.pow(Math.sin(Math.PI*q),3),R=(4+L*.1)*a;if(a<.03)continue;g.strokeStyle=Wc+a.toFixed(3)+')';g.lineWidth=1.2;g.beginPath();
      g.moveTo(px-R,py);g.lineTo(px+R,py);g.moveTo(px,py-R);g.lineTo(px,py+R);g.moveTo(px-R*.35,py-R*.35);g.lineTo(px+R*.35,py+R*.35);g.moveTo(px+R*.35,py-R*.35);g.lineTo(px-R*.35,py+R*.35);g.stroke();
      const gr=g.createRadialGradient(px,py,0,px,py,Math.max(1,R*.5));gr.addColorStop(0,Wc+a.toFixed(3)+')');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(px-R,py-R,2*R,2*R);}}
  else if(L2==='chaser'){g.fillStyle='#fff';for(let j=-L/2;j<L/2;j+=7)for(let i=-L/2;i<L/2;i+=4.5){const a=Math.pow(Math.max(0,Math.sin(6.2832*((i/L)*2-u*2)+j*.05)),8);if(a<.12)continue;
      const jx=(hash2((i*9)|0,(j*7+r.seed)|0)-.5)*2.4,jy=(hash2((j*5)|0,(i*3+r.seed)|0)-.5)*2.4,px=cx+cs*i-sn*j+jx,py=cy+sn*i+cs*j+jy;if(px<0||py<0||px>w||py>h)continue;g.globalAlpha=a;g.fillRect(px-.7,py-.7,1.4,1.4);}g.globalAlpha=1;}
  else if(L2==='beam'){g.save();g.translate(cx,cy);g.rotate(tt*1.1*(r.seed%2?1:-1)+D);const gr=g.createLinearGradient(0,-L*.06,0,L*.06);gr.addColorStop(0,Wc+'0)');gr.addColorStop(.5,Wc+'.8)');gr.addColorStop(1,Wc+'0)');g.fillStyle=gr;g.fillRect(-L,-L*.06,2*L,L*.12);g.restore();}
  g.globalCompositeOperation='destination-in';g.drawImage(r.mask,X0*MQ,Y0*MQ,w*MQ,h*MQ,0,0,w,h);
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,(.3+.5*Math.min(1,lv))*(r.kind==='twinkle'?.8:1));x.imageSmoothingEnabled=true;x.drawImage(c,X0*MQ,Y0*MQ,w*MQ,h*MQ);x.restore();}
/* v24: new colour always sits ON TOP. Paint (2D or 3D, stroke or fill) hides the older effects under it by cutting its coverage out of their
   masks (and out of the Pulse layer when the new paint is not Pulse). The cut parts are kept in the undo entry, so undo brings them back exactly. */
function fxCoverOld(src,bx,by,bw,bh,a=1,keepPulse=false){if(!S||mode==='cbn'||a<=0)return false;bx=Math.max(0,bx|0);by=Math.max(0,by|0);bw=Math.min(W-bx,Math.ceil(bw));bh=Math.min(H-by,Math.ceil(bh));if(bw<=0||bh<=0)return false;
  const u={n:undoKey(),m:[]};let ov=false;
  for(const r of (S.fx||[])){if(r.dirty)fxScan(r);if(!r.bb)continue;const [rx,ry,rw,rh]=r.bb;if(rx>bx+bw||ry>by+bh||rx+rw<bx||ry+rh<by)continue;
    const c=document.createElement('canvas');c.width=bw;c.height=bh;c.getContext('2d').drawImage(r.mask,bx,by,bw,bh,0,0,bw,bh);u.m.push([r,c,undefined,bx,by]);if(r.kind!=='cover')ov=true;
    r.mx.save();r.mx.globalCompositeOperation='destination-out';r.mx.globalAlpha=a;r.mx.drawImage(src,bx,by,bw,bh,bx,by,bw,bh);r.mx.restore();r.dirty=true;}
  {const near=(S.fx||[]).some(r=>r.kind!=='cover'&&r.bb&&!(r.bb[0]>bx+bw+60||r.bb[1]>by+bh+60||r.bb[0]+r.bb[2]<bx-60||r.bb[1]+r.bb[3]<by-60));
    if(near){const last=S.fx[S.fx.length-1];let rc=last&&last.kind==='cover'?last:(S.fx.length>=40?[...S.fx].reverse().find(q=>q.kind==='cover'):null);
      if(!rc){const m=mk();rc={kind:'cover',hex:'#000000',mask:m,mx:m.getContext('2d',{willReadFrequently:true}),bb:null,pts:[],parts:[],dirty:true,seed:1,ph:0,dir:0,light:null,sp:1};S.fx.push(rc);}
      const c=document.createElement('canvas');c.width=bw;c.height=bh;c.getContext('2d').drawImage(rc.mask,bx,by,bw,bh,0,0,bw,bh);u.m.push([rc,c,undefined,bx,by]);
      rc.mx.save();rc.mx.globalAlpha=a;rc.mx.drawImage(src,bx,by,bw,bh,bx,by,bw,bh);rc.mx.restore();rc.dirty=true;}}
  if(u.m.length)S.fxUndo=(S.fxUndo||[]).concat([u]).slice(-300);
  if(!keepPulse&&S.pulse&&S.pulseUsed){const p=S.pulse.ctx;p.save();p.globalCompositeOperation='destination-out';p.globalAlpha=a;p.drawImage(src,bx,by,bw,bh,bx,by,bw,bh);p.restore();dirty('pulse');}
  if(u.m.length){dirty('fx');}return ov;}
function fxOverlap(bx,by,bw,bh){return (S.fx||[]).some(r=>{if(r.kind==='cover')return false;if(r.dirty)fxScan(r);const q=r.bb;return q&&!(q[0]>bx+bw||q[1]>by+bh||q[0]+q[2]<bx||q[1]+q[3]<by);});}
function solidStroke(sc,bx,by,bw,bh){bx=Math.max(0,bx|0);by=Math.max(0,by|0);bw=Math.min(W-bx,Math.ceil(bw));bh=Math.min(H-by,Math.ceil(bh));const c=mk();if(bw<=0||bh<=0)return sc;
  const im=sc.getContext('2d').getImageData(bx,by,bw,bh),d=im.data,o=new Uint8ClampedArray(d);
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){let m=0,mj=-1;for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=bh)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=bw)continue;const j=(yy*bw+xx)*4;if(d[j+3]>m){m=d[j+3];mj=j;}}}
    const i=(y*bw+x)*4;if(m>0){if(d[i+3]<m*.5){o[i]=d[mj];o[i+1]=d[mj+1];o[i+2]=d[mj+2];}o[i+3]=Math.min(255,m*3);}}
  im.data.set(o);c.getContext('2d').putImageData(im,bx,by);return c;}
/* v24: is there 3D work (Pop Pencil relief or Pop Fill) under this box? */
function under3DAt(bx,by,bw,bh){bx=Math.max(0,bx|0);by=Math.max(0,by|0);bw=Math.min(W-bx,Math.ceil(bw));bh=Math.min(H-by,Math.ceil(bh));if(bw<=0||bh<=0||!S)return false;
  if(S.pp&&S.pp.any){const d=S.pp.rx.getImageData(bx,by,bw,bh).data;for(let i=3;i<d.length;i+=16)if(d[i]>20)return true;}
  if(S.pops&&S.pops.length&&S.lab){for(let y=by;y<by+bh;y+=4)for(let x=bx;x<bx+bw;x+=4){const l=S.lab[y*W+x];if(l&&S.pops.some(p=>(p.rs||[p.r]).includes(l)))return true;}}return false;}
function fxAdd(kinds,hex,src,sx=0,sy=0,path=null){if(!kinds.length||!S)return;const u={n:undoKey(),m:[]};
  for(const k of kinds){const n0=(S.fx||[]).length,r=fxRec(k,hex,path),fresh=S.fx.length>n0,c=fresh?null:mk();r.amt=ink&&ink.kind==='mix'&&ink.mix&&ink.mix.amt?(ink.mix.amt[mixSlotOf(k)]||1):(r.amt||1);r.mixO=ink&&ink.kind==='mix'&&ink.mix?ink.mix[mixSlotOf(k)]:null;r.sf=null;if(c)c.getContext('2d').drawImage(r.mask,0,0);u.m.push(k==='mirror'?[r,c,phCopy(r)]:[r,c]);r.mx.drawImage(src,sx,sy);r.dirty=true;r.boost=performance.now()/1000;if(k==='mirror')chromePhase(r,src,sx,sy,path);}
  S.fxUndo=(S.fxUndo||[]).concat([u]).slice(-300);
  fxAttach();fxStart();dirty('fx');}
function fxScan(r){ // bbox + sample points of a mask (for particles and sheen extents)
  const d=r.mx.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;const pts=[];
  for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){if(d[(y*W+x)*4+3]>60){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;pts.push(x,y);}}
  r.bb=x1<0?null:[x0,y0,x1-x0+1,y1-y0+1];const n=pts.length/2,keep=[];let sd=((r.seed||1)*2654435761)>>>0;const rnd=()=>{sd=(sd+0x6D2B79F5)>>>0;let z=sd;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return((z^(z>>>14))>>>0)/4294967296;};/* v24: deterministic sampling, so an undone mask draws exactly as before */for(let i=0;i<Math.min(n,500);i++){const j=(rnd()*n)|0;keep.push([pts[j*2],pts[j*2+1]]);}
  r.pts=keep;r.dirty=false;r.sf=null;r.loose=null;r.tint=null;r.nm=null;r.cf=null;r.shade=null;r.td=null;r.dq=null;r.bolt=null;r.texC=null;r.mv=(r.mv||0)+1;if(!r.bb)r.parts=[];}
function fxLoose(r,blur,n=2){ // soft, spread mask so wisps / puffs can hover just around the colour
  const c=mk(),x=c.getContext('2d');x.filter=`blur(${blur}px)`;for(let i=0;i<n;i++)x.drawImage(r.mask,0,0);x.filter='none';return c;}
function fxShade(r){if(r.shade)return r.shade;const c=mk(),x=c.getContext('2d');x.drawImage(r.mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle='rgba(20,10,30,1)';x.fillRect(0,0,W,H);return r.shade=c;}
function fxTint(r){if(r.tint)return r.tint;const c=mk(),x=c.getContext('2d');x.drawImage(r.mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=r.hex;x.fillRect(0,0,W,H);return r.tint=c;}
function fxClip(){ // after erase / undo / clear: keep effects only where colour remains
  if(!S||!S.fx||!S.fx.length)return;const d=(mode==='cbn'?S.cbn.ctx:S.free.ctx).getImageData(0,0,W,H),pd=S.pulse&&mode!=='cbn'?S.pulse.ctx.getImageData(0,0,W,H).data:null,m=new ImageData(W,H);for(let i=3;i<d.data.length;i+=4)if(d.data[i]>8||(pd&&pd[i]>8))m.data[i]=255;
  const c=mk();c.getContext('2d').putImageData(m,0,0);
  for(const r of S.fx){r.mx.save();r.mx.globalCompositeOperation='destination-in';r.mx.drawImage(c,0,0);r.mx.restore();r.dirty=true;}
  S.fx.forEach(r=>{if(r.dirty)fxScan(r);});{const ref=new Set();for(const e of (S.fxUndo||[]))for(const q of e.m)ref.add(q[0]);S.fx=S.fx.filter(r=>r.bb||ref.has(r));}if(S.fxL)S.fxL[mode]=S.fx;dirty('fx');fxDraw(performance.now());}
/* v12 (as in v8): colour layers always sit under the 3D shading, so painting or filling a popped area changes its colour and keeps its height */
function under3D(c){const ref=[S&&S.popSh,S&&S.pp&&S.pp.sh].filter(e=>e&&e.parentNode===layers).sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)[0];if(ref){if(c.nextSibling!==ref||c.parentNode!==layers)layers.insertBefore(c,ref);}else if(!c.isConnected)layers.appendChild(c);}
function fxAttach(){if(!S)return;const c=fxLayer();under3D(c);c.style.display='';fxFilter();}
const scratch=mk(),scx=scratch.getContext('2d');
function star(x,cx,cy,R,a){x.globalAlpha=a;x.beginPath();for(let i=0;i<8;i++){const rr=i%2?R*.22:R,an=i*Math.PI/4;x.lineTo(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr);}x.closePath();x.fill();}
/* v23: no global reset anywhere. Each effect record is split into soft patches (1..8 by size); every patch loops on its own period
   (randomised +/-7..20%) from its own start phase, and each effect kind runs at a non-integer period ratio (golden-ratio based), so
   a page full of Glowing / Pulse / Neon strokes never breathes or resets in step. */
const KPER={glowfx:1,pulsefx:1.1459,neonfx:.8541,shimmer:1.0902};
function fxCells(r){if(r.cells&&r.cellsMv===r.mv)return r.cells;const [bx,by,bw,bh]=r.bb,K=Math.max(1,Math.min(8,Math.round(Math.sqrt(bw*bh)/150))),P=r.pts.length?r.pts:[[bx+bw/2,by+bh/2]],sd=r.seed||7,C=[];
  for(let k=0;k<K;k++){let best=P[0],bd=-1;for(let n=0;n<10;n++){const q=P[(hash2(k*11+n,sd)*P.length)|0];let m=1e12;for(const c of C)m=Math.min(m,(c.x-q[0])**2+(c.y-q[1])**2);if(m>bd){bd=m;best=q;}}
    const v=.05+.05*hash2(k,sd+5);C.push({x:best[0],y:best[1],sp:1+(hash2(k,sd+7)<.5?-v:v),ph:hash2(k,sd+9)*97});}
  const R=Math.sqrt(bw*bh/K)*1.25;C.forEach((c,k)=>c.R=R*(.85+.35*hash2(k,sd+13)));r.cellsMv=r.mv;return r.cells=C;}
let CELLC=null;
function cellPass(x,r,t,kp,op,fn){const C=fxCells(r),[bx,by,bw,bh]=r.bb,pad=50;
  if(C.length===1){const X0=Math.max(0,bx-pad),Y0=Math.max(0,by-pad);x.save();fn(x,t*C[0].sp*kp+C[0].ph,[X0,Y0,Math.min(W,bx+bw+pad)-X0,Math.min(H,by+bh+pad)-Y0]);x.restore();return;}
  const F=(CELLC||(CELLC=mk())).getContext('2d');
  for(const c of C){const e=c.R+pad,sx=Math.max(0,Math.floor(c.x-e)),sy=Math.max(0,Math.floor(c.y-e)),sw=Math.min(W,Math.ceil(c.x+e))-sx,sh=Math.min(H,Math.ceil(c.y+e))-sy;if(sw<=0||sh<=0)continue;
    F.save();F.globalCompositeOperation='source-over';F.globalAlpha=1;F.shadowBlur=0;F.clearRect(sx,sy,sw,sh);F.beginPath();F.rect(sx,sy,sw,sh);F.clip();fn(F,t*c.sp*kp+c.ph,[sx,sy,sw,sh]);F.restore();
    F.save();F.globalCompositeOperation='destination-in';const g=F.createRadialGradient(c.x,c.y,0,c.x,c.y,e);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.6,'rgba(0,0,0,.8)');g.addColorStop(1,'rgba(0,0,0,0)');F.fillStyle=g;F.fillRect(sx,sy,sw,sh);F.restore();
    x.save();x.globalCompositeOperation=op;x.drawImage(CELLC,sx,sy,sw,sh,sx,sy,sw,sh);x.restore();}}
const subDraw=(c,im,R)=>c.drawImage(im,R[0],R[1],R[2],R[3],R[0],R[1],R[2],R[3]);
/* v23 particles: Water, Fire/Embers, Sparks, Snow, Bubbles, Stars, Leaves. Each puff has its own life, size and phase and fades in
   and out (tapered), stays inside the colored area, and follows the Speed slider (partSpeed) and the Mix size slider (r.amt). */
const PTYPES=['water','fire','sparks','snow','bubbles','stars','leaves'];
const PTDEF={water:{life:[1,2],sz:[5,9],add:false,rate:1.2},fire:{life:[.9,1.8],sz:[5,10],add:true,rate:1.4},sparks:{life:[.35,.8],sz:[1.4,2.4],add:true,rate:2.2},
  snow:{life:[4,7],sz:[3,6.5],add:false,rate:.6},bubbles:{life:[2.5,4.5],sz:[5,12],add:false,rate:.55},stars:{life:[1.8,3.6],sz:[4,8],add:true,rate:.7},leaves:{life:[4,7],sz:[7,12],add:false,rate:.45}};
const PTS={};function ptSprite(ty,hex,v){const k=ty+hex+(v|0);if(PTS[k])return PTS[k];const c=document.createElement('canvas'),S2=64;c.width=c.height=S2;const x=c.getContext('2d'),rgb=hex2rgb(hex),C=(a,m=0)=>{const q=mix(rgb,WHITE,m);return `rgba(${q.map(v=>v|0)},${a})`;};
  x.translate(S2/2,S2/2);
  if(ty==='water'){const g=x.createLinearGradient(-10,-24,10,24);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.35,C(.85,.55));g.addColorStop(1,C(.9,.1));x.fillStyle=g;x.beginPath();x.moveTo(0,-26);x.bezierCurveTo(9,-8,14,6,0,22);x.bezierCurveTo(-14,6,-9,-8,0,-26);x.fill();x.fillStyle='rgba(255,255,255,.8)';x.beginPath();x.ellipse(-4,4,2.5,6,-.3,0,6.283);x.fill();}
  else if(ty==='fire'){const g=x.createRadialGradient(0,0,0,0,0,30);g.addColorStop(0,'rgba(255,250,215,1)');g.addColorStop(.25,`rgba(${mix([255,170,40],rgb,.25).map(v=>v|0)},.95)`);g.addColorStop(.6,`rgba(${mix([220,60,10],rgb,.2).map(v=>v|0)},.45)`);g.addColorStop(1,'rgba(120,20,0,0)');x.fillStyle=g;x.fillRect(-32,-32,64,64);}
  else if(ty==='snow'){const g=x.createRadialGradient(0,0,0,0,0,26);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(240,248,255,.75)');g.addColorStop(1,'rgba(230,240,255,0)');x.fillStyle=g;x.fillRect(-32,-32,64,64);
    x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=2.4;for(let i=0;i<3;i++){x.rotate(Math.PI/3);x.beginPath();x.moveTo(-24,0);x.lineTo(24,0);x.stroke();}}
  else if(ty==='bubbles'){x.fillStyle=C(.12,.5);x.beginPath();x.arc(0,0,26,0,6.283);x.fill();x.strokeStyle=C(.75,.45);x.lineWidth=2.5;x.stroke();x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=3.5;x.beginPath();x.arc(0,0,19,3.6,4.6);x.stroke();
    x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(9,-10,3.2,0,6.283);x.fill();}
  else if(ty==='stars'){const g=x.createRadialGradient(0,0,0,0,0,30);g.addColorStop(0,C(.55,.7));g.addColorStop(1,C(0,.7));x.fillStyle=g;x.fillRect(-32,-32,64,64);x.fillStyle=C(1,.6);x.beginPath();
    for(let i=0;i<10;i++){const rr=i%2?9:24,an=-Math.PI/2+i*Math.PI/5;x.lineTo(Math.cos(an)*rr,Math.sin(an)*rr);}x.closePath();x.fill();x.fillStyle='rgba(255,255,255,.9)';x.beginPath();x.arc(0,0,4,0,6.283);x.fill();}
  else if(ty==='leaves'){const hs=[0,18,-14,32][v%4],q=hex2rgb(hsl2hex(...(()=>{const [h,s2,l]=rgb2hsl(rgb);return [(h+hs+360)%360,Math.min(1,s2*1.05),l];})()));const L=(a,m)=>`rgba(${mix(q,m>0?WHITE:[0,0,0],Math.abs(m)).map(v=>v|0)},${a})`;
    const g=x.createLinearGradient(-26,0,26,0);g.addColorStop(0,L(1,-.25));g.addColorStop(.5,L(1,.12));g.addColorStop(1,L(1,-.15));x.fillStyle=g;x.beginPath();x.moveTo(-26,0);x.quadraticCurveTo(-4,-17,26,0);x.quadraticCurveTo(-4,17,-26,0);x.fill();
    x.strokeStyle=L(.8,-.45);x.lineWidth=1.6;x.beginPath();x.moveTo(-28,0);x.lineTo(22,0);for(let i=-1;i<=1;i+=2)for(let k=-14;k<=10;k+=8){x.moveTo(k,0);x.lineTo(k+7,i*8);}x.stroke();}
  return PTS[k]=c;}
function drawParts(x,r,t){const ty=r.kind.slice(2),D=PTDEF[ty];if(!D||!r.bb)return;if(!RM.matches)t=CLK.partSpeed||0;const [bx,by,bw,bh]=r.bb,dt=RM.matches?0:Math.min(.08,Math.max(0,t-(r.lt??t)));r.lt=t;
  const am=Math.max(.3,Math.min(2.5,r.amt||1)),area=Math.sqrt(bw*bh),cap=Math.round(Math.min(90,10+area/9)*Math.min(1.8,.6+.4*am)),fd=flowDir(r);
  r.acc=(r.acc||0)+dt*cap/((D.life[0]+D.life[1])/2)*D.rate*.6;if(!r.parts.length&&r.pts.length)r.acc+=Math.min(cap,Math.round(cap*.5));
  const R=()=>Math.random();while(r.acc>=1&&r.pts.length){r.acc-=1;if(r.parts.length>=cap){r.acc=0;break;}const q=r.pts[(R()*r.pts.length)|0],life=D.life[0]+R()*(D.life[1]-D.life[0]),sz=(D.sz[0]+R()*(D.sz[1]-D.sz[0]))*am;
    let vx=0,vy=0;if(ty==='water'){vx=Math.cos(fd)*8+(R()-.5)*6;vy=35+R()*45;}else if(ty==='fire'){vx=(R()-.5)*14;vy=-(28+R()*40);}else if(ty==='sparks'){const a=R()*6.283,v=60+R()*120;vx=Math.cos(a)*v;vy=Math.sin(a)*v-40;}
    else if(ty==='snow'){vx=Math.cos(fd)*5;vy=12+R()*14;}else if(ty==='bubbles'){vx=(R()-.5)*6;vy=-(14+R()*20);}else if(ty==='stars'){const a=fd+(R()-.5)*1.2;vx=Math.cos(a)*6;vy=Math.sin(a)*6;}else if(ty==='leaves'){vx=Math.cos(fd)*10+(R()-.5)*10;vy=14+R()*16;}
    r.parts.push({x:q[0],y:q[1],vx,vy,age:RM.matches?life*.5:0,life,sz,ph:R()*6.283,rot:R()*6.283,vr:(R()-.5)*3,v:(R()*4)|0});}
  if(!r.loose)r.loose=fxLoose(r,ty==='fire'||ty==='sparks'?18:10,4);const ex=60,X0=Math.max(0,bx-ex),Y0=Math.max(0,by-ex),X1=Math.min(W,bx+bw+ex),Y1=Math.min(H,by+bh+ex);
  scx.clearRect(X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation=D.add?'lighter':'source-over';
  for(let k=r.parts.length-1;k>=0;k--){const p=r.parts[k];p.age+=dt;if(p.age>=p.life){r.parts.splice(k,1);continue;}const u=p.age/p.life,env=Math.sin(Math.PI*Math.min(1,u))**.8;   // tapered: fades in, peaks, fades out
    if(ty==='sparks')p.vy+=90*dt;if(ty==='water')p.vy+=40*dt;if(ty==='fire'){p.vx+=Math.sin(t*3+p.ph)*20*dt;}if(ty==='snow'||ty==='leaves'||ty==='bubbles')p.vx+=Math.cos(t*(ty==='bubbles'?2.2:1.1)+p.ph)*(ty==='leaves'?22:10)*dt;
    p.vx*=1-.25*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt*(ty==='leaves'?1:.3);
    if(ty==='sparks'){const L2=Math.min(14,Math.hypot(p.vx,p.vy)*.06)*Math.max(.6,am);scx.globalAlpha=env;scx.strokeStyle=`rgba(${mix(hex2rgb(r.hex),WHITE,.65).map(v=>v|0)},1)`;scx.lineWidth=p.sz;scx.lineCap='round';
      scx.beginPath();scx.moveTo(p.x,p.y);scx.lineTo(p.x-p.vx/Math.hypot(p.vx,p.vy||1)*L2,p.y-p.vy/Math.hypot(p.vx,p.vy||1)*L2);scx.stroke();continue;}
    const spr=ptSprite(ty,r.hex,ty==='leaves'?p.v:0),z=p.sz*(ty==='fire'?(1.2-.5*u):ty==='stars'?(.6+.6*env):1),a=env*(ty==='fire'?.95:ty==='stars'?.5+.5*Math.sin(t*3+p.ph)**2:.9);
    scx.globalAlpha=Math.max(0,a);scx.setTransform(1,0,0,1,p.x,p.y);if(ty==='leaves'){scx.rotate(p.rot);scx.scale(1,.55+.45*Math.cos(t*1.7+p.ph));}else if(ty==='stars')scx.rotate(p.rot);
    scx.drawImage(spr,-z,-z*(ty==='water'?1.6:1),z*2,z*2*(ty==='water'?1.6:1));scx.setTransform(1,0,0,1,0,0);}
  scx.globalAlpha=1;scx.globalCompositeOperation='destination-in';scx.drawImage(r.loose,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';
  x.save();if(D.add)x.globalCompositeOperation='lighter';x.drawImage(scratch,X0,Y0,X1-X0,Y1-Y0,X0,Y0,X1-X0,Y1-Y0);x.restore();}
function fxDrawRec(x,r,t){ // t in seconds
  if(r.kind==='pulsefx'&&!RM.matches)t=PCLK;if(r.kind==='glowfx'||r.kind==='neonfx')t=RM.matches?1.2:(CLK[r.kind==='glowfx'?'glowSpeed':'neonSpeed']||0);if(r.kind==='shimmer'){const lv=motionLvl('shimmer');t=lv>0?CCLK:1.2;}
  if(r.ph!=null&&r.kind!=='twinkle'&&r.kind!=='boltfx'&&!RM.matches)t=t*(r.sp||1)+r.ph;   /* v16: own phase + speed per stroke */
  if(r.dirty)fxScan(r);if(!r.bb)return;const [bx,by,bw,bh]=r.bb,s=.5+.5*Math.sin(t*2*Math.PI/3.2);
  if(r.kind==='shimmer'){ // sheen band sweeping diagonally + soft glow pulse + a few glints
    {const T=fxTint(r);cellPass(x,r,t,KPER.shimmer,'source-over',(c,tl,R)=>{const s=.5+.5*Math.sin(tl*2*Math.PI/3.2);c.save();c.globalAlpha=.16+.16*s;c.shadowColor=r.hex;c.shadowBlur=16+10*s;subDraw(c,T,R);c.restore();});}
    scx.clearRect(bx-2,by-2,bw+4,bh+4);scx.globalCompositeOperation='source-over';flowBand(scx,bx,by,bw,bh,flowSweep(r,t*(r.sp||1)+(r.ph||0),3.4,2),.12,.62);
    scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
    x.save();x.globalCompositeOperation='lighter';x.globalAlpha=motionLvl('shimmer')>0?.35+.6*motionLvl('shimmer'):0;x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();
    x.save();x.fillStyle='#fff';for(let i=0;i<Math.min(6,r.pts.length);i++){const q=r.pts[(i*37+(r.seed||0))%r.pts.length],a=Math.max(0,Math.sin(t*(1.2+hash2(i,r.seed||1))+i*2.1+(r.ph||0)));if(a>.05)star(x,q[0],q[1],3+5*a,.85*a);}x.restore();return;}
  if(r.kind==='mirror'){drawMirror(x,r,t);return;}if(r.kind==='shine'){drawShine(x,r,t,'metal');return;}if(r.kind==='jshine'){drawShine(x,r,t,'jewel');return;}
  if(r.kind==='rampfx'){ // colour shift: the gradient flows through the stroke (ping-pong), ~12 fps is plenty for this slow drift
    if(!r.td){r.td=r.mx.getImageData(bx,by,bw,bh).data;r.out=new ImageData(bw,bh);r.oc=Object.assign(document.createElement('canvas'),{width:bw,height:bh});r.ft=-1;}
    if(r.ft<0||Math.abs(t-r.ft)>=.08){r.ft=t;const L=rampLUT(r.hex),wv=WAVES[RAMP_WAVE[r.hex]||'sine'],ph=RM.matches?0:(RAMP_WAVE[r.hex]==='sawtooth'?t/9:.5+.5*wv(t,.35)),td=r.td,o=r.out.data;
      for(let i=0;i<td.length;i+=4){const a=td[i+3];if(!a){o[i+3]=0;continue;}const v=td[i]/255+ph,q=v-Math.floor(v),k=Math.round((q<.5?q*2:2-q*2)*255)*3;o[i]=L[k];o[i+1]=L[k+1];o[i+2]=L[k+2];o[i+3]=a;}
      r.oc.getContext('2d').putImageData(r.out,0,0);}
    x.drawImage(r.oc,bx,by);return;}
  if(r.kind==='glowfx'){const gs=motionLvl('glowStr'),T=fxTint(r);cellPass(x,r,t,KPER.glowfx,'lighter',(c,tl,R)=>{const s=.5+.5*Math.sin(tl*2*Math.PI/3.2);c.save();c.globalCompositeOperation='lighter';
    c.globalAlpha=Math.min(1,(.10+.22*s)*gs);c.shadowColor=r.hex;c.shadowBlur=(22+18*s)*Math.sqrt(gs);if(gs>1.2)subDraw(c,T,R);subDraw(c,T,R);c.restore();});return;}
  if(r.kind==='pulsefx'||r.kind==='glowfx')drawPulseBands(x,r,t,r.kind==='pulsefx'?{sp:.55,n:2,dir:'forward',a:.85}:{sp:.3,n:1,dir:'bounce',a:.5});
  if(r.kind==='pulsefx'){ // the colour itself breathes: dims on the out-breath, brightens + glows on the in-breath
    const Sh=fxShade(r),T=fxTint(r);cellPass(x,r,t,KPER.pulsefx,'source-over',(c,tl,R)=>{const b=.5+.5*Math.sin(tl*2*Math.PI/2.4);if(b<.5){c.globalAlpha=(.5-b)*.7;subDraw(c,Sh,R);}});
    cellPass(x,r,t,KPER.pulsefx,'lighter',(c,tl,R)=>{const b=.5+.5*Math.sin(tl*2*Math.PI/2.4);c.globalCompositeOperation='lighter';c.globalAlpha=.06+.5*b*b;c.shadowColor=r.hex;c.shadowBlur=4+16*b;subDraw(c,T,R);});return;}
  if(r.kind==='boltfx'){drawBolt(x,r);return;}
  if(r.kind.startsWith('texfx')){if(!r.texC){const [,k,v]=r.kind.split('|'),c=mk(),cx=c.getContext('2d');cx.fillStyle=cx.createPattern(texShadeTile(k,v),'repeat');cx.fillRect(0,0,W,H);cx.globalCompositeOperation='destination-in';cx.drawImage(r.mask,0,0);r.texC=c;}x.drawImage(r.texC,0,0);return;}   /* v14: texture on a Color by Number colour */
  if(r.kind==='neonfx'){ // neon hum: a steady glow with a soft flicker now and then
    const T=fxTint(r);cellPass(x,r,t,KPER.neonfx,'lighter',(c,tl,R)=>{const f=hash2((tl*14)|0,7+(r.seed||0))<.06?.35:1,b=(.75+.25*Math.sin(tl*5.3))*f;c.globalCompositeOperation='lighter';c.globalAlpha=.14+.3*b;c.shadowColor=r.hex;c.shadowBlur=10+14*b;subDraw(c,T,R);});return;}
  if(r.kind==='twinkle'){ // glitter: a field of sparkle points that pop on and off all over the glitter, plus drifting 4-point glints
    const lv=motionLvl('sparkle'),still=lv<=0,sd=r.seed||0;t=still?1.2:(CLK.twinkleSpeed||0)*(r.sp||1)+(r.ph||0);
    if(!r.sf){const n=Math.min(r.pts.length,Math.max(24,Math.round(bw*bh/650*Math.min(2,r.amt||1))));r.sf=[];for(let i=0;i<n;i++){const q=r.pts[(i*97+sd)%r.pts.length];r.sf.push([q[0]+(hash2(i+sd,3)-.5)*3,q[1]+(hash2(i+sd,5)-.5)*3,hash2(i+sd,7)*6.283,.7+hash2(i+sd,11)*2.2,hash2(i+sd,13)<.22]);}}
    x.save();x.globalCompositeOperation='lighter';const tg=tinted(mix(hex2rgb(r.hex),WHITE,.35).map(v=>Math.round(v)).reduce((a,v)=>a+v.toString(16).padStart(2,'0'),'#'),1);
    for(const [px,py,ph,sp,hot] of r.sf){let a;if(still)a=hash2(px|0,py|0)>.78?.55:0;else{const w=Math.sin(t*sp*(1.2+lv*1.6)+ph);a=Math.pow(Math.max(0,w),hot?8:14);}
      if(a<.04)continue;const R2=(hot?5.5:2.6)*(.5+.5*a)*glS(r.amt);x.globalAlpha=Math.min(1,a*(still?1:.55+.6*lv)*glB(r.amt));x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);if(hot){x.globalAlpha*=.5;x.drawImage(tg,px-R2*1.6,py-R2*1.6,R2*3.2,R2*3.2);}}
    x.restore();if(still)return;
    const boost=Math.max(0,1-(fxNow-(r.boost||0))/1.4);   // sparkle boost: a burst of glints right after new glitter goes down
    const cap=Math.min(FXCAP.twinkle*(1+boost),Math.max(6,Math.round(bw*bh/2600*(.4+lv)))*(1+1.5*boost),r.pts.length*2),dt=Math.min(.1,Math.max(0,t-(r.lt||t)));r.lt=t;
    const born=()=>{const q=r.pts[(Math.random()*r.pts.length)|0],hot=Math.random()<.18+.4*boost;return {x:q[0]+(Math.random()-.5)*3,y:q[1]+(Math.random()-.5)*3,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4-1,
      age:-Math.random()*1.6,life:.35+Math.random()*.75,sz:hot?5+Math.random()*4:1.6+Math.random()*2.4,pk:hot?1:.45+Math.random()*.4,rot:Math.random()*.6};};
    while(r.parts.length<cap&&r.pts.length)r.parts.push(born());
    x.save();x.globalCompositeOperation='lighter';
    for(let i=0;i<r.parts.length;i++){const p=r.parts[i];p.age+=dt;if(p.age>p.life){r.parts[i]=born();continue;}if(p.age<0)continue;
      const u=p.age/p.life,a=(u<.18?u/.18:Math.pow(1-(u-.18)/.82,2))*p.pk;p.x+=p.vx*dt;p.y+=p.vy*dt;
      const R2=p.sz*(.55+.45*a);x.globalAlpha=a;x.drawImage(GLINT,p.x-R2*2,p.y-R2*2,R2*4,R2*4);}
    x.restore();return;}
  if(r.kind==='smoke'){drawSmoke(x,r,t);return;}if(r.kind==='cloud'){drawCloud(x,r,t);return;}if(r.kind.startsWith('pt')){drawParts(x,r,t);return;}
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
  const mq=new ImageData(w,h);for(let i=0;i<w*h;i++)if(m[i])mq.data[i*4+3]=255;
  return r.ss={key,F,base:cv(q,0),glint:cv(g,0),bloom:cv(bq,4),mq:cv(mq,0),pts:pts.slice(0,40),X0,Y0,w,h};}
/* v13: per-stroke shimmer direction for chrome. r.phC (quarter res) stores, for every pixel a chrome stroke covered, how far along
   that stroke's drawn path it lies (R = 0..255 from start to end, alpha = covered). Later paint replaces earlier; fills clear it (default diagonal). */
function phCanvas(r){if(!r.phC){const c=document.createElement('canvas');c.width=WQ;c.height=HQ;r.phC=c;r.phX=c.getContext('2d',{willReadFrequently:true});}return r.phC;}
function phCopy(r){if(!r.phC)return null;const c=document.createElement('canvas');c.width=WQ;c.height=HQ;c.getContext('2d').drawImage(r.phC,0,0);return c;}
function phRestore(r,pc){phCanvas(r);r.phX.clearRect(0,0,WQ,HQ);if(pc)r.phX.drawImage(pc,0,0);r.phV=(r.phV||0)+1;}
function chromePhase(r,src,sx,sy,path){phCanvas(r);r.phV=(r.phV||0)+1;
  const t=document.createElement('canvas');t.width=WQ;t.height=HQ;const tx=t.getContext('2d',{willReadFrequently:true});tx.drawImage(src,sx/MQ,sy/MQ,src.width/MQ,src.height/MQ);
  r.phX.save();r.phX.globalCompositeOperation='destination-out';r.phX.drawImage(t,0,0);r.phX.restore();
  if(!path||path.length<2)return;const cum=[0];let Ls=0;for(let i=1;i<path.length;i++){Ls+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);cum.push(Ls);}if(Ls<16)return;
  let x0=W,y0=H,x1=0,y1=0;for(const [a,b] of path){x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,a);y1=Math.max(y1,b);}
  const M=90,X0=Math.max(0,((x0-M)/MQ)|0),Y0=Math.max(0,((y0-M)/MQ)|0),X1=Math.min(WQ-1,((x1+M)/MQ)|0),Y1=Math.min(HQ-1,((y1+M)/MQ)|0),w=X1-X0+1,h=Y1-Y0+1;if(w<1||h<1)return;
  const d=tx.getImageData(X0,Y0,w,h).data,o=new ImageData(w,h),O=o.data,P=path.map(([a,b])=>[a/MQ,b/MQ]),C=cum.map(v=>v/Ls);
  for(let y=0;y<h;y++)for(let X=0;X<w;X++){const j=(y*w+X)*4;if(d[j+3]<60)continue;const px=X+X0+.5,py=y+Y0+.5;let bd=1e18,bs=0;
    for(let i=1;i<P.length;i++){const ax=P[i-1][0],ay=P[i-1][1],vx=P[i][0]-ax,vy=P[i][1]-ay,ll=vx*vx+vy*vy,q=ll?Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/ll)):0,ex=ax+vx*q-px,ey=ay+vy*q-py,dd=ex*ex+ey*ey;
      if(dd<bd){bd=dd;bs=C[i-1]+(C[i]-C[i-1])*q;}}
    O[j]=Math.round(bs*255);O[j+3]=255;}
  const oc=document.createElement('canvas');oc.width=w;oc.height=h;oc.getContext('2d').putImageData(o,0,0);r.phX.drawImage(oc,X0,Y0);}
function phaseList(r,ss){if(!r.phC)return null;const key=r.phV+'|'+ss.X0+','+ss.Y0+','+ss.w+','+ss.h;if(r.phL&&r.phL.key===key)return r.phL.v;
  const {X0,Y0,w,h}=ss,d=r.phX.getImageData(X0,Y0,w,h).data,idx=[],ph=[];for(let i=0;i<w*h;i++)if(d[i*4+3]>=128){idx.push(i);ph.push(d[i*4]/255);}
  let v=null;if(idx.length){const m=document.createElement('canvas');m.width=w;m.height=h;const mx=m.getContext('2d'),mi=mx.createImageData(w,h);for(const i of idx)mi.data[i*4+3]=255;mx.putImageData(mi,0,0);
    const c=document.createElement('canvas');c.width=w;c.height=h;v={idx:Int32Array.from(idx),ph:Float32Array.from(ph),mask:m,im:new ImageData(w,h),c,cx:c.getContext('2d')};}
  r.phL={key,v};return v;}
/* v13 Lightning: a calm neon glow, then irregular lightning flashes where the CENTRE of the stroke burns white-hot with the colour glowing
   around it and fading outward. Everything stays inside the line-enclosed areas the lightning was painted in. */
function boltI(t){let v=0;const P=.9,k=Math.floor(t/P);for(let j=k-2;j<=k;j++){if(hash2(j,17)<.42)continue;const t0=j*P+hash2(j,29)*.55,n=1+((hash2(j,41)*3)|0);
    for(let i=0;i<n;i++){const ts=t0+i*(.06+hash2(j,53+i)*.09),d=t-ts;if(d>=0&&d<.5)v=Math.max(v,(i===n-1?1:.55+.3*hash2(j,61+i))*Math.exp(-d*(i===n-1?9:18)));}}return v;}
function boltPrep(r){if(r.bolt)return r.bolt;const [bx,by,bw,bh]=r.bb,pad=24,X0=Math.max(0,bx-pad),Y0=Math.max(0,by-pad),X1=Math.min(W,bx+bw+pad),Y1=Math.min(H,by+bh+pad),w=X1-X0,h=Y1-Y0;
  const md=r.mx.getImageData(bx,by,bw,bh).data,mark=new Uint8Array(S.N);for(let y=0;y<bh;y++)for(let X=0;X<bw;X++)if(md[(y*bw+X)*4+3]>60)mark[S.lab[(y+by)*W+X+bx]]=1;mark[0]=0;
  const rm=regionMask(S,mark),cv=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const bl=cv(),bx2=bl.getContext('2d',{willReadFrequently:true});bx2.filter='blur(2.5px)';bx2.drawImage(r.mask,X0,Y0,w,h,0,0,w,h);bx2.filter='none';
  const bd=bx2.getImageData(0,0,w,h),D=bd.data,mm=r.mx.getImageData(X0,Y0,w,h).data;for(let i=0;i<D.length;i+=4){const a=mm[i+3]>60?Math.max(0,Math.min(1,(D[i+3]-150)/85)):0;D[i]=D[i+1]=D[i+2]=255;D[i+3]=a*255;}
  const core=cv();core.getContext('2d').putImageData(bd,0,0);
  const inner=cv(),ix=inner.getContext('2d');ix.filter='blur(2px)';ix.drawImage(fxTint(r),X0,Y0,w,h,0,0,w,h);ix.filter='none';ix.globalCompositeOperation='destination-in';ix.drawImage(r.mask,X0,Y0,w,h,0,0,w,h);
  const halo=cv(),hx=halo.getContext('2d');hx.filter='blur(9px)';hx.drawImage(fxTint(r),X0,Y0,w,h,0,0,w,h);hx.drawImage(fxTint(r),X0,Y0,w,h,0,0,w,h);hx.filter='none';hx.globalCompositeOperation='destination-in';hx.drawImage(rm,X0,Y0,w,h,0,0,w,h);
  let hs=0;for(const c of r.hex)hs=(hs*31+c.charCodeAt(0))%997;  const K=Math.max(1,Math.min(7,Math.round(Math.sqrt(w*h)/170))),cells=[],P=r.pts.length?r.pts:[[X0+w/2,Y0+h/2]];   // v22: big areas flash in staggered, uneven patches
  for(let k=0;k<K;k++){let best=null,bd2=-1;for(let n=0;n<12;n++){const q=P[(hash2(k*13+n,r.seed||hs)*P.length)|0];let m=1e12;for(const c of cells)m=Math.min(m,(c.x-q[0])**2+(c.y-q[1])**2);if(m>bd2){bd2=m;best=q;}}
    cells.push({x:best[0]-X0,y:best[1]-Y0,off:hash2(k,(r.seed||hs)+71)*37,sp:1+(hash2(k,(r.seed||hs)+74)<.5?-1:1)*(.05+.05*hash2(k,(r.seed||hs)+73))});}
  const R=K===1?Math.hypot(w,h):Math.sqrt(w*h/K)*1.15;for(const c of cells)c.R=R*(.85+.4*hash2(c.off*100|0,5));
  const fl=cv();return r.bolt={X0,Y0,w,h,core,inner,halo,cells,fl,off:r.seed?(r.seed%9973)*.0137:hs*.137};}
function drawBolt(x,r){const B=boltPrep(r),still=RM.matches,t=still?0:(CLK.boltSpeed||0)+B.off,str=motionLvl('boltStr'),hum=.8+.2*Math.sin(t*5.1);
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=.26*hum;x.drawImage(B.halo,B.X0,B.Y0);x.globalAlpha=.18;x.drawImage(B.inner,B.X0,B.Y0);x.restore();
  let Im=0;if(!still){const one=B.cells.length===1,F=B.fl.getContext('2d');for(const c of B.cells){const I=Math.min(1.6,boltI(t*c.sp+c.off)*str);if(I<.03)continue;Im=Math.max(Im,I);
    if(one){x.save();x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,.6*Math.min(1,I));x.drawImage(B.halo,B.X0,B.Y0);if(I>1){x.globalAlpha=I-1;x.drawImage(B.halo,B.X0,B.Y0);}
      x.globalAlpha=Math.min(1,.7*Math.min(1,I));x.drawImage(B.inner,B.X0,B.Y0);x.restore();x.save();x.globalAlpha=Math.min(1,I*1.15);x.drawImage(B.core,B.X0,B.Y0);
      if(I>.6){x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,(I-.6)*.8);x.drawImage(B.core,B.X0,B.Y0);}x.restore();continue;}
    // a soft patch around this cell's centre flashes on its own clock (uneven radius, so patches never read as a grid)
    const sx=Math.max(0,Math.floor(c.x-c.R)),sy=Math.max(0,Math.floor(c.y-c.R)),sw=Math.min(B.w,Math.ceil(c.x+c.R))-sx,sh=Math.min(B.h,Math.ceil(c.y+c.R))-sy;if(sw<=0||sh<=0)continue;   // only the patch's own square is touched
    if(!B.flash){const c2=document.createElement('canvas');c2.width=B.w;c2.height=B.h;const q=c2.getContext('2d');q.globalAlpha=.6;q.drawImage(B.halo,0,0);q.globalAlpha=.7;q.drawImage(B.inner,0,0);q.globalAlpha=1;q.drawImage(B.core,0,0);q.globalCompositeOperation='lighter';q.globalAlpha=.32;q.drawImage(B.core,0,0);B.flash=c2;}   // one pre-composed flash image per record
    F.globalCompositeOperation='copy';F.globalAlpha=1;F.drawImage(B.flash,sx,sy,sw,sh,sx,sy,sw,sh);
    F.globalCompositeOperation='destination-in';const g=F.createRadialGradient(c.x,c.y,0,c.x,c.y,c.R);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');F.fillStyle=g;F.fillRect(sx,sy,sw,sh);
    x.save();x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,I);x.drawImage(B.fl,sx,sy,sw,sh,B.X0+sx,B.Y0+sy,sw,sh);if(I>1){x.globalAlpha=I-1;x.drawImage(B.fl,sx,sy,sw,sh,B.X0+sx,B.Y0+sy,sw,sh);}x.restore();}}
  r.lastI=Im;}
function drawShine(x,r,t,style){if(!r.bb)return;const lvl=motionLvl('shimmer'),still=lvl<=0,live=!still&&performance.now()-LIGHT.t<2500,plx=live?LIGHT.x:0,ply=live?LIGHT.y:0,lq=[Math.round(plx*4)/20,Math.round(ply*4)/20];   // pointer / tilt: a small, quantised nudge
  const now=performance.now();let ss=r.ss;if(!ss||!r.ssT||now-r.ssT>180||contourField(r)!==ss.F){ss=shineStatic(r,style,lq);r.ssT=now;}
  const {X0,Y0,w,h}=ss;if(w<=2||h<=2)return;const bx=X0*MQ,by=Y0*MQ,bw=w*MQ,bh=h*MQ,T=still?1.3:CCLK*(r.sp||1)+(r.ph||0),PL=style==='chrome'&&!still?phaseList(r,ss):null,add=style==='jewel';
  // 1) polished surface
  scx.clearRect(bx,by,bw,bh);scx.globalCompositeOperation='source-over';scx.imageSmoothingEnabled=true;scx.drawImage(ss.base,bx,by,bw,bh);
  // 1b) live shimmer (v11): a slow colour shift washing over the surface and two soft bands of light that keep flowing
  if(!still&&style==='chrome'){const fl=r.fl||(r.fl=document.createElement('canvas'));if(fl.width!==w||fl.height!==h){fl.width=w;fl.height=h;}const fx2=fl.getContext('2d'),k=style==='metal'?.6:1;
    fx2.globalCompositeOperation='source-over';fx2.clearRect(0,0,w,h);const hs=(T*24)%360,g1=fx2.createLinearGradient(0,0,w,h);
    for(let q=0;q<=4;q++)g1.addColorStop(q/4,`hsl(${(hs+q*80)%360},75%,60%)`);fx2.fillStyle=g1;fx2.fillRect(0,0,w,h);
    scx.globalCompositeOperation='soft-light';scx.globalAlpha=Math.min(1,.5*lvl*k);scx.drawImage(fl,bx,by,bw,bh);
    fx2.clearRect(0,0,w,h);const L2=w+h;for(const [per,off,wd] of [[6.5,0,.16],[10,.55,.1]]){const p2=(((T/per)+off)%1)*1.6-.3,g2=fx2.createLinearGradient(0,0,L2*.7,L2*.7);
      const a0=Math.max(0,Math.min(1,p2-wd)),a1=Math.max(0,Math.min(1,p2)),a2=Math.max(0,Math.min(1,p2+wd));g2.addColorStop(0,'rgba(255,255,255,0)');if(a0>0)g2.addColorStop(a0,'rgba(255,255,255,0)');g2.addColorStop(a1,'rgba(255,255,255,1)');if(a2<1)g2.addColorStop(a2,'rgba(255,255,255,0)');g2.addColorStop(1,'rgba(255,255,255,0)');
      fx2.fillStyle=g2;fx2.fillRect(0,0,w,h);}
    if(PL){const P1=((T/6.5)%1)*1.6-.3,P2=(((T/10)+.55)%1)*1.6-.3,D=PL.im.data;for(let n=0;n<PL.idx.length;n++){const f=PL.ph[n],v=Math.max(0,1-Math.abs(f-P1)/.16,1-Math.abs(f-P2)/.1),j=PL.idx[n]*4;D[j]=D[j+1]=D[j+2]=255;D[j+3]=v*255;}
      PL.cx.putImageData(PL.im,0,0);fx2.globalCompositeOperation='destination-out';fx2.drawImage(PL.mask,0,0);fx2.globalCompositeOperation='source-over';fx2.drawImage(PL.c,0,0);}   /* v13: on chrome strokes the light bands travel along the stroke, the way it was drawn */
    scx.globalCompositeOperation='lighter';scx.globalAlpha=Math.min(1,.55*lvl*k);scx.drawImage(fl,bx,by,bw,bh);scx.globalAlpha=1;scx.globalCompositeOperation='source-over';}
  // 2) travelling glint: a bright diagonal band that sweeps across every ~3.6 s, strongest on the lit rims and highlights
  const per=3.6,u=((T%per)/per)*1.8-.4,gc=r.gc||(r.gc=document.createElement('canvas'));if(gc.width!==w||gc.height!==h){gc.width=w;gc.height=h;}
  const gx=gc.getContext('2d');gx.globalCompositeOperation='source-over';gx.clearRect(0,0,w,h);const L=w+h,p=u*L,gr=gx.createLinearGradient(p-L*.12,0,p+L*.12,0);
  gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');
  gx.save();gx.transform(1,0,1,1,0,0);gx.fillStyle=gr;gx.fillRect(-h,0,L+h,h);gx.restore();   // sheared: the band runs top-left -> bottom-right diagonal
  if(PL){const D=PL.im.data;for(let n=0;n<PL.idx.length;n++){const v=Math.max(0,1-Math.abs(PL.ph[n]-u)/.12),j=PL.idx[n]*4;D[j]=D[j+1]=D[j+2]=255;D[j+3]=v*255;}
    PL.cx.putImageData(PL.im,0,0);gx.globalCompositeOperation='destination-out';gx.drawImage(PL.mask,0,0);gx.globalCompositeOperation='source-over';gx.drawImage(PL.c,0,0);}   /* v13: the glint follows each chrome stroke's own path (tap fills keep the diagonal) */
  gx.globalCompositeOperation='destination-in';gx.drawImage(ss.glint,0,0);
  if(!still){scx.globalCompositeOperation='lighter';scx.globalAlpha=Math.min(1,.35+.65*lvl);scx.drawImage(gc,bx,by,bw,bh);scx.globalAlpha=.6*lvl;scx.drawImage(gc,bx,by,bw,bh);scx.globalAlpha=1;}
  scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
  x.save();if(add)x.globalCompositeOperation='lighter';x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();
  // 3) bloom around the hottest highlights (breathes a little), plus the glint's own glow
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=(add?.45:.5)*(.85+.15*Math.sin(T*1.7));x.drawImage(ss.bloom,bx-16,by-16,(w+8)*MQ,(h+8)*MQ);
  const gb=r.gb||(r.gb=document.createElement('canvas'));if(gb.width!==w+8||gb.height!==h+8){gb.width=w+8;gb.height=h+8;}const gbx=gb.getContext('2d');gbx.clearRect(0,0,w+8,h+8);gbx.filter='blur(1.6px)';gbx.drawImage(gc,4,4);gbx.filter='none';
  x.globalAlpha=still?0:(add?.35:.45)*Math.min(1,.4+lvl);x.drawImage(gb,bx-16,by-16,(w+8)*MQ,(h+8)*MQ);
  // 4) specular shimmer: tiny star glints on the brightest spots, twinkling
  for(const [px,py,ph] of ss.pts){const a=Math.pow(Math.max(0,Math.sin(T*2.6+ph*40)),6);if(a<.05)continue;const R2=3+5*a;x.globalAlpha=a*.9;x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);}
  x.restore();}
function drawMirror(x,r,t){drawMirrors(x,[r]);}
/* v13: all chrome is drawn in ONE batch. Before, every chrome colour (each Any-color pick is its own colour) did ~8 full-size canvas passes
   every frame, so 20+ colours took ~300 ms a frame: the throttle then redrew only every ~0.7 s and the shimmer looked frozen. Now each
   colour is composed at quarter size and the page gets 3 full-size passes in total, however many chrome strokes there are. */
const CQ={};function cqC(k,w,h){let c=CQ[k];if(!c||c.width!==w||c.height!==h){c=document.createElement('canvas');c.width=w;c.height=h;CQ[k]=c;}return c;}
function drawMirrors(x,recs){const lvl=motionLvl('shimmer'),still=lvl<=0,live=!still&&performance.now()-LIGHT.t<2500,plx=live?LIGHT.x:0,ply=live?LIGHT.y:0,lq=[Math.round(plx*4)/20,Math.round(ply*4)/20],T=still?1.3:CCLK,now=performance.now();
  const lo=cqC('lo',WQ,HQ),lx=lo.getContext('2d'),bl=cqC('bl',WQ,HQ),blx=bl.getContext('2d'),gl=cqC('gl',WQ,HQ),glx=gl.getContext('2d');lx.clearRect(0,0,WQ,HQ);blx.clearRect(0,0,WQ,HQ);glx.clearRect(0,0,WQ,HQ);
  const stars=[],live2=[];
  for(const r of recs){const T=still?1.3:CCLK*(r.sp||1)+(r.ph||0);if(r.dirty)fxScan(r);if(!r.bb)continue;let ss=r.ss;if(!ss||!r.ssT||now-r.ssT>180||contourField(r)!==ss.F){ss=shineStatic(r,'chrome',lq);r.ssT=now;}
    const {X0,Y0,w,h}=ss;if(w<=2||h<=2)continue;live2.push(r);const PL=!still?phaseList(r,ss):null;
    const rc=r.rc||(r.rc=document.createElement('canvas'));if(rc.width!==w||rc.height!==h){rc.width=w;rc.height=h;}const cx=rc.getContext('2d');cx.globalCompositeOperation='source-over';cx.globalAlpha=1;cx.clearRect(0,0,w,h);cx.drawImage(ss.base,0,0);
    if(!still){const fl=r.fl||(r.fl=document.createElement('canvas'));if(fl.width!==w||fl.height!==h){fl.width=w;fl.height=h;}const fx2=fl.getContext('2d');
      fx2.globalCompositeOperation='source-over';fx2.clearRect(0,0,w,h);const hs=(T*24)%360,g1=fx2.createLinearGradient(0,0,w,h);
      for(let q=0;q<=4;q++)g1.addColorStop(q/4,`hsl(${(hs+q*80)%360},75%,60%)`);fx2.fillStyle=g1;fx2.fillRect(0,0,w,h);
      cx.globalCompositeOperation='soft-light';cx.globalAlpha=Math.min(1,.5*lvl);cx.drawImage(fl,0,0);
      fx2.clearRect(0,0,w,h);const L2=w+h;for(const [per,off,wd] of [[6.5,0,.16],[10,.55,.1]]){const p2=(((T/per)+off)%1)*1.6-.3,g2=fx2.createLinearGradient(0,0,L2*.7,L2*.7);
        const a0=Math.max(0,Math.min(1,p2-wd)),a1=Math.max(0,Math.min(1,p2)),a2=Math.max(0,Math.min(1,p2+wd));g2.addColorStop(0,'rgba(255,255,255,0)');if(a0>0)g2.addColorStop(a0,'rgba(255,255,255,0)');g2.addColorStop(a1,'rgba(255,255,255,1)');if(a2<1)g2.addColorStop(a2,'rgba(255,255,255,0)');g2.addColorStop(1,'rgba(255,255,255,0)');
        fx2.fillStyle=g2;fx2.fillRect(0,0,w,h);}
      if(PL){const P1=((T/6.5)%1)*1.6-.3,P2=(((T/10)+.55)%1)*1.6-.3,D=PL.im.data;for(let n=0;n<PL.idx.length;n++){const f=PL.ph[n],v=Math.max(0,1-Math.abs(f-P1)/.16,1-Math.abs(f-P2)/.1),j=PL.idx[n]*4;D[j]=D[j+1]=D[j+2]=255;D[j+3]=v*255;}
        PL.cx.putImageData(PL.im,0,0);fx2.globalCompositeOperation='destination-out';fx2.drawImage(PL.mask,0,0);fx2.globalCompositeOperation='source-over';fx2.drawImage(PL.c,0,0);}   /* on chrome strokes the light bands travel along the stroke, the way it was drawn */
      cx.globalCompositeOperation='lighter';cx.globalAlpha=Math.min(1,.55*lvl);cx.drawImage(fl,0,0);cx.globalAlpha=1;}
    const per=3.6,u=((T%per)/per)*1.8-.4,gc=r.gc||(r.gc=document.createElement('canvas'));if(gc.width!==w||gc.height!==h){gc.width=w;gc.height=h;}
    const gx=gc.getContext('2d');gx.globalCompositeOperation='source-over';gx.clearRect(0,0,w,h);const L=w+h,p=u*L,gr=gx.createLinearGradient(p-L*.12,0,p+L*.12,0);
    gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');
    gx.save();gx.transform(1,0,1,1,0,0);gx.fillStyle=gr;gx.fillRect(-h,0,L+h,h);gx.restore();
    if(PL){const D=PL.im.data;for(let n=0;n<PL.idx.length;n++){const v=Math.max(0,1-Math.abs(PL.ph[n]-u)/.12),j=PL.idx[n]*4;D[j]=D[j+1]=D[j+2]=255;D[j+3]=v*255;}
      PL.cx.putImageData(PL.im,0,0);gx.globalCompositeOperation='destination-out';gx.drawImage(PL.mask,0,0);gx.globalCompositeOperation='source-over';gx.drawImage(PL.c,0,0);}   /* the glint follows each chrome stroke's own path (tap fills keep the diagonal) */
    gx.globalCompositeOperation='destination-in';gx.drawImage(ss.glint,0,0);
    if(!still){cx.globalCompositeOperation='lighter';cx.globalAlpha=Math.min(1,.35+.65*lvl);cx.drawImage(gc,0,0);cx.globalAlpha=.6*lvl;cx.drawImage(gc,0,0);cx.globalAlpha=1;glx.globalCompositeOperation='lighter';glx.drawImage(gc,X0,Y0);}
    cx.globalCompositeOperation='destination-in';cx.drawImage(ss.mq,0,0);cx.globalCompositeOperation='source-over';
    lx.drawImage(rc,X0,Y0);blx.globalCompositeOperation='lighter';blx.drawImage(ss.bloom,X0-4,Y0-4);stars.push([ss.pts,T]);}
  if(!live2.length)return;
  const key=live2.map(r=>r.hex+':'+(r.seed||0)+':'+(r.mv||0)).join('|');let un=CQ.un;if(!un||CQ.unKey!==key){un=cqC('un',W,H);const ux=un.getContext('2d');ux.clearRect(0,0,W,H);for(const r of live2)ux.drawImage(r.mask,0,0);CQ.unKey=key;}
  scx.save();scx.globalCompositeOperation='source-over';scx.globalAlpha=1;scx.clearRect(0,0,W,H);scx.imageSmoothingEnabled=true;scx.drawImage(lo,0,0,WQ*MQ,HQ*MQ);scx.globalCompositeOperation='destination-in';scx.drawImage(un,0,0);scx.restore();
  x.save();x.drawImage(scratch,0,0);x.globalCompositeOperation='lighter';x.globalAlpha=.5*(.85+.15*Math.sin(T*1.7));x.drawImage(bl,0,0,WQ*MQ,HQ*MQ);
  if(!still){const gb=cqC('gb',WQ,HQ),gbx=gb.getContext('2d');gbx.clearRect(0,0,WQ,HQ);gbx.filter='blur(1.6px)';gbx.drawImage(gl,0,0);gbx.filter='none';x.globalAlpha=.45*Math.min(1,.4+lvl);x.drawImage(gb,0,0,WQ*MQ,HQ*MQ);}
  for(const [P,Tr] of stars)for(const [px,py,ph] of P){const a=Math.pow(Math.max(0,Math.sin(Tr*2.6+ph*40)),6);if(a<.05)continue;const R2=3+5*a;x.globalAlpha=a*.9;x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);}
  x.restore();}
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
function drawSmoke(x,r,t){if(!RM.matches)t=CLK.smokeSpeed||0;   // v22: smoke has its own Speed slider clock
  const [bx,by,bw,bh]=r.bb,dt=RM.matches?0:Math.min(.05,Math.max(0,t-(r.lt||t)));r.lt=t;
  const cap=Math.min(90,30+Math.round(Math.sqrt(bw*bh)/6)),s0=Math.max(30,Math.min(64,Math.sqrt(bw*bh)/6))*(r.amt||1);r.acc=(r.acc||0)+dt*22;
  if(!r.parts.length)r.acc+=Math.min(cap,24);
  while(r.acc>=1&&r.pts.length){r.acc-=1;if(r.parts.length>=cap){r.acc=0;break;}const q=r.pts[(Math.random()*r.pts.length)|0];
    r.parts.push({x:q[0],y:q[1],sx:q[0],sy:q[1],vx:(Math.random()-.5)*14,vy:-(4+Math.random()*8),age:RM.matches?1.2:0,life:3+Math.random()*3.5,s0:s0*(.6+Math.random()*.7),rot:Math.random()*6.28,vr:(Math.random()-.5)*.9,seed:Math.random(),lay:Math.random()<.35?1:0});}
  if(!r.loose)r.loose=fxLoose(r,26,5);
  const ex=70,X0=Math.max(0,bx-ex),Y0=Math.max(0,by-ex),X1=Math.min(W,bx+bw+ex),Y1=Math.min(H,by+bh+ex);
  scx.clearRect(X0,Y0,X1-X0,Y1-Y0);scx.globalCompositeOperation='source-over';const spr=wispSprite(r.hex),spr2=wispSprite(mixHex(r.hex,.3));
  for(let k=r.parts.length-1;k>=0;k--){const q=r.parts[k];q.age+=dt;if(q.age>=q.life){r.parts.splice(k,1);continue;}
    const sd=r.seed||1,fd=flowDir(r)+(runDir(Math.floor(t/5.5+(sd%97)/31),sd)<0?Math.PI:0),fx=(vnoise3(q.x*.011,q.y*.011,t*.22+q.seed*3,sd)-.5)*3.2+Math.cos(fd)*.35,fy=(vnoise3(q.x*.011,q.y*.011,t*.22+q.seed*3,sd+97)-.5)*3.2+Math.sin(fd)*.25;   // v22: curling air from seeded noise, drifting along the stroke
    q.vx+=(fx*40+(q.sx-q.x)*.06)*dt;q.vy+=(fy*26-5+(q.sy-q.y)*.05)*dt;q.vx*=1-.8*dt;q.vy*=1-.7*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.rot+=(q.vr+fx*.3)*dt;   // hover: a soft pull back to where it rose
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
  if(!Q.lv){Q.lv=new Uint8Array(WQ*HQ);const sd=r.seed||3;for(let i=0;i<Q.lv.length;i++)if(Q.m[i])Q.lv[i]=Math.min(7,(vnoise3((i%WQ)*.05,((i/WQ)|0)*.05,0,sd)*8)|0);}   // v23: neighbouring areas pulse on their own phase/period
  const luts=[];for(let L=0;L<8;L++){const lut=new Float32Array(33),sd=r.seed||3,tl=tt*(1+(hash2(L,sd)<.5?-1:1)*(.05+.05*hash2(L,sd+2)))+hash2(L,sd+1)*9;for(let k=0;k<=32;k++)lut[k]=lightPulseE(k/32,tl,o.sp,o.n,o.dir);luts.push(lut);}
  for(let y=Y0;y<Y1;y++)for(let X=X0;X<X1;X++){const i=y*WQ+X,j=((y-Y0)*w+(X-X0))*4;if(!Q.m[i]){D[j+3]=0;continue;}const v=luts[Q.lv[i]][Math.round(Q.d[i]*32)];D[j]=rgb[0];D[j+1]=rgb[1];D[j+2]=rgb[2];D[j+3]=v*255*o.a;}
  const c=r.pc||(r.pc=document.createElement('canvas'));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.getContext('2d').putImageData(q,0,0);
  scx.clearRect(bx,by,bw,bh);scx.globalCompositeOperation='source-over';scx.imageSmoothingQuality='high';scx.drawImage(c,X0*MQ,Y0*MQ,w*MQ,h*MQ);
  scx.globalCompositeOperation='destination-in';scx.drawImage(r.mask,bx,by,bw,bh,bx,by,bw,bh);scx.globalCompositeOperation='source-over';
  x.save();x.globalCompositeOperation='lighter';x.drawImage(scratch,bx,by,bw,bh,bx,by,bw,bh);x.restore();}
let PPLV=null;function ppPulse(x,t){ // light pulses travel up through raised Pop Pencil areas (height = depth)
  const P=S&&S.pp;if(!P||!P.any||!P.hq)return;const q=P.pq||(P.pq=new ImageData(WQ,HQ)),D=q.data,tt=RM.matches?.3:t;if(!PPLV){PPLV=new Uint8Array(WQ*HQ);for(let i=0;i<PPLV.length;i++)PPLV[i]=Math.min(7,(vnoise3((i%WQ)*.05,((i/WQ)|0)*.05,0,911)*8)|0);}
  const luts=[];for(let L=0;L<8;L++){const lut=new Float32Array(33),tl=tt*(1+(hash2(L,77)<.5?-1:1)*(.05+.05*hash2(L,79)))+hash2(L,78)*9;for(let k=0;k<=32;k++)lut[k]=lightPulseE(k/32,tl,.35,1,'forward');luts.push(lut);}   // v23: no page-wide pulse in step
  for(let i=0;i<P.hq.length;i++){const hv=P.hq[i],j=i*4;if(hv<=.02){D[j+3]=0;continue;}D[j]=255;D[j+1]=246;D[j+2]=222;D[j+3]=luts[PPLV[i]][Math.round(Math.min(1,hv)*32)]*120;}
  const c=P.pc||(P.pc=Object.assign(document.createElement('canvas'),{width:WQ,height:HQ}));c.getContext('2d').putImageData(q,0,0);
  x.save();x.globalCompositeOperation='lighter';x.imageSmoothingQuality='high';x.drawImage(c,0,0,W,H);x.restore();}
let fxTotal=0,fxRaf=0,fxLast=0;
function fxDraw(now){if(!S||!S.fxC)return;const x=S.fxC.getContext('2d');if(x.reset)x.reset();else{x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.shadowBlur=0;x.shadowColor='rgba(0,0,0,0)';x.filter='none';}x.clearRect(0,0,W,H);const t=RM.matches?1.2:now/1000;fxNow=now/1000;{const d=Math.min(.4,Math.max(0,fxNow-pclkLast));pclkLast=fxNow;PCLK+=d*motionLvl('pulseSpeed');if(!CFIX)CCLK+=d*motionLvl('shimmerSpeed');for(const k of ['twinkleSpeed','neonSpeed','glowSpeed','boltSpeed','smokeSpeed','partSpeed'])if(!(BFIX&&k==='boltSpeed'))CLK[k]=(CLK[k]||0)+d*motionLvl(k);}
  const t0=performance.now();fxTotal=(S.fx||[]).reduce((a,r)=>a+r.parts.length,0);{const mir=(S.fx||[]).filter(r=>r.kind==='mirror');let mDone=false;for(const r of S.fx||[]){const q=performance.now();if(r.kind!=='mirror'&&r.dirty)fxScan(r);if(r.kind!=='mirror'&&r!==S.fx[0]){if(r.bb){const [ex,ey,ew,eh]=r.bb;x.save();x.globalCompositeOperation='destination-out';x.drawImage(r.mask,ex,ey,ew,eh,ex,ey,ew,eh);x.restore();}}if(r.kind==='cover'||(r.kind!=='mirror'&&!r.bb))continue;   /* v24: newer paint hides the older effects' glow under it */
    if(r.kind==='mirror'){if(!mDone){mDone=true;drawMirrors(x,mir);}}else if(r.amt&&Math.abs(r.amt-1)>.02&&!PARTK(r.kind)){const A=AMTC||(AMTC=mk()),ax=A.getContext('2d');ax.clearRect(0,0,W,H);fxDrawRec(ax,r,t);if(LIGHTK.has(r.kind))drawLight(ax,r);x.save();x.globalAlpha=Math.min(1,r.amt);x.drawImage(A,0,0);if(r.amt>1){x.globalCompositeOperation='lighter';x.globalAlpha=Math.min(1,r.amt-1);x.drawImage(A,0,0);}x.restore();r.ms=(r.ms||0)*.8+(performance.now()-q)*.2;continue;}   /* v23: Mix intensity */
    else fxDrawRec(x,r,t);if(LIGHTK.has(r.kind))drawLight(x,r);r.ms=(r.ms||0)*.8+(performance.now()-q)*.2;}}ppPulse(x,t);fxMs=fxMs*.8+(performance.now()-t0)*.2;}
let fxMs=0,AMTC=null;const PARTK=k=>k==='twinkle'||k==='smoke'||k==='cloud'||k.startsWith('pt');
function mixSlotOf(k){return PARTK(k)?'part':(k==='pulsefx'||k==='glowfx'||k==='boltfx'||(k==='shimmer'&&ink.mix&&ink.mix.anim==='shimmer'))?'anim':'finish';}
const fxLive=()=>S&&((S.fx&&S.fx.length)||(S.pp&&S.pp.any));
const fxNeedsLoop=()=>!RM.matches||(S&&(S.fx||[]).some(r=>(motionLvl('shimmer')>0&&['mirror','shine','jshine','shimmer'].includes(r.kind))||(motionLvl('sparkle')>0&&r.kind==='twinkle')));
function fxStart(){if(fxRaf||!fxLive())return;fxAttach();if(!fxNeedsLoop()||document.hidden){fxDraw(performance.now());return;}
  const step=now=>{fxRaf=0;if(!fxLive()||document.hidden)return;if(!fxNeedsLoop()){fxDraw(now);return;}if(now-fxLast>=Math.max(32,fxMs*2.2)){fxLast=now;fxDraw(now);}/* adaptive: slow machines draw effects less often so taps and strokes stay responsive */fxRaf=requestAnimationFrame(step);};fxRaf=requestAnimationFrame(step);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(fxRaf);fxRaf=0;cancelAnimationFrame(pvRaf);pvRaf=0;}else{fxStart();pvStart();}});
function saveFx(st){const L=st.fxL||{free:st.fx||[],cbn:[]};for(const [md,key] of [['free','fx.'],['cbn','cfx.']]){const a=(L[md]||[]).filter(r=>r.bb||r.dirty).map(r=>Object.assign({kind:r.kind,hex:r.hex,m:r.mask.toDataURL('image/png')},r.phC?{ph:r.phC.toDataURL('image/png')}:{},r.seed?{P:{seed:r.seed,ph:r.ph,dir:r.dir,light:r.light,sp:r.sp,amt:r.amt||1,mixO:r.mixO||null}}:{}));a.length?LS.set(key+st.n,a):LS.del(key+st.n);}}
async function loadFx(st){st.fxL={free:[],cbn:[]};for(const [md,key] of [['free','fx.'],['cbn','cfx.']]){st.fx=st.fxL[md];const a=LS.get(key+st.n,[]);for(const q of a){try{const im=await loadImg(q.m);const m=mk();const mx=m.getContext('2d',{willReadFrequently:true});mx.drawImage(im,0,0);
  const rr=Object.assign({kind:q.kind,hex:q.hex,mask:m,mx,bb:null,pts:[],parts:[],dirty:true},q.P||{});if(q.ph){try{phCanvas(rr);rr.phX.drawImage(await loadImg(q.ph),0,0);rr.phV=1;}catch(e){}}st.fx.push(rr);}catch(e){}}}st.fx=st.fxL[mode];}
function fxSetList(st){if(!st)return;st.fxL=st.fxL||{free:st.fx||[],cbn:[]};st.fxL[mode==='cbn'?'free':'cbn']=st.fxL[mode==='cbn'?'free':'cbn']||[];st.fx=st.fxL[mode]=st.fxL[mode]||[];}

/* ---------- animated previews: pencil-set box strip, mixer, store rows and the upgrade sheet ---------- */
const MIXK={finish:[['plain','Plain',null],['metal','Metallic','pencils'],['chrome','Chrome','pencils'],['neon','Neon','pencils'],['jewel','Jewel','pencils'],['wood','Wood','pencils'],['brick','Brick','pencils'],['stone','Stone','pencils'],['flower','Flowers','pencils'],['fur','Fur & Hair','pencils']],
  anim:[['none','None',null],['pulse','Pulse','pencils'],['glow','Glowing','pencils'],['shimmer','Shimmer','pencils'],['lightning','Lightning','pencils']],
  part:[['none','None',null],['glitter','Glitter','pencils'],['smoke','Smoke','smoke'],['cloud','Cloud','clouds'],['water','Water',null],['fire','Fire & Embers',null],['sparks','Sparks',null],['snow','Snow',null],['bubbles','Bubbles',null],['stars','Stars',null],['leaves','Leaves',null]]};
const MIXSET={fur:'fur',wood:'wood',brick:'brick',stone:'stone',flower:'flower',lightning:'lightning',metal:'metal',chrome:'chrome',neon:'neon',jewel:'jewel',pulse:'pulse',glow:'glow',shimmer:'jewel',glitter:'glitter',smoke:'smoke',cloud:'cloud'};
const MIX=Object.assign({on:false,finish:'metal',anim:'pulse',part:'glitter'},LS.get('mix',{}));MIX.on=false;MIX.amt=Object.assign({finish:1,anim:1,part:1},MIX.amt||{});MIX.sel=MIX.sel||'part';
function specOfSet(set){if(set.id==='ramp')return {kinds:['ramp'],ramps:['rainbow','sunset','ocean','gold'],colors:['#ef4444','#fb923c','#0891b2','#d4a015']};if(set.type==='plain')return {kinds:['plain'],colors:[set.colors[3],set.colors[7],set.colors[11]||set.colors[1],set.colors[5]]};
  const it=set.items;if(set.id==='brush')return {kinds:['brush'],colors:['#3a6ad6','#c9473d','#4c9a5b']};
  return {kinds:[set.id],colors:[0,1,2,3].map(i=>it[i%it.length].hex)};}
function specOfMix(hexes){return {kinds:['mix'],mix:{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:{...MIX.amt}},colors:hexes||[color,'#d4af37','#3a6ad6']};}
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
    const bI=(finish==='lightning'||anim==='lightning')?boltI(t*motionLvl('boltSpeed')+i*1.3)*motionLvl('boltStr'):0;if(finish==='lightning'||anim==='lightning'){x.shadowColor=hex;x.shadowBlur=lw*(1.2+2.4*Math.min(1,bI));}
    if(anim==='glow'){const s=.5+.5*Math.sin(t*2*Math.PI/3.2+i);x.shadowColor=hex;x.shadowBlur=lw*(1.5+2.2*s);}
    if(anim==='pulse'){const b=.5+.5*Math.sin(t*2*Math.PI/2.4+i*.6);x.globalAlpha=fade*(.62+.38*b);x.shadowColor=hex;x.shadowBlur=lw*1.4*b;}
    if(finish==='smoke'||finish==='cloud')x.globalAlpha*=finish==='smoke'?.7:.55;
    const tipPt=pvPath(x,w,h,i,n,prog);x.stroke();
    if(bI>.04){x.save();x.shadowBlur=lw*1.4;x.shadowColor=hex;x.strokeStyle=`rgba(255,255,255,${Math.min(1,bI)})`;x.lineWidth=lw*.42;pvPath(x,w,h,i,n,prog);x.stroke();x.restore();}
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
        const pa=(m.amt&&m.amt.part)||1,a=(u0<.18?u0/.18:Math.pow(1-(u0-.18)/.82,2))*(hot?1:.6)*fade*glB(pa),R2=lw*(hot?.5:.22)*(.6+.4*a)*glS(pa);if(a>.03){x.globalAlpha=a;x.drawImage(GLINT,px-R2*2,py-R2*2,R2*4,R2*4);}}x.globalCompositeOperation='source-over';}
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
function mixInk(){ink={kind:'mix',hex:color,id:null,mix:{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:{...MIX.amt}}};setInkPattern();markColor();}
/* v24: the Size / Intensity slider changes the strokes already drawn with that Mix option, live (and they keep it in autosave) */
function mixAmtLive(slot){if(!S||!S.fx)return;const v=MIX.amt[slot]||1,o=MIX[slot];let n=0;for(const r of S.fx){if(!r.mixO||r.mixO!==o||mixSlotOf(r.kind)!==slot)continue;r.amt=v;r.sf=null;n++;}if(n){dirty('fx');fxDraw(performance.now());}return n;}
function buildMixer(){const el=$('#mixer');if(!el)return;
  {let h=el.querySelector('.mxhint');if(!h){h=document.createElement('small');h.className='mxhint';h.textContent='Changes preview live; Accept keeps them.';const sd=el.querySelector('.mxside');(sd||el).appendChild(h);}}
  const row=(slot,label)=>`<div class="mxrow"><b>${label}</b>${MIXK[slot].map(([id,name,prod])=>{const own=!prod||mixOwned(id),set=SETS[SETI[MIXSET[id]]],l=set&&!own?Trials.left(set.id):0;
    return `<button class="mxo${MIX[slot]===id?' on':''}${own?'':' lk'}" data-slot="${slot}" data-o="${id}" title="${own?name:name+' · locked'}">${own?'':LOCK}${name}${own?'':`<small>${l?l+' free':'Unlock'}</small>`}</button>`;}).join('')}</div>`;
  el.querySelector('.mxrows').innerHTML=row('finish','Finish')+row('anim','Animation')+row('part','Particles');
  {let am=el.querySelector('.mxamt');if(!am){am=document.createElement('div');am.className='mxamt';el.appendChild(am);}   /* v23: size / intensity of the selected finish, animation or particles */
    const nm={finish:'Finish',anim:'Animation',part:'Particles'},cur=MIX.sel,lab=MIXK[cur].find(q=>q[0]===MIX[cur]),v=MIX.amt[cur]||1,word=cur==='part'?'Size':'Intensity';
    am.innerHTML=`<div class="mxat">${['finish','anim','part'].map(k=>`<button class="mxas${k===cur?' on':''}" data-s="${k}">${nm[k]}</button>`).join('')}</div><b>${word} · ${esc(lab?lab[1]:'')}</b><input type="range" min="0.3" max="2.5" step="0.05" value="${v}" aria-label="${word} of the ${nm[cur]}"><em>${Math.round(v*100)}%</em>`;
    am.querySelectorAll('.mxas').forEach(b=>b.onclick=()=>{MIX.sel=b.dataset.s;LS.set('mix',{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:MIX.amt,sel:MIX.sel});buildMixer();});
    const ri=am.querySelector('input');ri.oninput=()=>{MIX.amt[cur]=+ri.value;am.querySelector('em').textContent=Math.round(ri.value*100)+'%';LS.set('mix',{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:MIX.amt,sel:MIX.sel});if(MIX.on)mixInk();mixAmtLive(cur);};
    ['pointerdown','click'].forEach(ev=>am.addEventListener(ev,e=>e.stopPropagation()));}
  el.querySelectorAll('.mxo').forEach(b=>b.onclick=()=>{const slot=b.dataset.slot,o=b.dataset.o,set=SETS[SETI[MIXSET[o]]];
    if(set&&!owned(set)&&Trials.left(set.id)<=0){openUpgrade(null,set.product);return;}
    MIX[slot]=o;MIX.sel=slot;LS.set('mix',{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:MIX.amt,sel:MIX.sel});if(MIX.on)mixInk();buildMixer();if(MIX.on)buildPalette();
    if(set&&!owned(set))toast(`${set.name}: ${Trials.left(set.id)} free ${Trials.left(set.id)===1?'try':'tries'} left in the mix`);});
  const cv=el.querySelector('canvas.mxpv');if(cv&&!cv._pv)cv._pv=pvAdd(cv,t=>drawFxPreview(cv,specOfMix([color,MIX.finish==='plain'?'#ff7b2e':'#d4af37','#3a6ad6']),t));}
function setMix(on){const was=MIX.on;MIX.on=on;if(was!==on)setTimeout(buildPalette,0);$('#mixBtn')&&$('#mixBtn').classList.toggle('on',on);$('#mixer').hidden=!on||!mixPrev;if(on){if(tool!=='pencil'&&tool!=='fill'&&!(toolSet==='3d'&&tool==='poppencil'))setTool(drawTool());mixInk();buildMixer();}
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
/* v12: only true empty background stays flat: a big open backdrop area (sky, plain wall) that runs to the picture edge.
   Clouds, lightning, stars and other drawn things in the sky are their own closed areas and pop like anything else. */
function isBackdrop(st,r){const T=depthOf(st);if(T&&T.lv[r]!==0)return false;const b=r*4,edge=st.bb[b]<=0||st.bb[b+1]<=0||st.bb[b+2]>=W-1||st.bb[b+3]>=H-1;return edge&&st.cnt[r]>W*H*.01;}
function ppRegions(r,x,y){ // outline boundary = the region under the first touch; where the template knows the object (hand), use the object
  return [r];}   // v12: strictly the one line-enclosed area where the stroke starts (every line is a wall), like Fill
function ppMaskFor(rs){const c=mk(),x=c.getContext('2d'),m=x.createImageData(W,H),D=m.data;for(const q of rs)for(let p=S.off[q];p<S.off[q+1];p++)D[S.pix[p]*4+3]=255;x.putImageData(m,0,0);return c;}
function ppBegin(x,y){
  if(!Effects3D.unlocked()&&S.n!==FREE_3D_SCENE){if(Trials.popsLeft()<=0){openUpgrade(null,'effects3d');return;}Trials.spendPop();refreshPremiumUI();
    const l=Trials.popsLeft();toast(l?`Pop Pencil · free tries: ${l} left`:'That was your last free 3D try ✦');}
  let r=labAt(x,y);if(!r)return;if(isInk(x,y)){const q=nearestPx(x,y,LINE_LOCK.SNAP_START,(v,u,w)=>v>0&&!isInk(u,w));if(q)r=labAt(q[0],q[1]);}
  ppCanvases(S);const tmp=mk(),rs=ppRegions(r,x,y);pps={r,rs,mask:ppMaskFor(rs),tmp,tx:tmp.getContext('2d'),last:[x,y],inset:POP.pressed,v:POP.flat?0:(POP.pressed?-1:1)};ppStamp(x,y);ppFlush();}
function ppStamp(x,y){const R=ppR()/zoomSizeDiv();pps.tx.globalAlpha=.16;pps.tx.drawImage(sprite,x-R,y-R,2*R,2*R);}
function ppMove(x,y){const [lx,ly]=pps.last,d=Math.hypot(x-lx,y-ly),step=Math.max(1,ppR()*.3/zoomSizeDiv()),n=Math.floor(d/step);
  for(let i=1;i<=n;i++)ppStamp(lx+(x-lx)*i/n,ly+(y-ly)*i/n);if(n)pps.last=[x,y];if(!ppFlush.t)ppFlush.t=setTimeout(()=>{ppFlush.t=0;ppFlush();},90);}
function ppFlush(){if(!pps)return;const st=S.pp,t=pps.tx,r=pps.r,b=r*4,bx=S.bb[b],by=S.bb[b+1],bw=S.bb[b+2]-bx+1,bh=S.bb[b+3]-by+1;if(bw<=0||bh<=0)return;
  // the stroke sets the height toward the slider value (+ raise, - inset, 0 flattens), only on pixels of the starting area
  const Tm=t.getImageData(bx,by,bw,bh).data,R=st.rx.getImageData(bx,by,bw,bh),I=st.ix.getImageData(bx,by,bw,bh),dr=R.data,di=I.data,v=pps.v,lab=S.lab;
  for(let y=0;y<bh;y++){const o=(by+y)*W+bx;for(let x=0;x<bw;x++){const j=(y*bw+x)*4+3,a=Tm[j];if(!a||lab[o+x]!==r)continue;
    const k=a/255,h0=(dr[j]-di[j])/255,h=v>0?(h0>=v?h0:Math.min(v,h0+k)):v<0?(h0<=v?h0:Math.max(v,h0-k)):(h0>0?Math.max(0,h0-k):Math.min(0,h0+k));dr[j]=h>0?Math.round(h*255):0;di[j]=h<0?Math.round(-h*255):0;}}
  st.rx.putImageData(R,bx,by);st.ix.putImageData(I,bx,by);t.clearRect(0,0,W,H);ppRender(S);}   // v8 feel: every pass adds a little more, up to the slider height
function ppEnd(){if(!pps)return;clearTimeout(ppFlush.t);ppFlush.t=0;ppFlush();const sr=pps.r;setTimeout(()=>popSelect('pp',sr),0);pps=null;dirty('pp');}
function ppRender(st){const P=st.pp;if(!P)return;const N=W*H,dr=P.rx.getImageData(0,0,W,H).data,di=P.ix.getImageData(0,0,W,H).data;
  const h=new Float32Array(N),lab=st.lab,mark=new Uint8Array(st.N);let any=false;for(let i=0;i<N;i++){const v=(dr[i*4+3]-di[i*4+3])/255;h[i]=v;if(v){any=true;mark[lab[i]]=1;}}   // alpha caps at 255: the height cap
  mark[0]=0;
  const lx=P.li.getContext('2d'),sx=P.sh.getContext('2d');lx.clearRect(0,0,W,H);sx.clearRect(0,0,W,H);P.any=any;if(!any){ppAttach(st);return;}
  /* v13: the soft bevel blur only mixes pixels of the SAME area (other areas count as flat), so one section's height never bleeds into a neighbour's rim */
  const b=new Float32Array(N),R=3,D7=2*R+1;for(let pass=0;pass<2;pass++){for(let y=0;y<H;y++){const o=y*W;for(let x=0;x<W;x++){const i=o+x,L=lab[i];if(!mark[L]){b[i]=0;continue;}let s=0;const x0=Math.max(0,x-R),x1=Math.min(W-1,x+R);for(let q=o+x0;q<=o+x1;q++)if(lab[q]===L)s+=h[q];b[i]=s/D7;}}
    for(let x=0;x<W;x++){for(let y=0;y<H;y++){const i=y*W+x,L=lab[i];if(!mark[L]){h[i]=0;continue;}let s=0;const y0=Math.max(0,y-R),y1=Math.min(H-1,y+R);for(let q=y0*W+x;q<=y1*W+x;q+=W)if(lab[q]===L)s+=b[q];h[i]=s/D7;}}}
  for(let i=0;i<N;i++)if(!mark[lab[i]])h[i]=0;   // v12: nothing outside the popped areas (lines and neighbours stay untouched)
  const im=lx.createImageData(W,H),D=im.data,K=44;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(!h[i]&&!h[i-1]&&!h[i+1]&&!h[i-W]&&!h[i+W])continue;
    const L=lab[i],hn=q=>lab[q]===L?h[q]:0,gx=(hn(i+1)-hn(i-1))*.5,gy=(hn(i+W)-hn(i-W))*.5,v=(gx+gy)*.7071*K+(h[i]<0?h[i]*.3:h[i]*.06),j=i*4;
    if(v>0){D[j]=255;D[j+1]=250;D[j+2]=238;D[j+3]=Math.min(28,v*60);}else if(v<0){D[j]=16;D[j+1]=10;D[j+2]=5;D[j+3]=Math.min(170,-v*240);}}   /* v16: near-black shadow = a darker shade of the color underneath */
  lx.putImageData(im,0,0);
  const m=sx.createImageData(W,H);for(let i=0;i<N;i++)if(h[i]>.03)m.data[i*4+3]=Math.min(255,h[i]*500);const mc=mk();mc.getContext('2d').putImageData(m,0,0);
  sx.save();sx.shadowColor='rgba(38,22,8,.35)';sx.shadowBlur=9;sx.shadowOffsetX=4+W*2;sx.shadowOffsetY=7;sx.drawImage(mc,-W*2,0);sx.restore();
  sx.globalCompositeOperation='destination-out';sx.drawImage(mc,0,0);sx.globalCompositeOperation='source-over';
  {const rm=regionMask(st,mark);for(const c of [lx,sx]){c.save();c.globalCompositeOperation='destination-in';c.drawImage(rm,0,0);c.restore();}}
  const hq=new Float32Array(WQ*HQ);for(let y=0;y<HQ;y++)for(let X=0;X<WQ;X++)hq[y*WQ+X]=Math.max(0,h[(y*MQ+2)*W+X*MQ+2]);P.hq=hq;ppAttach(st);if(st===S)scheduleLineTint();if(st===S&&typeof fxStart==='function')fxStart();}
function regionMask(st,mark){const c=mk(),x=c.getContext('2d'),m=x.createImageData(W,H),D=m.data;for(let r=1;r<st.N;r++)if(mark[r])for(let p=st.off[r];p<st.off[r+1];p++)D[st.pix[p]*4+3]=255;x.putImageData(m,0,0);return c;}
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
  const plan=S.idea3d;idea3d(false);S.pops=(S.pops||[]).concat(plan.map(p=>({...p})));renderPops();dirty('pop');toast('3D idea applied · Pop Erase removes any part');}

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
  const hr=D3.on?regionHeights(S):null;S.ltAny=!!hr;if(!hr)return;   /* v12: 2D pops leave the black lines alone (lines are walls); lit outlines stay for the 3D view */
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
/* v18: Lines fader also lives in the tool box (same setting as the Lines panel's Fade slider) */
function tbFadeSync(){const i=$('#tbFade');if(!i||!S)return;const L=linesOf(S);if(document.activeElement!==i)i.value=Math.round((L.f||0)*100);$('#tbFadeV').textContent=L.h?'hidden':(L.f?Math.round(L.f*100)+'%':'black');}
function linesApply(){try{tbFadeSync();}catch(e){}if(!S)return;const L=linesOf(S),def=linesDefault(L),op=L.h?0:1-(L.f||0),under=$('#lineUnder'),lc=$('#lineCol');
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
const lastPaintT=()=>{const f=S.free.undo[S.free.undo.length-1],c=S.cbn.hist[S.cbn.hist.length-1],l=S.ltrUndo&&S.ltrUndo[S.ltrUndo.length-1];return Math.max(mode==='free'?(f&&f.t||0):(c&&c.t||0),l?l.t:0);};
const LINE_SW=['#141414','#5a3a22','#2f3f6b','#7a1f2b','#2f5a3a','#8a8a8a'];const lnWheel={hex:'#000000'};
function linesUI(){const p=$('#linesPop');if(!p||p.hidden||!S)return;const L=linesOf(S);
  $('#lnFade').value=Math.round((L.f||0)*100);$('#lnFadeV').textContent=L.h?'hidden':(L.f?Math.round(L.f*100)+'%':'black');
  $$('#linesPop .lnc').forEach(b=>b.classList.toggle('on',b.dataset.c===L.c||(b.dataset.c==='cur'&&L.c===color)||(b.id==='lnWheelSw'&&L.c===lnWheel.hex)||(b.dataset.c!=='cur'&&b.dataset.c===L.c)));
  const cur=$('#linesPop .lnc[data-c=cur]');cur.style.background=color;cur.title='Your color ('+colorName(color)+')';
  $('#lnHide').setAttribute('aria-pressed',L.h?'true':'false');$('#lnHide').classList.toggle('on',!!L.h);
  {const st=L.h?'none':(L.f>0?'see':'solid');$$('#linesPop .lns').forEach(b=>{b.classList.toggle('on',b.dataset.s===st);b.setAttribute('aria-pressed',String(b.dataset.s===st));});}}
function linesDoneGlow(){const b=$('#linesBtn');if(!b||!S)return;b.classList.toggle('hot',!!(S.cbn.complete||(S.cbn.done&&S.cbn.done===S.total)));}
(function(){const b=$('#linesBtn'),p=$('#linesPop');if(!b||!p)return;
  const place=()=>{const r=b.getBoundingClientRect(),pw=p.offsetWidth||280,ph=p.offsetHeight||200;p.style.left=Math.max(8,Math.min(innerWidth-pw-8,r.left+r.width/2-pw/2))+'px';p.style.top=Math.max(8,r.top-ph-10)+'px';};
  b.onclick=e=>{e.stopPropagation();p.hidden=!p.hidden;b.setAttribute('aria-expanded',!p.hidden);if(!p.hidden){linesUI();place();}};
  document.addEventListener('pointerdown',e=>{if(phP==='lines')return;if(!p.hidden&&!p.contains(e.target)&&!b.contains(e.target)){p.hidden=true;b.setAttribute('aria-expanded','false');}});
  $('#lnFade').oninput=e=>setLines({f:+e.target.value/100});
  {const tf=$('#tbFade');if(tf)tf.oninput=e=>setLines({f:+e.target.value/100});}
  $$('#linesPop .lnc').forEach(c=>c.onclick=()=>{if(c.id==='lnWheelSw'){setLines({c:lnWheel.hex});return;}setLines({c:c.dataset.c==='cur'?color:c.dataset.c});});
  /* v23: full color wheel for the lines (hue around, saturation outward, brightness slider) */
  {const cv=$('#lnWheel'),x=cv.getContext('2d'),N=cv.width,R=N/2,im=x.createImageData(N,N);for(let y=0;y<N;y++)for(let X=0;X<N;X++){const dx=X-R+.5,dy=y-R+.5,d=Math.hypot(dx,dy)/R,j=(y*N+X)*4;if(d>1)continue;
      const c=hex2rgb(hsl2hex(Math.atan2(dy,dx)*180/Math.PI+90,1,1-.5*Math.min(1,d)));im.data[j]=c[0];im.data[j+1]=c[1];im.data[j+2]=c[2];im.data[j+3]=d>.985?Math.round((1-d)/.015*255):255;}x.putImageData(im,0,0);
    const st=LS.get('lnWheel',{h:20,s:.8,v:.55}),disc=cv.parentNode;
    const show=()=>{const v=st.v,c=hsl2hex(st.h,1,1-.5*st.s);const rgb=hex2rgb(c).map(q=>q*v);lnWheel.hex='#'+rgb.map(q=>Math.round(q).toString(16).padStart(2,'0')).join('');
      $('#lnWDark').style.opacity=1-v;$('#lnWV').value=Math.round(v*100);$('#lnWHex').textContent=lnWheel.hex;$('#lnWheelSw').style.background=lnWheel.hex;
      const a=(st.h-90)*Math.PI/180;$('#lnWDot').style.left=(50+Math.cos(a)*st.s*50)+'%';$('#lnWDot').style.top=(50+Math.sin(a)*st.s*50)+'%';};
    const pick=e=>{const r=disc.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;st.h=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;st.s=Math.min(1,Math.hypot(dx,dy)/(r.width/2));show();setLines({c:lnWheel.hex});LS.set('lnWheel',st);};
    disc.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();disc.setPointerCapture(e.pointerId);pick(e);});disc.addEventListener('pointermove',e=>{if(disc.hasPointerCapture(e.pointerId))pick(e);});
    $('#lnWV').oninput=e=>{st.v=+e.target.value/100;show();setLines({c:lnWheel.hex});LS.set('lnWheel',st);};show();}
  $('#lnHide').onclick=()=>setLines({h:linesOf(S).h?0:1});
  $$('#linesPop .lns').forEach(b=>b.onclick=()=>setLines(b.dataset.s==='none'?{h:1}:b.dataset.s==='see'?{h:0,f:.55}:{h:0,f:0}));   /* v19: three line styles */
  {const t=$('#lnTrace');if(t)t.onclick=()=>ltSet(!LT.on);const b=$('#ltBtn');if(b)b.onclick=()=>ltSet(!LT.on);}
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
/* v24 (desktop): the color suggestions sit in a column OUTSIDE the picture, on its left (right side only if the left has no room),
   so they never cover the drawing. Phone keeps its strip above the tab bar. */
function placeTry(){const el=$('#tryrow');if(!el||el.hidden)return;const phone=matchMedia('(max-width:600px)').matches;
  if(phone){if(el.parentNode!==stage)stage.appendChild(el);el.classList.remove('col','slim');el.style.cssText='';return;}
  if(el.parentNode!==document.body)document.body.appendChild(el);el.classList.add('col');el.classList.remove('slim');el.style.visibility='hidden';el.style.left='0px';el.style.top='0px';
  const r=stage.getBoundingClientRect();let w=el.offsetWidth,h=el.offsetHeight;const roomL=r.left-12,roomR=innerWidth-r.right-12;
  if(Math.max(roomL,roomR)<w){el.classList.add('slim');w=el.offsetWidth;h=el.offsetHeight;}
  if(Math.max(roomL,roomR)<w){el.style.visibility='';el.hidden=true;return;}
  const left=roomL>=w?r.left-8-w:r.right+8,top=Math.max(8,Math.min(innerHeight-h-8,r.top));el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';el.style.visibility='';}
addEventListener('resize',()=>placeTry());
function showTry(r){if(!hintsOn()||mode!=='free'||!r||tool==='eraser'||tool==='pop')return;const sw=suggestFor(r),el=$('#tryrow');el.classList.remove('natural');el.querySelector('b').textContent='Try';
  el.querySelector('.tsw').innerHTML=sw.map((h,i)=>`<button style="background:${h}" data-c="${h}" title="${i===0&&S.num[r]?'From the color guide':colorName(h)}">${i===0&&S.num[r]?'<i>★</i>':''}</button>`).join('');
  el.querySelectorAll('.tsw button').forEach(b=>b.onclick=e=>{e.stopPropagation();pickColor(b.dataset.c);el.hidden=true;});
  el.hidden=false;placeTry();clearTimeout(tryT);tryT=setTimeout(()=>el.hidden=true,8000);}
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
  el.hidden=false;el.dataset.r=r;placeTry();clearTimeout(tryT);tryT=setTimeout(()=>el.hidden=true,6000);}
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
const EFFECT={fur:'Fur & Hair · strands that follow your stroke',wood:'Wood · flat color with a fine wood grain',brick:'Brick · small bricks with mortar lines',stone:'Stone · a subtle stone surface',flower:'Flowers · a tiny flower print',lightning:'Lightning · neon glow with white-hot flashes',metal:'Metallic · polished shine that sweeps over the shape',chrome:'Chrome · mirror shine that follows your tilt',glitter:'Glitter · twinkling sparkles',
  jewel:'Jewel · faceted glints and shimmer',neon:'Neon · bright glowing edge',glow:'Glowing · soft lantern light',pulse:'Pulse · breathing, living color',ramp:'Gradient · colors flow along the stroke',
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
  host.addEventListener('pointerup',e=>{clearTimeout(lp);const el=target(e);if(el&&e.pointerType!=='mouse'&&cur!==el){show(el);const me=el;setTimeout(()=>{if(cur===me)hide();},1400);}});   /* v13: a tap shows the name briefly too */host.addEventListener('pointercancel',()=>clearTimeout(lp));host.addEventListener('scroll',hide,{passive:true});
  // the custom tip replaces the slow native title tooltip
  new MutationObserver(()=>{$$('#freerow .pencil[title],#numrow .sw[title]').forEach(b=>{b.setAttribute('aria-label',b.title);b.removeAttribute('title');});}).observe(host,{childList:true,subtree:true});})();
function adjacency(st=S){if(st.adj)return st.adj;const S=st;const A=Array.from({length:S.N},()=>new Set()),L=S.lab;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,a=L[i];if(x<W-1&&L[i+1]!==a){A[a].add(L[i+1]);A[L[i+1]].add(a);}if(y<H-1&&L[i+W]!==a){A[a].add(L[i+W]);A[L[i+W]].add(a);}}
  return S.adj=A;}
function helperAfterColor(r){if(mode!=='free'||!S||!r)return;S.rc=S.rc||{};
  if(tool==='eraser'){delete S.rc[r];return;} if(tool==='pop'&&settings.ppColor===false)return; S.rc[r]=ink.hex.toLowerCase();
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
$('#showPop').onclick=()=>{$('#showcase').hidden=true;setMode('free');if(toolSet==='3d')setTool('pop');else want3DTools(()=>setTool('pop'));toast(Effects3D.unlocked()?'Tap an area to pop it':`Tap an area to pop it · ${Trials.popsLeft()} free tries`);};
$('#showSets').onclick=()=>{$('#showcase').hidden=true;setMode('free');setIdx=SETI.chrome-1;flipSet(1);};
setTimeout(()=>renderShowcase(),1200);

/* ---------- actions ---------- */
function undo(){
  if(S.linesHist&&S.linesHist.length&&S.linesHist[S.linesHist.length-1].t>=lastPaintT())return undoLines();
  {const l=S.ltrUndo&&S.ltrUndo[S.ltrUndo.length-1];if(l){const f=S.free.undo[S.free.undo.length-1],c=S.cbn.hist[S.cbn.hist.length-1],pt=mode==='free'?(f&&f.t||0):(c&&c.t||0);if(l.t>=pt)return ltUndo();}}
  if(mode==='cbn'){const c=S.cbn,b=c.hist.pop();if(!b)return;
    for(const r of b){c.filled[r]=0;paintRegion(r,[0,0,0],0);if(S.tgt[r]){c.doneT[S.num[r]]--;c.done--;}}
    c.complete=false;highlight();drawNums();progress();dirty('cbn');fxClip();}
  else{const u=S.free.undo.pop(),n=u&&u.id;if(u){S.lastOp=null;if($('#adjust')&&!$('#adjust').hidden){setTimeout(adjBuild,0);}adjFlash();unsnap(u);dirty('free');
    while(S.fxUndo&&S.fxUndo.length&&S.fxUndo[S.fxUndo.length-1].n===n){for(const [r,c,pc,ox,oy] of S.fxUndo.pop().m){if(!c){r.mx.clearRect(0,0,W,H);}else if(ox!=null){r.mx.clearRect(ox,oy,c.width,c.height);r.mx.drawImage(c,ox,oy);}else{r.mx.clearRect(0,0,W,H);r.mx.drawImage(c,0,0);}r.dirty=true;if(pc!==undefined)phRestore(r,pc);if(!(S.fx||[]).includes(r))S.fx.push(r);}}
    fxClip();}}
}
let armT=0;
function clearAll(){const b=$('#clear');
  if(!b.classList.contains('arm')){b.classList.add('arm');b.querySelector('span').textContent='Tap again';clearTimeout(armT);
    armT=setTimeout(()=>{b.classList.remove('arm');b.querySelector('span').textContent='Clear';},2500);return;}
  b.classList.remove('arm');b.querySelector('span').textContent='Clear';
  if(mode==='cbn'){const c=S.cbn;c.filled.fill(0);c.doneT.fill(0);c.done=0;c.hist=[];c.complete=false;c.img.data.fill(0);c.ctx.clearRect(0,0,W,H);
    selNum=1;markColor();highlight();drawNums();progress();dirty('cbn');S.fx.length=0;if(S.fxC)S.fxC.getContext('2d').clearRect(0,0,W,H);dirty('fx');}
  if(S.ltr){ltSnap();S.ltr.getContext('2d').clearRect(0,0,W,H);dirty('ltr');ltRender();}
  if(mode==='free'){snap();S.free.ctx.clearRect(0,0,W,H);S.rc={};if(S.pulse){S.pulse.ctx.clearRect(0,0,W,H);dirty('pulse');}S.fx.length=0;if(S.fxC)S.fxC.getContext('2d').clearRect(0,0,W,H);dirty('fx');dirty('free');}
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
  if(m===mode&&S.fx&&S.fx.length){fxDraw(performance.now());x.drawImage(S.fxC,0,0);}
  drawLinesTo(x);if(S.ltr)x.drawImage(S.ltr,0,0);return c;}
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
$$('.tool').forEach(b=>b.onclick=()=>{const t=b.dataset.tool;setTool(isEr(t)&&tool===t?backTool():t);});   /* v20: Eraser is a toggle: tap it again to go back */
{const bk=$('#ctxBack');if(bk)bk.onclick=()=>setTool(backTool());
 const pb=$('#palbody');if(pb)pb.addEventListener('click',e=>{if(isEr(tool)&&e.target.closest('button'))setTool(backTool());},true);}   /* tapping any pencil or color leaves the eraser */
{const to=$('#toolopts');if(to){const a=$('#tools .popswwrap'),b=$('#tools .popctl');if(a)to.appendChild(a);if(b)to.appendChild(b);}ctxBar(tool,false);}   /* v16: pop options live in the tool bar row */
/* v20: size slider with a live preview dot, the number, and quick preset dots */
function sizeUI(){try{sizeUI0();}catch(e){}try{phSync();}catch(e){}}
function sizeUI0(){const r=$('#szRange');if(!r)return;if(document.activeElement!==r)r.value=penSize;$('#szNum').textContent=penSize;
  const er=tool==='eraser',d=$('#szDot'),px=Math.max(2,Math.min(40,(er?eraR()*2:penSize)*.62+1));d.style.width=d.style.height=px+'px';
  d.style.background=er?'transparent':(ink&&ink.hex)||color;d.style.boxShadow=er?'inset 0 0 0 1.5px #ffe2bd':'';$('#sizebox')&&$('#sizebox').classList.toggle('er',er);
  r.style.setProperty('--p',((penSize-1)/59*100)+'%');$$('.szp').forEach(b=>b.classList.toggle('on',+b.dataset.v===penSize));}
function setPenSize(v){penSize=Math.max(1,Math.min(60,Math.round(+v)||13));settings.penSize=penSize;clearTimeout(setPenSize.t);setPenSize.t=setTimeout(()=>LS.set('settings',settings),300);sizeUI();}
{const r=$('#szRange');if(r)r.oninput=e=>setPenSize(e.target.value);$$('.szp').forEach(b=>{b.querySelector('i').style.width=b.querySelector('i').style.height=Math.max(3,Math.min(18,+b.dataset.v*.4+2))+'px';b.onclick=()=>setPenSize(b.dataset.v);});sizeUI();}
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
function want3DTools(after){if(!S)return;needDepth(S.n).then(()=>{if(!depthOf(S)){toast('3D isn\'t available on this page yet · staying in 2D');return;}
  if(!allowed3D(S.n)){openUpgrade(null,'effects3d');return;}enableTilt();if(!D3.on){D3.want=true;D3.fresh=false;apply3D(true);}setToolSet('3d');if(after)after();});}
$('#btn2d').onclick=()=>setToolSet('2d');$('#btn3d').onclick=()=>{if(toolSet!=='3d')want3DTools();};
$('#bandBtn').onclick=()=>{if(!D3.on)return;enableTilt();bandView(!D3.band);};$('#bandv').onclick=()=>bandView(false);
$('#ppColor').setAttribute('aria-pressed',String(settings.ppColor!==false));
$('#ppColor').onclick=()=>{settings.ppColor=settings.ppColor===false;LS.set('settings',settings);$('#ppColor').setAttribute('aria-pressed',String(settings.ppColor!==false));toast(settings.ppColor!==false?'Color while popping: on (uses your current pencil)':'Color while popping: off (only raises / insets)');};
numBox($('#ppHn'),-1,1,v=>{const e=$('#ppH');e.value=Math.round(v*100);e.oninput({target:e});});
$('#ppH').oninput=e=>{setPopH(+e.target.value/100);if(tool!=='pop'&&tool!=='poppencil'&&tool!=='poperase')setTool(S&&S.popSel&&S.popSel.k==='pop'?'pop':'poppencil');applySelHeight(popH());};
$('#ppH').onchange=()=>{const v=popH();toast(v>0?'Pop height: raise':v<0?'Pop height: inset':'Pop height: flat · the Pop Pencil smooths areas back to the page');};
$('#popMode').onclick=e=>{const v=e.target&&e.target.dataset&&e.target.dataset.v;POP.pressed=v?v==='inset':!POP.pressed;POP.flat=false;if(!POP.hv)POP.hv=.6;settings.popH=popH();if(tool!=='pop'&&tool!=='poppencil'&&mode==='free')setTool('poppencil');   // simple switch: Raise <-> Inset (Pop Erase flattens)
  settings.popMode=POP.pressed?'inset':'raised';LS.set('settings',settings);popUI();popRestyle();toast(POP.pressed?'Inset: press areas into the page':'Raise: lift areas off the page');};
$('#idea3d').onclick=()=>idea3d();$('#idea3dApply').onclick=idea3dApply;
/* v20: Mix opens as an overlay on the bottom section only (same footprint as the pencil and tool boxes; the picture never moves).
   Accept keeps the mix and returns to the bar; Cancel puts everything back as it was */
let mixPrev=null;
function openMix(){adjClose();mixPrev={on:MIX.on,finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:{...MIX.amt}};$('#mxOff').hidden=!MIX.on;if(MIX.on){buildMixer();$('#mixer').hidden=false;}else setMix(true);}
function adjOpen(){const el=$('#adjust');if(!el)return;if(!$('#mixer').hidden)mixCancel&&mixCancel();el.hidden=false;$('#adjBtn')&&$('#adjBtn').classList.add('on');adjBuild();adjFlash();}
function adjClose(){const el=$('#adjust');if(el)el.hidden=true;$('#adjBtn')&&$('#adjBtn').classList.remove('on');if(phP==='adjust'){phP=null;app.dataset.ph='';phSync();}}
function adjBuild(){const el=$('#adjRows');if(!el)return;const L=S&&S.lastOp,a=L?L.a:{},fmt=(d,v)=>(d[0]==='h'||d[0]==='b'||d[0]==='w')&&v>0?'+'+v+d[6]:v+d[6];
  el.innerHTML=ADJDEF.map(d=>{const v=adjVal(a,d[0]);return `<label class="adjr" title="${esc(d[7])}"><span>${d[1]}</span><input type="range" data-k="${d[0]}" min="${d[2]}" max="${d[3]}" step="${d[5]}" value="${v}" aria-label="${esc(d[1])}"${L?'':' disabled'}><em>${fmt(d,v)}</em></label>`;}).join('');
  $('#adjust').classList.toggle('empty',!L);$('#adjReset').disabled=!L;
  const sw=()=>{const A=$('#adjAfter'),Bf=$('#adjBefore');if(!L){Bf.style.background='transparent';A.style.background='transparent';A.style.opacity=1;A.style.boxShadow='';$('#adjName').textContent='Draw a stroke or fill first, then adjust it here';return;}
    const oa=opAdj(),hx=opHex(L,oa);Bf.style.background=L.hex;A.style.background=hx;A.style.opacity=adjVal(L.a,'o')/100;A.style.boxShadow=adjVal(L.a,'g')>0?`0 0 ${4+adjVal(L.a,'g')*.14}px ${hx}`:'';
    $('#adjName').textContent=L.name+(L.kind==='fill'?' · fill':' · stroke')+(oa?' · adjusted':'');};sw();
  el.querySelectorAll('input').forEach(i=>i.oninput=()=>{if(!S.lastOp)return;S.lastOp.a[i.dataset.k]=+i.value;adjCarry={...S.lastOp.a};LS.set('adjCarry',adjCarry);const d=ADJDEF.find(q=>q[0]===i.dataset.k);i.nextElementSibling.textContent=fmt(d,+i.value);sw();lastOpRenderSoon();});}
function adjReset(){adjCarry={};LS.set('adjCarry',adjCarry);if(S&&S.lastOp){S.lastOp.a={};lastOpRender();}adjBuild();adjFlash();}
(function(){const b=$('#adjBtn');if(!b)return;b.onclick=e=>{e.stopPropagation();$('#adjust').hidden?adjOpen():adjClose();};$('#adjX').onclick=adjClose;$('#adjDone').onclick=adjClose;$('#adjReset').onclick=adjReset;
  ['pointerdown','click'].forEach(ev=>$('#adjust').addEventListener(ev,e=>e.stopPropagation()));})();
function closeMix(){$('#mixer').hidden=true;mixPrev=null;if(phP==='mix'){phP=null;app.dataset.ph='';phSync();}}
function mixAccept(){closeMix();buildPalette();toast('Mix on · color with your pencils');}
function mixCancel(){const p=mixPrev;closeMix();if(!p)return;const live=['finish','anim','part'].filter(k=>(MIX.amt[k]||1)!==((p.amt||{})[k]||1));MIX.finish=p.finish;MIX.anim=p.anim;MIX.part=p.part;if(p.amt){MIX.amt={...p.amt};live.forEach(mixAmtLive);}LS.set('mix',{finish:MIX.finish,anim:MIX.anim,part:MIX.part,amt:MIX.amt,sel:MIX.sel});
  if(!p.on)setMix(false);else{mixInk();setInkPattern();markColor();}}
$('#mixBtn').onclick=openMix;
/* v20 phone (<=600px): slim top bar (Menu, Undo, Pen size) and a slim bottom strip of tabs. Each tab opens ONE small panel
   (Colors, Tools, Effects, Lines, Mix) over the lower part of the picture; it stays open while you test strokes, and the same tab
   or ✕ Close collapses it. The picture never resizes. */
var phP=null;
function phSync(){const sw=$('#pbSw');if(!sw)return;sw.style.background=(ink&&ink.kind==='plain'?ink.hex:(ink&&ink.hex))||color;
  const t=$('#toolbox .tool.on');$('#pbTool').innerHTML=t?t.querySelector('svg').outerHTML:'';
  $$('#pbar .pbt').forEach(b=>{const on=b.dataset.p===phP;b.classList.toggle('on',on);b.setAttribute('aria-expanded',String(on));});
  $$('#pbar .pbdb').forEach(b=>b.classList.toggle('on',b.dataset.d===toolSet));}
function phSet(p){if(p===phP)p=null;const prev=phP;phP=p;
  if(prev==='mix'&&p!=='mix'&&!$('#mixer').hidden)mixAccept();
  if(prev==='lines'&&p!=='lines'){$('#linesPop').hidden=true;$('#linesBtn').setAttribute('aria-expanded','false');}
  app.dataset.ph=p||'';
  if(p==='lines'){$('#linesPop').hidden=false;$('#linesBtn').setAttribute('aria-expanded','true');linesUI();}
  if(p==='mix'&&$('#mixer').hidden)openMix();
  phSync();}
$$('#pbar .pbt').forEach(b=>b.onclick=()=>phSet(b.dataset.p));
$$('#pbar .pbdb').forEach(b=>b.onclick=()=>{$(b.dataset.d==='2d'?'#btn2d':'#btn3d').click();setTimeout(phSync,0);});
$('#phClose').onclick=()=>phSet(null);
{const mb=$('#menuBtn'),setMenu=on=>{app.classList.toggle('ph-menu',on);mb.setAttribute('aria-expanded',String(on));if(on){phSet(null);app.style.setProperty('--tmh',$('#tools').offsetHeight+'px');}};
  mb.onclick=()=>setMenu(!app.classList.contains('ph-menu'));
  $('#stagewrap').addEventListener('pointerdown',()=>{if(app.classList.contains('ph-menu'))setMenu(false);},true);
  $$('#tools .grp:not(.right) .big, #clear, #startOver, #save, #saveLoop, #scenes, #modes, #mapBtn, #setBtn').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>setMenu(false),60)));
  matchMedia('(max-width:600px)').addEventListener('change',e=>{if(!e.matches){setMenu(false);phSet(null);}});}
phSync();$('#mxOk').onclick=mixAccept;$('#mxCancel').onclick=mixCancel;$('#mixer .mxx').onclick=mixCancel;
$('#mxOff').onclick=()=>{closeMix();setMix(false);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#mixer').hidden)mixCancel();});
$('#chromeBtn').onclick=()=>{settings.chromeFinish=!settings.chromeFinish;LS.set('settings',settings);if(MIX.on)setMix(false);if(ink.kind==='plain'||ink.id==='c-any')pickColor(color);else markColor();toast(settings.chromeFinish?'Chrome finish on · every color you pick is chrome':'Chrome finish off');};$('#mixer .mxx').onclick=()=>setMix(false);
$('#ownUnlock').onclick=()=>{Object.values(ENT).forEach(e=>e.grant('owner-test'));ownerBar();toast('Owner test: everything unlocked on this device');};
$('#ownRelock').onclick=()=>{Object.values(ENT).forEach(e=>e.revoke());try{localStorage.removeItem('ep.trials.v1');}catch(e){}ownerBar();buildPalette();toast('Re-locked: testing as a buyer (free tries reset)');};
/* ---------- Show ideas (Free Color, optional): empty areas softly pulse a suggested colour. ‹ › switch idea sets
   (the scene's colour guide, then the palettes). Never locks anything; an area you colour stops pulsing. ---------- */
const IDEAS={on:settings.showIdeas===true,set:+settings.ideaSet||0};
function ideaSets(){return [{name:'Color guide',pal:S.pal}].concat(THEMES.map(t=>{const cs=t.colors.map(hex2rgb),lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
  const order=S.pal.map((c,i)=>[lum(c),i]).sort((a,b)=>a[0]-b[0]),th=cs.slice().sort((a,b)=>lum(a)-lum(b)),pal=[];
  order.forEach(([,i],k)=>pal[i]=th[Math.min(th.length-1,Math.round(k*(th.length-1)/Math.max(1,order.length-1)))]);return {name:t.name,pal};}));}
function renderIdeas(){const c=$('#ideasC'),bar=$('#ideasbar');if(!c||!S)return;bar.classList.toggle('on',IDEAS.on);$('#ideasTog').setAttribute('aria-pressed',String(IDEAS.on));
  if(!IDEAS.on||mode!=='free'){c.hidden=true;return;}const sets=ideaSets();IDEAS.set=((IDEAS.set%sets.length)+sets.length)%sets.length;const st=sets[IDEAS.set];$('#ideasName').textContent=st.name;$('#ideasName').title=st.name;
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
$('#undo').onclick=undo;$('#clear').onclick=clearAll;
/* v12: Start over = the whole page back to blank (both modes, effects, pops, Pop Pencil, 3D flattening, line settings) and its autosaves removed */
$('#startOver').onclick=()=>{if(!S)return;$('#soDlg').hidden=false;$('#soCancel').focus();};
$('#soCancel').onclick=()=>{$('#soDlg').hidden=true;};
$('#soDlg').onclick=e=>{if(e.target.id==='soDlg')$('#soDlg').hidden=true;};
$('#soGo').onclick=async()=>{$('#soDlg').hidden=true;await startOver();};
async function startOver(){if(!S)return;const n=S.n;clearTimeout(saveT);delete pend[n];delete pend[String(n)];
  idbGen[n]=(idbGen[n]||0)+1;for(const k of SCENE_KEYS)LS.del(k+'.'+n);await IDB.del(n);delete idbLast[n];
  if(pps)pps=null;if(D3.band)bandView(false);delete cache[n];S=null;await showScene(n);
  for(const k of SCENE_KEYS)LS.del(k+'.'+n);delete pend[n];delete pend[String(n)];   // nothing from the old page gets written back
  buildScenes();toast('Started over · this page is blank again');return true;}$('#save').onclick=save;
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
    if(p.ltr&&st.ltr){let any=false;const d=st.ltr.getContext('2d').getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=16)if(d[i]){any=true;break;}any?LS.set('ltr.'+k,st.ltr.toDataURL('image/png')):LS.del('ltr.'+k);}
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
  const lt=LS.get('ltr.'+st.n,null);if(lt){try{const im=await loadImg(lt);ltrOf(st).getContext('2d').drawImage(im,0,0);}catch(e){}}
  const pu=LS.get('pulse.'+st.n,null);
  if(pu){try{const im=await loadImg(pu);const c=mk();c.className='pulse-layer';st.pulse={c,ctx:c.getContext('2d',{willReadFrequently:true})};st.pulse.ctx.drawImage(im,0,0);st.pulseUsed=true;}catch(e){}}
  st.pops=LS.get('pop.'+st.n,[]);st.rc=LS.get('rc.'+st.n,{});st.flat3d=LS.get('flat3d.'+st.n,[]);st.lines=LS.get('lines.'+st.n,null);
  await loadFx(st); await loadPP(st);
}
/* ---------- autosave: each scene's work (colours, effect layers, pop / inset heights, Pop Pencil, line settings) is also kept
   in IndexedDB with a versioned format and the last 3 snapshots per scene, so an app update or a full localStorage never
   loses work. localStorage stays the fast path; IndexedDB restores anything missing on start. ---------- */
const SAVE_FORMAT=2,SCENE_KEYS=['cbn','free','pulse','pop','rc','flat3d','fx','cfx','pp','thumb','lines','ltr'];
const IDB={db:null,ready:null,
  open(){if(this.ready)return this.ready;this.ready=new Promise(res=>{try{const q=indexedDB.open('emberpost-save',1);
    q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('scenes'))db.createObjectStore('scenes',{keyPath:'n'});};
    q.onsuccess=()=>{this.db=q.result;res(this.db);};q.onerror=()=>res(null);q.onblocked=()=>res(null);}catch(e){res(null);}});return this.ready;},
  async all(){const db=await this.open();if(!db)return [];return new Promise(res=>{try{const q=db.transaction('scenes').objectStore('scenes').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([]);}catch(e){res([]);}});},
  async get(n){const db=await this.open();if(!db)return null;return new Promise(res=>{try{const q=db.transaction('scenes').objectStore('scenes').get(n);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});},
  async put(rec){const db=await this.open();if(!db)return false;return new Promise(res=>{try{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').put(rec);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);}catch(e){res(false);}});},
  async del(n){const db=await this.open();if(!db)return;return new Promise(res=>{try{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').delete(n);tx.oncomplete=tx.onerror=()=>res();}catch(e){res();}});},
  async clear(){const db=await this.open();if(!db)return;return new Promise(res=>{try{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').clear();tx.oncomplete=tx.onerror=()=>res();}catch(e){res();}});}};
function migrateSave(rec){ // older formats -> current. format 1 = the plain localStorage keys (v6 .. v8), kept as-is
  if(!rec||typeof rec!=='object')return null;if(!rec.format)rec.format=1;
  if(!Array.isArray(rec.snaps))rec.snaps=rec.keys?[{t:rec.t||0,build:rec.build||0,keys:rec.keys}]:[];
  rec.snaps=rec.snaps.filter(s=>s&&s.keys&&typeof s.keys==='object');rec.format=SAVE_FORMAT;return rec;}
function sceneKeys(n){const o={};for(const k of SCENE_KEYS){const key='ep.v1.'+k+'.'+n;let v=null;try{v=localStorage.getItem(key);}catch(e){}if(v==null&&key in LSMEM)v=LSMEM[key];if(v!=null)o[k]=v;}return o;}
const idbLast={};
const idbGen={};
async function idbSave(n,force){const gen=idbGen[n]||0,keys=sceneKeys(n),sig=Object.keys(keys).map(k=>k+':'+keys[k].length+':'+keys[k].slice(-48)).join('|');
  if(!force&&idbLast[n]===sig)return false;const rec=migrateSave(await IDB.get(n))||{n,format:SAVE_FORMAT,snaps:[]};
  if(rec.snaps[0]&&rec.snaps[0].sig===sig){idbLast[n]=sig;return false;}
  rec.snaps.unshift({t:Date.now(),build:EP_BUILD,sig,keys});rec.snaps=rec.snaps.slice(0,3);rec.n=n;rec.t=Date.now();rec.build=EP_BUILD;
  if((idbGen[n]||0)!==gen)return false;   // the page was started over meanwhile
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
  const c=CHM[n];$('#rvKicker').textContent=`${chName(n)} · colored`;$('#rvTitle').textContent=c.title;$('#rvStory').textContent=c.story;
  $('#rvUnlock').hidden=!next;$('#rvUnlock').classList.toggle('fresh',fresh);
  if(next){$('#rvNextImg').src=thumbOf(next.n);$('#rvNextTitle').textContent=`${chName(next.n)} · ${next.title}`;$('#rvNextTeaser').textContent=next.teaser;
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
    e.innerHTML=`<div class="th">${th}${(lk||!play)?LOCK:''}${dn?'<i class="ok">✓</i>':''}</div><div class="tx"><small>${chName(c.n)} · ${state}</small><b>${esc(c.title)}</b>${lk?`<span>${esc(c.teaser)}</span>`:''}</div>`;
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
    sub:'Metallic sheen, mirror chrome, sparkling glitter, glowing neon, white-hot lightning and lantern glow, breathing pulse colors, plus a soft airbrush and a watercolor wash. They work with the pencil, the fill tool and saved pictures.',
    list:[['5 jewels','ruby, emerald, sapphire, amethyst, topaz with a living shimmer'],['5 metallics','gold, silver, copper, rose gold, bronze'],['12 chromes','live mirror shimmer, plus a Chrome finish for any color'],['6 glitters','with real sparkle'],['Wood, brick, stone, flowers','flat color with a subtle, small texture, any color'],['Fur & hair','short / long fur, straight / wavy / curly hair that follows your stroke'],['9 lightnings','neon glow with white-hot flashes, any color'],['5 neons + 5 Glowing','outer glow and soft light halos'],['5 pulse colors','gently breathe in the app'],['2 brushes','soft airbrush and watercolor wash']]},
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
    if(from&&(key==='pencils'||key==='all')){pickPremium(from);}
    toast((key==='all'?'Everything':ENT[key].P.productName)+' unlocked ✦');},1500);}
for(const key of ['pencils','palettes','effects3d','smoke','clouds','gradients']){const row=$(`#set_${key}`);if(row&&!row.querySelector('canvas')){const cv=pvCanvas('rowpv',150,40);row.insertBefore(cv,row.querySelector('b'));productPreview(cv,key);}}
$('#setRedeem').onclick=async()=>{const r=await redeemCode($('#setCode').value,'pencils'),m=$('#setMsg');m.textContent=r.msg;m.className='up-msg '+(r.ok?'ok':'bad');
  if(r.ok){$('#setCode').value='';refreshPremiumUI();toast((r.key==='all'?'Everything':ENT[r.key].P.productName)+' unlocked ✦');}};
$('#setCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#setRedeem').click();});
for(const key of ['pencils','palettes','effects3d','smoke','clouds','gradients'])$(`#set_${key}`).onclick=()=>{const e=ENT[key];
  if(e.unlocked()){e.revoke();toast(e.P.productName+' locked again (demo)');}else{$('#settings').hidden=true;openUpgrade(null,key);}};

/* ---------- test / debug hooks (read-only helpers) ---------- */
window.EP={
  setsInfo:()=>SETS.map(s=>({id:s.id,name:s.name,product:s.product,type:s.type,colors:s.type==='plain'?s.colors:s.items.map(p=>p.kind==='brush'?[p.name,'']:[p.name,p.hex]),unlocked:s.product?ENT[s.product].unlocked():true})),mixAmtLive:(k)=>mixAmtLive(k),
  freeAt:(x,y)=>[...S.free.ctx.getImageData(x|0,y|0,1,1).data],setFxs:(k,v)=>setFxs(k,v),ink:()=>({...ink}),linesC:()=>S&&linesOf(S).c,adj:()=>{const L=S&&S.lastOp;return L?{kind:L.kind,a:{...L.a},hex:L.hex,adjHex:opHex(L,opAdj()),bb:[L.bx,L.by,L.bw,L.bh],px:L.M.reduce((p,v)=>p+v,0),recs:L.recs.map(q=>[q[0].kind,q[0].hex])}:null;},parts:()=>(S.fx||[]).map(r=>[r.kind,r.parts.length,r.amt||1]),fxKeys:()=>fxKeysFor(SETS[setIdx]),fxFilter:()=>S&&S.fxC&&S.fxC.style.filter,
  ctx:()=>({ctx:app.dataset.ctx,tag:($('#ctxtag')||{}).textContent,mem:Object.fromEntries(Object.entries(TMEM).map(([k,v])=>[k,{hex:v.ink.hex,id:v.ink.id||null,set:SETS[v.setIdx].id,tool:v.tool}]))}),
  pickGuide:k=>pickNum(k),
  texVariant:(k,h)=>texVariant(k,h),furStyle:()=>furStyle,furAt:(x,y)=>{const d=(furC||mk()).getContext('2d').getImageData(x|0,y|0,1,1).data;return [d[0],d[1],d[2],d[3]];},
  compCrop:(x,y,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(composite(),x,y,w,h,0,0,w,h);return c.toDataURL('image/png');},
  texAt:(k,h,x,y)=>{const D=texTile(k,texVariant(k,h),hex2rgb(h),true).data,j=(Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x)))*4;return [D[j],D[j+1],D[j+2]];},
  fxDrawNow:()=>fxDraw(performance.now()),fxDrawAt:(ms)=>fxDraw(ms),
  boltI:(t)=>boltI(t),bolt:()=>(S.fx||[]).filter(r=>r.kind==='boltfx').map(r=>({hex:r.hex,I:r.lastI||0,off:r.bolt?r.bolt.off:null})),boltClock:(t)=>{if(t==null){BFIX=false;return CLK.boltSpeed;}BFIX=true;CLK.boltSpeed=t;fxDraw(performance.now());return t;},openUpgrade:(k)=>openUpgrade(null,k),fxSets:(k)=>SETS.filter(q=>q.product===k&&q.type==='ink').map(q=>q.name),
clk:()=>Object.assign({chrome:CCLK,pulse:PCLK},CLK),
  fxHexes:()=>(S.fx||[]).map(r=>[r.kind,r.hex]),
  chromeClock:(t)=>{if(t==null){CFIX=false;return CCLK;}CFIX=true;CCLK=t;fxDraw(performance.now());return CCLK;},
  fxNoLight:(norm)=>{(S&&S.fx||[]).forEach(r=>{r.light=null;if(norm){r.sp=1;r.ph=0;}});fxDraw(performance.now());return true;},   /* tests: measure the glint on its own */
  fxParams:()=>(S&&S.fx||[]).map(r=>({kind:r.kind,hex:r.hex,seed:r.seed,ph:r.ph,dir:r.dir,light:r.light,sp:r.sp,bb:r.bb,amt:r.amt||1})),
  chromePhaseAt:(x,y,hex)=>{for(const r of (S.fx||[])){if(r.kind!=='mirror'||(hex&&r.hex!==hex)||!r.phC)continue;const d=r.phX.getImageData((x/MQ)|0,(y/MQ)|0,1,1).data;if(d[3]>=128)return d[0]/255;}return null;},   /* v16: one record per stroke, so look through all of them */
  fxLum:(pts)=>{const x=S.fxC.getContext('2d');return pts.map(([a,b])=>{const d=x.getImageData(a|0,b|0,1,1).data;return d[3]?(d[0]+d[1]+d[2])/3*d[3]/255:0;});},
  selHeight:()=>selHeight(),popSel:()=>S&&S.popSel,
  isInk:(x,y)=>isInk(x,y),
  ltr:()=>{const mm=ltMask(),d=S.ltr?S.ltr.getContext('2d').getImageData(0,0,W,H).data:null;let n=0,out=0;if(d)for(let i=0;i<W*H;i++)if(d[i*4+3]){n++;if(!mm.M[i])out++;}return {on:LT.on,painted:n,outside:out,undo:(S.ltrUndo||[]).length,saved:!!LS.get('ltr.'+S.n,null)};},
  ltrAt:(x,y)=>{if(!S.ltr)return null;const d=S.ltr.getContext('2d').getImageData(x|0,y|0,1,1).data;return [...d];},inkAt:(x,y)=>{const mm=ltMask();return mm?mm.M[(y|0)*W+(x|0)]:null;},
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
  grab:()=>({mode:grabMode(),auto:GRAB.auto,hand:handOn(),rule:settings.grabRule||'in-draw',cls:stage.classList.contains('handmode')}),
  inkTileBig:(k,h)=>inkTile(k,h,null,true),
  fillAll:()=>{let n=0;for(let r=1;r<S.N;r++){if(S.off[r+1]>S.off[r]){const i=S.pix[S.off[r]];if(mode==='cbn')continue;fillFree(i%W,(i/W)|0);n++;}}return n;},
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
  compSnap:()=>{EP._cs=composite().getContext('2d').getImageData(0,0,W,H).data;return true;},
  _od:{},compDiff:(rs)=>{const A=EP._cs,B=composite().getContext('2d').getImageData(0,0,W,H).data,set=new Set(rs);let inside=0,outside=0,maxOut=0;
    for(let i=0;i<W*H;i++){const j=i*4,d=Math.abs(A[j]-B[j])+Math.abs(A[j+1]-B[j+1])+Math.abs(A[j+2]-B[j+2]);if(!d)continue;if(set.has(S.lab[i]))inside++;else{outside++;if(d>maxOut)maxOut=d;const q=S.lab[i];EP._od[q]=(EP._od[q]||0)+1;}}const o={inside,outside,maxOut};if(outside)o.where=Object.entries(EP._od).sort((a,b)=>b[1]-a[1]).slice(0,4);EP._od={};return o;},
  popLayersOutside:(rs)=>{const set=new Set(rs),o={};for(const [k,c] of [['ppSh',S.pp&&S.pp.sh],['ppLi',S.pp&&S.pp.li],['popSh',S.popSh],['popLi',S.popLi]]){if(!c){o[k]=[0,0];continue;}const d=c.getContext('2d').getImageData(0,0,W,H).data;let a=0,b=0;for(let i=0;i<W*H;i++)if(d[i*4+3]){if(set.has(S.lab[i]))a++;else b++;}o[k]=[a,b];}return o;},
  layerOrder:()=>[...layers.children].map(c=>c===S.cbn.c?'cbn':c===S.free.c?'free':c.className||c.tagName),
  popH:()=>popH(), anyColors:()=>anyColors().map(([n,c])=>[n,c.length]),
  composite:()=>composite().toDataURL('image/png').length, compositeAt:(x,y)=>{const d=composite().getContext('2d').getImageData(x|0,y|0,1,1).data;return [d[0],d[1],d[2],d[3]];},
  regionType:r=>regionType(r),
  fillAllOf:(k)=>{for(let r=1;r<S.N;r++)if(S.num[r]===k&&S.tgt[r]&&!S.cbn.filled[r])fillCBN(r);},
};

/* ---------- boot ---------- */
setInkPattern(); buildScenes(); applySettingsUI(); applyFxs(); handleReturn(); ownerBar();
{const go=()=>{const dl=(()=>{try{const q=new URLSearchParams(location.search).get('page');if(!q)return 0;const c=CH.find(c=>c.slug===q||String(c.n)===q);return c&&IDS.includes(c.n)&&isUnlocked(c.n)?c.n:0;}catch(e){return 0;}})();   /* v16: deep link ?page=ninja-kat (or ?page=<chapter number>) */
  const start=dl||((prog.current&&isUnlocked(prog.current)&&IDS.includes(prog.current))?prog.current:IDS[0]);
 if(start)showScene(start); else $('#scap').textContent='No scene data found.';};
 Promise.race([idbHydrate().catch(()=>0),new Promise(r=>setTimeout(r,1500))]).then(go);}
window.EP_OK=true;try{sessionStorage.removeItem('ep.heal');}catch(e){}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadCtl||reloaded)return;reloaded=true;   // a new release took over: reload once so page + scripts match
    if(!S||!(S.free&&S.free.undo&&S.free.undo.length))location.reload();else toast('App updated · it will use the new version next time you open it');});
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update().catch(()=>0)).catch(err=>console.warn('SW not registered',err)));
  /* v22: an app left open (phone tab, home-screen app) checks for a newer build whenever it comes back to the front and every 20 min;
     work is autosaved first, then the page reloads onto the new build */
  let lastChk=0,ptrDown=false;addEventListener('pointerdown',()=>ptrDown=true,true);addEventListener('pointerup',()=>ptrDown=false,true);addEventListener('pointercancel',()=>ptrDown=false,true);const chk=()=>{if(document.hidden||Date.now()-lastChk<60000)return;lastChk=Date.now();navigator.serviceWorker.getRegistration().then(r=>r&&r.update().catch(()=>0)).catch(()=>0);
    fetch('index.html?bc='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(t=>{const m=/EP_BUILD_HTML=(\d+)/.exec(t||'');if(m&&+m[1]>EP_BUILD&&!ptrDown){try{saveNow();}catch(e){}const u=new URL(location.href);u.searchParams.set('_r',Date.now().toString(36));setTimeout(()=>location.replace(u.toString()),300);}}).catch(()=>0);};
  document.addEventListener('visibilitychange',chk);setInterval(chk,20*60000);}
})();
