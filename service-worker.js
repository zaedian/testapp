const CACHE_VERSION = 'v7';
const CACHE_NAME = `cbr-cache-${CACHE_VERSION}`;

// Dynamically derive base path from SW scope (works on GitHub Pages subdirectories and localhost)
const BASE_PATH = new URL(self.registration.scope).pathname;

const APP_SHELL = [
    BASE_PATH,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}src/css/styles.css`,
    `${BASE_PATH}src/js/app.js`,
    `${BASE_PATH}src/js/data/questions.js`,
    `${BASE_PATH}src/js/data/translations.js`,
    `${BASE_PATH}src/js/modules/examState.js`,
    `${BASE_PATH}src/js/modules/timer.js`,
    `${BASE_PATH}src/js/modules/ui.js`
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Precache assets individually so a single missing file does not break installation
                return Promise.allSettled(
                    APP_SHELL.map((url) => cache.add(url))
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            )
        ).then(() => self.clients.claim())
    );
});

// Helper function: ensure HTTP response is successful before writing to Cache storage
const isValidResponse = (response) => {
    return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
};

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // 1. Navigation requests (HTML pages)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (isValidResponse(response)) {
                        const responseCopy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(`${BASE_PATH}index.html`, responseCopy));
                    }
                    return response;
                })
                .catch(() => 
                    caches.match(`${BASE_PATH}index.html`)
                        .then((res) => res || caches.match(BASE_PATH))
                )
        );
        return;
    }

    // 2. Scripts and Stylesheets (Network-first with offline cache fallback)
    if (
        event.request.destination === 'style' || 
        event.request.destination === 'script' || 
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.css')
    ) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (isValidResponse(response)) {
                        const responseCopy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 3. Images and static media (Cache-first with network fallback)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((response) => {
                if (isValidResponse(response)) {
                    const responseCopy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
                }
                return response;
            });
        })
    );
});