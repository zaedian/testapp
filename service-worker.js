const CACHE_VERSION = 'v10';
const CACHE_NAME = `cbr-cache-${CACHE_VERSION}`;

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

const isValidResponse = (response) => {
    return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
};

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

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