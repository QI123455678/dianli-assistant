/**
 * Service Worker - 缓存应用外壳，实现离线可用
 * 台账数据存 IndexedDB（本地），AI/新闻在线时可用
 * 所有路径用相对路径，适配 GitHub Pages 子路径部署
 */
const CACHE_NAME = "dianli-assistant-v1";

// 相对 sw.js 所在目录的资源（sw.js 在仓库根，即应用根）
const CORE_REL = [
  "./",
  "index.html",
  "manifest.json",
  "news.json",
  "css/style.css",
  "js/vendor/jszip.min.js",
  "js/vendor/xlsx.full.min.js",
  "js/db.js",
  "js/news.js",
  "js/ledger.js",
  "js/ai.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

// 转成绝对 URL（相对 sw.js 位置）
const CORE_ASSETS = CORE_REL.map((rel) => new URL(rel, self.location).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 新闻数据：网络优先（数据要新），失败时兜底缓存
  if (url.pathname.endsWith("/api/news") || url.pathname.endsWith("/news.json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 静态资源：缓存优先
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});
