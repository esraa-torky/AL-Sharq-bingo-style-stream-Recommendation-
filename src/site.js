// Shared by the website pages (index.html and form.html): loading text, the language switch, top bar and footer.
// The Program Finder test (test.html) has its own code in app.js.
export const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
export const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
export const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const LANG_NAMES = { en: ['EN', 'English'], tr: ['TR', 'Türkçe'], ar: ['ع', 'العربية'] };

async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

// Loads config, forms and every landing.<lang>.json; returns them with the language to start in.
export async function loadSite() {
  const [config, forms] = await Promise.all([loadJSON('content/config.json'), loadJSON('content/forms.json')]);
  const texts = {};
  const loaded = await Promise.all(config.languages.map((l) => loadJSON('content/landing.' + l + '.json')));
  config.languages.forEach((l, i) => { texts[l] = loaded[i]; });
  const asked = new URLSearchParams(location.search).get('lang');
  const lang = config.languages.includes(asked) ? asked : config.defaultLanguage;
  return { config, forms, texts, lang };
}

// Sets <html lang/dir> and the title, and keeps ?lang= in the address so links and reloads keep the language.
export function applyLang(config, t, lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = config.rightToLeft.includes(lang) ? 'rtl' : 'ltr';
  const q = new URLSearchParams(location.search);
  if (lang === config.defaultLanguage) q.delete('lang'); else q.set('lang', lang);
  const qs = q.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}

// A link to another page of the site that keeps the current language.
export function href(page, lang, params = {}) {
  const q = new URLSearchParams(params);
  if (lang) q.set('lang', lang);
  const qs = q.toString();
  return page + (qs ? '?' + qs : '');
}

export function topbar(config, t, lang, onLang, back) {
  const bar = h('header', 'topbar');
  const brand = h('a', 'brand'); brand.href = href('index.html', lang);
  brand.innerHTML = '<img class="logo for-light" alt="' + t.nav.home + '" src="assets/logo-light.png"><img class="logo for-dark" alt="' + t.nav.home + '" src="assets/logo-dark.png">';
  bar.appendChild(brand);
  const right = h('div', 'topbar-end');
  if (back) {
    const b = h('a', 'back', '<span aria-hidden="true">' + (config.rightToLeft.includes(lang) ? '→' : '←') + '</span> ' + t.nav.back);
    b.href = href('index.html', lang); right.appendChild(b);
  }
  const langs = h('div', 'langs'); langs.setAttribute('role', 'group'); langs.setAttribute('aria-label', 'Language');
  config.languages.forEach((l) => {
    const [short, long] = LANG_NAMES[l] || [l, l];
    const b = h('button', null, short); b.type = 'button'; b.id = 'lang-' + l; b.lang = l;
    b.setAttribute('aria-label', long); b.setAttribute('aria-pressed', String(l === lang));
    b.addEventListener('click', () => onLang(l));
    langs.appendChild(b);
  });
  right.appendChild(langs);
  bar.appendChild(right);
  return bar;
}

export function footer(t) {
  const f = h('footer', 'foot');
  f.appendChild(h('p', null, t.footer.line));
  const a = h('a', null, t.footer.site); a.href = 'https://youth.sharqforum.org/'; a.rel = 'noopener';
  f.appendChild(a);
  return f;
}

export function registerWorker() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('sw.js');
}
