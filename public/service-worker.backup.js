// Service Worker for Star Vocab Game PWA
const CACHE_NAME = 'star-vocab-v1';
const RUNTIME_CACHE = 'star-vocab-runtime';

// Core app shell files to cache on install
const APP_SHELL = [
    '/',
    '/index.html',
    '/static/css/main.css',
    '/static/js/main.js',
    '/logo.svg',
    '/logo192.png',
    '/logo512.png',
    '/manifest.json'
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app shell');
                return cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })))
                    .catch((err) => {
                        console.warn('Failed to cache some resources:', err);
                        // Continue even if some resources fail to cache
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName.startsWith('star-vocab-') && cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                        })
                        .map((cacheName) => caches.delete(cacheName))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - cache-first strategy for app shell, network-first for API calls
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip chrome-extension and non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache runtime resources
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page or cached response if available
                        return caches.match('/index.html');
                    });
            })
    );
});

// Dictionary caching abstraction (for future use)
// This provides the structure but doesn't actively cache the dictionary yet
const DictionaryCache = {
    DICT_CACHE_NAME: 'star-vocab-dictionary',
    DICT_URL: '/vocab-dict.json',

    // Check if dictionary is cached
    async isCached() {
        const cache = await caches.open(this.DICT_CACHE_NAME);
        const response = await cache.match(this.DICT_URL);
        return !!response;
    },

    // Cache the dictionary
    async cacheDictionary() {
        const cache = await caches.open(this.DICT_CACHE_NAME);
        try {
            await cache.add(this.DICT_URL);
            return true;
        } catch (error) {
            console.error('Failed to cache dictionary:', error);
            return false;
        }
    },

    // Get dictionary from cache
    async getCachedDictionary() {
        const cache = await caches.open(this.DICT_CACHE_NAME);
        const response = await cache.match(this.DICT_URL);
        if (response) {
            return await response.json();
        }
        return null;
    },

    // Clear dictionary cache
    async clearCache() {
        return await caches.delete(this.DICT_CACHE_NAME);
    }
};

// Message handler for communication with the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Dictionary cache control messages (for future use)
    if (event.data && event.data.type === 'CACHE_DICTIONARY') {
        event.waitUntil(
            DictionaryCache.cacheDictionary()
                .then((success) => {
                    event.ports[0].postMessage({ success });
                })
        );
    }

    if (event.data && event.data.type === 'CHECK_DICTIONARY_CACHE') {
        event.waitUntil(
            DictionaryCache.isCached()
                .then((isCached) => {
                    event.ports[0].postMessage({ isCached });
                })
        );
    }
});
