// service-worker.js — cachea todo el juego para que funcione sin conexión.
// Sube la versión (CACHE_NAME) cuando cambies los archivos del juego,
// así el navegador descarga la nueva versión en vez de servir la vieja.
var CACHE_NAME = 'snake-cache-v15';

var FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './skins.js',
  './render.js',
  './audio.js',
  './input.js',
  './game.js',
  './manifest.json',
  './icon.png'
];

// Al instalar: descarga y guarda todos los archivos del juego.
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Al activar: borra cachés de versiones anteriores.
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Al pedir un archivo: sírvelo desde la caché primero (funciona sin Internet);
// si no está en caché, intenta la red y guarda una copia para la próxima vez.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          // Sin red y sin caché para este archivo: si pidieron una página,
          // devuelve al menos el index como respaldo.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
