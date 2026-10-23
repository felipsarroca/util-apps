/* Atzar a l'aula — service worker: les apps funcionen sense connexió un cop instal·lades.
   Primer es prova la xarxa (sempre la versió més nova) i, si no n'hi ha, es fa servir la còpia desada. */
const CACHE = "atzar-1.9";
const APPS = ["Ruleta", "Sorteig", "Equips", "Temps", "Moneda", "Daus", "Cartes", "Nombres"];
const ASSETS = [
  "./",
  "style.css",
  "script.js",
  "favicon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "shared/atzar.css",
  "shared/atzar.js",
  "shared/CC_BY-NC-SA.png",
  ...APPS.flatMap((app) => [`${app}/`, `${app}/script.js`, `${app}/style.css`, `${app}/favicon.svg`]),
  "Cartes/figures.js",
  "Ruleta/data/library.js",
  "Ruleta/assets/CC_BY-NC-SA.png",
];
// Els paràmetres ?v= només serveixen per renovar la memòria cau del navegador.
const key = (url) => url.split(/[?#]/)[0];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("atzar-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(key(request.url), copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(key(request.url)).then((hit) => hit || (request.mode === "navigate" ? caches.match(new URL("./", self.registration.scope).href) : Response.error())),
      ),
  );
});
