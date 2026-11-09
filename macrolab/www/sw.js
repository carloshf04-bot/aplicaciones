// Macrolab · funciona sin conexión cuando se instala en la pantalla de inicio.
// Primero intenta la red (para recibir las actualizaciones) y, si no hay, usa la copia guardada.
const V="macrolab-v1";
const FILES=[
 "./",
 "index.html",
 "purchases.js",
 "manifest.webmanifest",
 "icon.svg",
 "icon-192.png",
 "icon-512.png",
 "apple-touch-icon.png",
 "privacy.html",
 "terms.html",
 "fonts/Archivo-latin-400-900.woff2",
 "fonts/Archivo-latin-ext-400-900.woff2",
 "fonts/IBMPlexMono-latin-400.woff2",
 "fonts/IBMPlexMono-latin-500.woff2",
 "fonts/IBMPlexMono-latin-600.woff2",
 "fonts/IBMPlexMono-latin-ext-400.woff2",
 "fonts/IBMPlexMono-latin-ext-500.woff2",
 "fonts/IBMPlexMono-latin-ext-600.woff2",
 "fonts/fonts.css"
];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res;}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match("index.html"))));
});
