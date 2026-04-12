const CACHE_NAME = 'cb-site-v9';
const ASSETS = [
    '/',
    '/index.html',
    '/404.html',
    '/privacy.html',
    '/css/style.css',
    '/css/fonts.css',
    '/css/print.css',
    '/js/main.js',
    '/fonts/inter-400.woff2',
    '/fonts/inter-500.woff2',
    '/fonts/inter-600.woff2',
    '/fonts/inter-700.woff2',
    '/fonts/inter-800.woff2',
    '/fonts/jetbrains-400.woff2',
    '/fonts/jetbrains-500.woff2',
    '/img/photo.jpg',
    '/img/photo-elegant.jpg',
    '/favicon.ico',
    '/manifest.json'
];

// Install: cache all assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return response;
            })
            .catch(() => caches.match(e.request))
    );
});
