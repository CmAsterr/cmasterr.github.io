const CACHE_NAME = 'polycalc-v1';

// 这里列出你需要离线缓存的所有文件路径（相对于 sw.js 的路径）
const ASSETS_TO_CACHE = [
  './html/index.html',
  './html/eval.html',
  './html/factor.html',
  './html/operate.html',
  './html/plot.html',
  './html/solve.html',
  './html/sparse.html',
  './html/css/app.css',
  './html/js/poly_core.js',
  './html/js/ui_shared.js',
  './html/js/tabs_scroll.js',
  './images/day.png',
  './images/night.png',
  './latex/katex/katex.min.css',
  './latex/katex/katex.min.js'
  // 如果有其他必须的核心 JS/CSS，请继续添加到这个数组里
];

// 安装阶段：缓存文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 拦截网络请求：优先从缓存读取，如果没有再从网络请求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});