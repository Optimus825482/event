/*
 * Service worker yönlendirme kararı: SAF işlev, DOM/Cache API yok. `sw.js` bunu importScripts ile
 * yükler; testler (tests/features/check-in-offline/sw-routing.test.ts) aynı dosyayı çalıştırır.
 *
 * Önbelleğe ALINMAYANLAR (bypass): GET dışındaki her istek, /api/** (kimlik doğrulamalı yanıtlar,
 * SSE), sunucu eylemleri (Next-Action başlığı), RSC istekleri, başka kaynaklar, sw.js ve
 * check-in kabuğu dışındaki tüm sayfalar (kişisel veri taşır).
 *
 * Önbelleğe alınanlar: içeriği karmalı statik varlıklar ve ikonlar (cache-first) ile yalnızca
 * `/check-in` ve `/check-in/<uuid>` gezinmeleri (network-first; HTML'de yalnızca etkinlik adı ve
 * toplam sayılar vardır, misafir listesi yoktur).
 */
(function (root) {
  var UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
  var SHELL_PATH = new RegExp("^/check-in(/" + UUID + ")?/?$");
  var STATIC_PREFIXES = ["/_next/static/", "/icons/"];
  var STATIC_FILES = ["/manifest.webmanifest"];

  function header(headers, name) {
    if (!headers) return null;
    var wanted = name.toLowerCase();
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i += 1) {
      if (keys[i].toLowerCase() === wanted) return headers[keys[i]];
    }
    return null;
  }

  function isStatic(path) {
    if (STATIC_FILES.indexOf(path) !== -1) return true;
    for (var i = 0; i < STATIC_PREFIXES.length; i += 1) {
      if (path.indexOf(STATIC_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  /**
   * input: { method, url, mode, origin, headers }
   * döner: "bypass" | "cache-first" | "network-first-shell" | "purge-shell"
   */
  function decide(input) {
    if (input.method !== "GET") return "bypass";
    var url;
    try {
      url = new URL(input.url);
    } catch {
      return "bypass";
    }
    if (url.origin !== input.origin) return "bypass";
    var path = url.pathname;
    if (path.indexOf("/api/") === 0 || path === "/api") return "bypass";
    if (header(input.headers, "next-action") !== null) return "bypass";
    if (header(input.headers, "rsc") !== null) return "bypass";
    if (url.searchParams.has("_rsc")) return "bypass";
    if (isStatic(path)) return "cache-first";
    if (input.mode === "navigate") {
      if (path === "/login" || path.indexOf("/login/") === 0) return "purge-shell";
      if (SHELL_PATH.test(path)) return "network-first-shell";
    }
    return "bypass";
  }

  /** İstemcinin `postMessage` ile ısıtma isteyebileceği adresler. */
  function isWarmable(url, origin) {
    var parsed;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.origin !== origin) return false;
    var path = parsed.pathname;
    if (path.indexOf("/_next/static/") === 0) return true;
    return SHELL_PATH.test(path);
  }

  root.efRouting = { decide: decide, isWarmable: isWarmable };
})(self);
