// Smoke test: plays the survey to a result in every language, on a phone and an iPad in landscape,
// then checks saving, the contact form and the idle reset.
// Run `npm run smoke` (starts a local server on port 4173 and uses Playwright's Chromium).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173, BASE = `http://127.0.0.1:${PORT}/`;
const config = JSON.parse(readFileSync(new URL('../content/config.json', import.meta.url), 'utf8'));
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const devices = [
  { name: 'phone', viewport: { width: 390, height: 780 } },
  { name: 'small phone', viewport: { width: 360, height: 640 } },
  { name: 'iPad landscape', viewport: { width: 1180, height: 820 } },
];
const SHEET = /script\.google(usercontent)?\.com/;
const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

// A new page that never reaches the real results sheet. With `posts`, saving is switched on and every row the
// site sends is answered here and kept in `posts` instead.
async function open(viewport, { posts, init } = {}) {
  const page = await browser.newPage({ viewport });
  if (posts) {
    await page.addInitScript(() => { window.__finderSaveInTests = true; });
    await page.route(SHEET, (r) => { posts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, body: 'ok' }); });
  } else {
    await page.route(SHEET, (r) => r.abort());
  }
  if (init) await page.addInitScript(init);
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  // our own files must load; other sites (Google Fonts) may be unreachable from a test machine, and the site falls back to system fonts
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const src = (m.location() && m.location().url) || '';
    if (/^Failed to load resource/.test(m.text()) && src && !src.startsWith(BASE)) return;
    page.errs.push(m.text() + (src ? ' (' + src + ')' : ''));
  });
  return page;
}

// From the welcome screen to the result, picking a spread of answers.
async function play(page, label) {
  await page.waitForSelector('#begin button');
  await page.click('#begin button');
  const n = await page.evaluate(() => window.__finder.questions().length);
  for (let q = 0; q < n; q++) {
    await page.waitForSelector('#ans-0');
    const count = await page.evaluate(() => document.querySelectorAll('.sq:not([aria-hidden="true"] .sq)').length); // ignore the hidden copy of the last page during a page turn
    if (!(await page.locator('#next-wrap button').isDisabled())) failures.push(`${label}: Next is enabled before picking (q${q + 1})`);
    await page.click(`#ans-${(q * 3 + 1) % count}`);
    await page.click('#next-wrap button');
    await page.waitForTimeout(600);
  }
  await page.waitForSelector('.res-name');
  return n;
}

const until = async (page, test, ms = 3000) => { for (let t = 0; t < ms && !test(); t += 100) await page.waitForTimeout(100); return test(); };

