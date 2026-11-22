/*
 * EventFlow service worker: yalnızca check-in kabuğunun çevrimdışı yeniden açılması içindir.
 * Hangi isteğin önbelleğe alınabileceğine `sw-routing.js` (saf işlev, testli) karar verir.
 * Asla: /api/**, sunucu eylemleri, GET dışı istekler, kabuk dışı kimlik doğrulamalı sayfalar.
 * Yeni sürümde VERSION artırılır; activate eski `eventflow-*` önbelleklerini siler.
 */
importScripts("/sw-routing.js");

var VERSION = "v1";
var STATIC_CACHE = "eventflow-static-" + VERSION;
var SHELL_CACHE = "eventflow-shell-" + VERSION;
var PRECACHE = ["/offline.html", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) {
              return name.indexOf("eventflow-") === 0 && name !== STATIC_CACHE && name !== SHELL_CACHE;
            })
            .map(function (name) {
              return caches.delete(name);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

function shellKey(url) {
  var parsed = new URL(url);
  var path = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, "") : parsed.pathname;
  return parsed.origin + path;
}

function storable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

function headersOf(request) {
  var headers = {};
  request.headers.forEach(function (value, name) {
    headers[name] = value;
  });
  return headers;
}

function cacheFirst(request) {
  return caches.open(STATIC_CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function networkFirstShell(request) {
  var key = shellKey(request.url);
  return fetch(request).then(
    function (response) {
      return caches.open(SHELL_CACHE).then(function (cache) {
        if (storable(response)) {
          return cache.put(key, response.clone()).then(function () {
            return response;
          });
        }
        // Oturum bitti / yönlendirildi: eski kopyayı tutma.
        return cache.delete(key).then(function () {
          return response;
        });
      });
    },
    function () {
      return caches.open(SHELL_CACHE).then(function (cache) {
        return cache.match(key).then(function (hit) {
          return hit || caches.match("/offline.html");
        });
      });
    },
  );
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var strategy = self.efRouting.decide({
    method: request.method,
    url: request.url,
    mode: request.mode,
    origin: self.location.origin,
    headers: headersOf(request),
  });
  if (strategy === "bypass") return;
  if (strategy === "purge-shell") {
    event.waitUntil(caches.delete(SHELL_CACHE));
    return;
  }
  if (strategy === "cache-first") {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirstShell(request));
});

function warm(url) {
  if (!self.efRouting.isWarmable(url, self.location.origin)) return Promise.resolve();
  var isShell = new URL(url).pathname.indexOf("/_next/static/") !== 0;
  return fetch(url, { credentials: "same-origin", redirect: "manual" })
    .then(function (response) {
      if (!storable(response)) return null;
      return caches.open(isShell ? SHELL_CACHE : STATIC_CACHE).then(function (cache) {
        return cache.put(isShell ? shellKey(url) : url, response);
      });
    })
    .catch(function () {
      return null;
    });
}

// İstemci: { type: "warm", urls: [...] } (çevrimiçiyken kabuğu hazırlar) ya da { type: "purge" }.
self.addEventListener("message", function (event) {
  var data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "purge") {
    event.waitUntil(caches.delete(SHELL_CACHE));
  } else if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(Promise.all(data.urls.slice(0, 80).map(warm)));
  }
});
