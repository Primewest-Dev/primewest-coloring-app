/* Ember Post coloring – offline cache (network-first for the app, cache as offline fallback). Only used when served over http(s).
   The chapter list (data/story.js) decides which scene files get cached, so new chapters need no edit here. */
const CACHE='emberpost-coloring-v23';
let SCENE_FILES=[];
try{importScripts('data/story.js');const CH=self.EP_STORY.chapters||[];SCENE_FILES=[].concat(CH.filter(c=>c.data).map(c=>'./'+c.data),CH.filter(c=>typeof c.lines==='string').map(c=>'./'+c.lines),CH.filter(c=>c.data).map(c=>'./'+c.data.replace(/\.js$/,'_depth.js')),CH.filter(c=>c.cut&&c.cut.art).map(c=>'./'+c.cut.art));}catch(e){}
const ASSETS=['./','./index.html','./app.css','./app.js','./fonts.css','./premium-config.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./data/story.js'].concat(SCENE_FILES);
self.addEventListener('install',e=>{self.skipWaiting();   // take over right away; files are fetched fresh (bypassing the browser's HTTP cache) so a release is never mixed
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ASSETS.map(u=>fetch(new Request(u,{cache:'reload'})).then(r=>r.ok?c.put(u,r):0).catch(()=>0)))));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting();});
// network-first: always try the server (revalidating, never a stale HTTP copy); fall back to the offline copy
self.addEventListener('fetch',e=>{const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  const nav=req.mode==='navigate';
  e.respondWith(fetch(req,{cache:'no-cache'}).then(resp=>{
      if(resp&&resp.ok&&resp.type==='basic'){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(nav?'./index.html':req,copy)).catch(()=>{});}
      return resp;})
    .catch(()=>caches.match(nav?'./index.html':req,{ignoreSearch:true}).then(r=>r||caches.match(req,{ignoreSearch:true})).then(r=>r||(nav?caches.match('./'):Response.error()))));
});