try {
  /* ---------- every language on every device ---------- */
  for (const lang of config.languages) {
    for (const dev of devices) {
      const label = `${lang} ${dev.name}`;
      const page = await open(dev.viewport);
      await page.goto(`${BASE}?lang=${lang}`);
      await page.waitForSelector('#begin button');
      const dir = await page.evaluate(() => document.documentElement.dir);
      const n = await play(page, label);
      const info = await page.evaluate(() => ({
        name: document.querySelector('.res-name').textContent,
        ticket: !!document.querySelector('.pt'),
        form: !!document.querySelector('#contact #c-email'),
        sideways: document.documentElement.scrollWidth > innerWidth,
      }));
      if (!info.ticket) failures.push(`${label}: no personality ticket on the result`);
      if (!info.form) failures.push(`${label}: no contact form on the result`);
      if (info.sideways) failures.push(`${label}: page scrolls sideways`);
      if (lang === 'ar' && dir !== 'rtl') failures.push('ar: layout is not right to left');
      if (page.errs.length) failures.push(`${label}: ${page.errs.join(' | ')}`);
      console.log(`${lang.padEnd(2)} ${dev.name.padEnd(15)} ${n} questions → ${info.name}`);
      await page.close();
    }
  }

  /* ---------- saving and the contact form ---------- */
  for (const lang of ['en', 'ar']) {
    const label = `${lang} saving`, posts = [];
    const page = await open(devices[0].viewport, { posts });
    await page.goto(`${BASE}?lang=${lang}`);
    await play(page, label);
    const win = await page.evaluate(() => document.querySelector('.phone').dataset.win);
    if (!(await until(page, () => posts.length === 1))) failures.push(`${label}: the result was sent ${posts.length} times, not once`);
    const res = posts[0] || {};
    if (res.type !== 'result' || res.lang !== lang || res.stream !== win || 'name' in res || 'email' in res) failures.push(`${label}: the result row is wrong: ${JSON.stringify(res)}`);

    // nothing filled in: errors for the required fields, nothing sent
    await page.click('#contact-send button');
    const shown = await page.evaluate(() => ['name', 'email', 'phone', 'consent'].filter((k) => !document.getElementById('c-' + k + '-error').hidden));
    if (shown.join() !== 'name,email,consent') failures.push(`${label}: an empty form shows the errors [${shown}] instead of [name,email,consent]`);
    if (await page.evaluate(() => document.activeElement && document.activeElement.id) !== 'c-name') failures.push(`${label}: the first wrong field does not get the focus`);

    // what a visitor typed survives the screen being redrawn (here, turning the iPad)
    const hostile = '<img src=x onerror="window.__xss=1">=HYPERLINK("x")';
    await page.fill('#c-name', hostile);
    await page.setViewportSize(devices[2].viewport);
    await page.waitForSelector('.tablet #c-name');
    if (await page.inputValue('#c-name') !== hostile) failures.push(`${label}: typed name is lost when the screen is redrawn`);
    await page.fill('#c-email', 'Visitor@Example.com');
    await page.fill('#c-phone', '٠٥٥٥ ١٢٣ ٤٥٦٧');
    await page.check('#c-consent');
    await page.click('#contact-send button');
    await page.waitForSelector('#contact-thanks');
    if (!(await until(page, () => posts.length === 2))) failures.push(`${label}: the contact details were not sent once (${posts.length - 1} times)`);
    const c = posts[1] || {};
    if (c.type !== 'contact' || c.name !== hostile || c.email !== 'visitor@example.com' || c.phone !== '0555 123 4567' || c.consent !== true || c.stream !== win || c.lang !== lang || !c.consentText) {
      failures.push(`${label}: the contact row is wrong: ${JSON.stringify(c)}`);
    }
    const leak = await page.evaluate(() => ({ xss: window.__xss, img: !!document.querySelector('.phone img[src="x"]'), queue: localStorage.getItem('finder-queue') }));
    if (leak.xss || leak.img) failures.push(`${label}: typed text was turned into HTML`);
    if (leak.queue !== '[]') failures.push(`${label}: rows stay on the device after they were sent: ${leak.queue}`);

    // details typed but never sent must not be shown to the next visitor
    await page.click('#start-over');
    await play(page, label);
    await page.fill('#c-name', 'Left behind'); await page.fill('#c-email', 'left@behind.com'); await page.check('#c-consent');
    await page.click('#start-over');
    await play(page, label);
    const left = await page.evaluate(() => ['name', 'email', 'phone'].map((k) => document.getElementById('c-' + k).value).join('') + document.getElementById('c-consent').checked);
    if (left !== 'false') failures.push(`${label}: the next visitor sees the previous visitor's details (${left})`);
    if (page.errs.length) failures.push(`${label}: ${page.errs.join(' | ')}`);
    console.log(`${lang.padEnd(2)} saving          result and contact rows sent once each`);
    await page.close();
  }

  /* ---------- idle reset ---------- */
  for (const kiosk of [true, false]) {
    const label = kiosk ? 'kiosk idle' : 'phone idle';
    const page = await open(devices[2].viewport, { init: () => { window.__idleMs = 300; } });
    await page.goto(`${BASE}${kiosk ? '?kiosk' : ''}`);
    await page.click('#begin button');
    await page.waitForSelector('#ans-0');
    await page.click('#ans-1');
    await page.waitForTimeout(1500);
    const back = await page.locator('#begin button').count();
    if (kiosk && !back) failures.push(`${label}: a survey left half-way does not go back to the welcome screen`);
    if (!kiosk && back) failures.push(`${label}: a visitor's own phone loses a half-finished survey`);
    console.log(`   ${label.padEnd(15)} ${back ? 'back to welcome' : 'survey kept'}`);
    await page.close();
  }

  /* ---------- offline: the stand keeps working when the Wi-Fi drops ---------- */
  {
    const page = await open(devices[2].viewport);
    await page.goto(`${BASE}?lang=ar`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(500); // let the first visit finish filling the cache
    await page.context().setOffline(true);
    await page.reload();
    const ok = await page.waitForSelector('#begin button', { timeout: 8000 }).then(() => true, () => false);
    if (!ok) failures.push('offline: the site does not load from the cache');
    console.log(`   offline         ${ok ? 'loads from the cache' : 'does not load'}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.log('\n' + failures.map((f) => 'FAIL: ' + f).join('\n')); process.exit(1); }
console.log('Smoke test passed.');
