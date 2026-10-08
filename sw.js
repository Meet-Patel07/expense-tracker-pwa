// Bump VERSION on every deploy so users receive the update.
const VERSION='v1';
const CACHE='ex-'+VERSION;
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('index.html')));return}
  e.respondWith(caches.match(r).then(hit=>{
    const net=fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res}).catch(()=>hit);
    return hit||net;
  }));
});
