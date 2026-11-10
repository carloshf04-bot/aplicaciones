// La Gaceta · funciona sin conexión una vez instalada.
// Primero intenta la red (para recibir actualizaciones) y, si no hay, usa la copia guardada.
const V = "gaceta-v5";
const FILES = [
  "./", "index.html", "app.js", "sync.js", "firebase-config.js", "manifest.webmanifest",
  "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "fonts/fonts.css", "fonts/PlayfairDisplay-normal.woff2", "fonts/PlayfairDisplay-italic.woff2",
  "fonts/Lora-normal.woff2", "fonts/Lora-italic.woff2", "fonts/UnifrakturMaguntia-normal.woff2"
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("index.html")))
  );
});
