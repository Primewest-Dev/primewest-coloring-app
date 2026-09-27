/* Ember Post coloring – offline cache (cache-first). Only used when served over http(s).
   The chapter list (data/story.js) decides which scene files get cached, so new chapters need no edit here. */
const CACHE='emberpost-coloring-v3';
let SCENE_FILES=[];
try{importScripts('data/story.js');SCENE_FILES=(self.EP_STORY.chapters||[]).filter(c=>c.data).map(c=>'./'+c.data);}catch(e){}
const ASSETS=['./','./index.html','./app.css','./app.js','./fonts.css','./premium-config.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./data/story.js'].concat(SCENE_FILES);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}); return resp;
  }).catch(()=>caches.match('./index.html'))));
});
