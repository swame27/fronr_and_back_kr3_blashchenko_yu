'use strict';

const CACHE_NAME = 'notes-v1';

// Список файлов для кэширования
const ASSETS = ['/', '/index.html', '/style.css', '/app.js'];

// install — кэшируем файлы при первой установке
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

//fetch — отдаём из кэша, если есть; иначе идём в сеть
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;           // нашли в кэше — отдаём
      return fetch(event.request);         // нет в кэше — идём в сеть
    })
  );
});