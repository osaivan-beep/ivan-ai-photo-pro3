
const CACHE_NAME = 'ivan-ai-photo-pro-v3.5-release-001'; // Force update to v3.5
const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
];


self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`Opened cache ${CACHE_NAME}`);
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});


self.addEventListener('fetch', (event) => {
  // Only cache http/https requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache-first for app shell resources defined above
      if (response) return response;

      // Network-first for everything else
      return fetch(event.request).then(networkResponse => {
          return networkResponse;
      }).catch(() => {
          // Optional: Return a fallback offline page here if needed
      });
    })
  );
});


self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Take control immediately
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});
