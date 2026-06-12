const CACHE_PREFIX = "docky-runtime";
const VERSION = "v1";
const STATIC_CACHE = `${CACHE_PREFIX}-${VERSION}-static`;
const IMAGE_CACHE = `${CACHE_PREFIX}-${VERSION}-images`;
const PRECACHE_URLS = ["/docky.png", "/docky-other.png", "/CTFMON_Logo.png"];
const IMAGE_EXTENSION_RE = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const MAX_STATIC_ENTRIES = 120;
const MAX_IMAGE_ENTRIES = 180;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch(() => undefined)
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== STATIC_CACHE && cacheName !== IMAGE_CACHE)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

const isSameOrigin = (url) => url.origin === self.location.origin;

const isStaticAsset = (url) => (
    url.pathname.startsWith("/assets/") ||
    (url.pathname.startsWith("/good-etc-game/") && IMAGE_EXTENSION_RE.test(url.pathname))
);

const isRuntimeImage = (url) => (
    PRECACHE_URLS.includes(url.pathname) ||
    url.pathname === "/api/image/view" ||
    /^\/api\/streaming\/videos\/\d+\/thumbnail$/.test(url.pathname)
);

const shouldHandleRequest = (request, url) => (
    request.method === "GET" &&
    request.mode !== "navigate" &&
    !request.headers.has("range") &&
    isSameOrigin(url) &&
    (isStaticAsset(url) || isRuntimeImage(url))
);

const putIfCacheable = async (cache, request, response, maxEntries) => {
    if (!response || response.status !== 200 || response.type === "opaque") {
        return;
    }
    const cacheControl = response.headers.get("Cache-Control") || "";
    if (/no-store/i.test(cacheControl)) {
        return;
    }
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
    }
};

const cacheFirst = async (request, cacheName, maxEntries) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }
    const response = await fetch(request);
    await putIfCacheable(cache, request, response, maxEntries);
    return response;
};

const staleWhileRevalidate = async (event, request, cacheName, maxEntries) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkResponse = fetch(request).then(async (response) => {
        await putIfCacheable(cache, request, response, maxEntries);
        return response;
    });

    if (cached) {
        event.waitUntil(networkResponse.catch(() => undefined));
        return cached;
    }
    return networkResponse;
};

self.addEventListener("fetch", (event) => {
    const request = event.request;
    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }

    if (!shouldHandleRequest(request, url)) {
        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC_ENTRIES));
        return;
    }

    event.respondWith(staleWhileRevalidate(event, request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
});
