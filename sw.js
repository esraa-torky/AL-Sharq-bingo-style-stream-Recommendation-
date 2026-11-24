// Offline cache so the iPad at the stand keeps working if the venue Wi-Fi drops.
// Files are fetched fresh when online (network first), and the cached copy is used offline, or when the
// network has not answered within WAIT_MS (weak venue Wi-Fi can leave a request hanging for minutes).
const VERSION = 'finder-v8';
const WAIT_MS = 4000;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/styles.css',
  'src/app.js',
  'src/paper.js',
  'src/scoring.js',
  'src/save.js',
  'src/sound.js',
  'src/curl.js',
  'src/contact.js',
  'content/config.json',
  'content/questions.json',
  'content/en.json',
  'content/tr.json',
  'content/ar.json',
  'assets/logo-light.png',
  'assets/logo-dark.png',
  'assets/icon.svg',
  'assets/icon-180.png',
  'assets/icon-512.png',
  'assets/sounds/page-turn.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function fromNetwork(req) {
  return fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  });
}

// the cached copy; a page address with nothing cached gets the app's page, anything else gets nothing
function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // results are sent with POST and never touch the cache
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  const net = fromNetwork(req);
  e.waitUntil(net.catch(() => {})); // keep refreshing the cache even when the cached copy was used
  e.respondWith(new Promise((resolve, reject) => {
    let answered = false;
    const answer = (res) => { if (!answered && res) { answered = true; resolve(res); } };
    // slow network: use the cached copy if there is one, otherwise keep waiting for the network
    const timer = setTimeout(() => fromCache(req).then(answer), WAIT_MS);
    net.then((res) => { clearTimeout(timer); answer(res); }, () => {
      clearTimeout(timer);
      fromCache(req).then((hit) => { if (hit) answer(hit); else if (!answered) reject(new Error('offline and not cached')); });
    });
  }));
});
