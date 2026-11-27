// Offline cache so the iPad at the stand (test.html) and the landing page keep working if the venue Wi-Fi drops.
// Content files are fetched fresh when online (network first), and the cached copy is used offline.
const VERSION = 'finder-v15';
const SHELL = [
  './',
  'index.html',
  'test.html',
  'form.html',
  'src/site.css',
  'src/site.js',
  'src/landing.js',
  'src/web.js',
  'src/form.js',
  'manifest.webmanifest',
  'src/styles.css',
  'src/app.js',
  'src/paper.js',
  'src/scoring.js',
  'src/save.js',
  'src/sound.js',
  'src/curl.js',
  'content/config.json',
  'content/questions.json',
  'content/en.json',
  'content/tr.json',
  'content/ar.json',
  'content/forms.json',
  'content/landing.en.json',
  'content/landing.tr.json',
  'content/landing.ar.json',
  'assets/logo-light.png',
  'assets/logo-dark.png',
  'assets/favicon-32.png',
  'assets/favicon-192.png',
  'assets/sounds/page-turn.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
