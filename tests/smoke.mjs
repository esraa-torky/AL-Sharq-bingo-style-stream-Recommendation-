// Smoke test: plays the survey (test.html) to a result in every language, on a phone and an iPad in landscape,
// then checks the website: the landing page (index.html), each form page (form.html) validates and sends,
// and the test opened from the site hands its match to the program form.
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

// Answers every question of the survey in `where` (a page, or the test frame inside the landing page) and returns how many there were.
async function playSurvey(where, label) {
  await where.click('#begin button');
  const n = await where.evaluate(() => window.__finder.questions().length);
  for (let q = 0; q < n; q++) {
    await where.waitForSelector('#ans-0');
    const count = await where.evaluate(() => document.querySelectorAll('.sq:not([aria-hidden="true"] .sq)').length); // ignore the hidden copy of the last page during a page turn
    if (!(await where.locator('#next-wrap button').isDisabled())) failures.push(`${label}: Next is enabled before picking (q${q + 1})`);
    await where.click(`#ans-${(q * 3 + 1) % count}`);
    await where.click('#next-wrap button');
    await where.waitForTimeout(600);
  }
  return n;
}

function watchErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // our own files must load; other sites (Google Fonts) may be unreachable from a test machine, and the site falls back to system fonts
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const src = (m.location() && m.location().url) || '';
    if (/^Failed to load resource/.test(m.text()) && src && !src.startsWith(BASE)) return;
    errs.push(m.text() + (src ? ' (' + src + ')' : ''));
  });
  return errs;
}

// Fills every visible field of the form on screen with a valid test value.
async function fillForm(page) {
  await page.evaluate(() => {
    const f = document.querySelector('form.form');
    const value = { email: 'test@example.com', tel: '+90 555 000 0000', url: 'https://example.com/me', text: 'Test' };
    for (const el of f.querySelectorAll('input, select, textarea')) {
      if (el.closest('[hidden]') || el.closest('.trap')) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (!f.querySelector(`[name="${el.name}"]:checked`)) el.checked = true; }
      else if (el.tagName === 'SELECT') el.selectedIndex = 1;
      else if (el.tagName === 'TEXTAREA') el.value = 'A test answer.';
      else el.value = value[el.type] || 'Test';
    }
    f.dispatchEvent(new Event('change'));
  });
}

const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  for (const lang of config.languages) {
    for (const dev of devices) {
      const page = await browser.newPage({ viewport: dev.viewport });
      // never send test surveys to the real results sheet
      await page.route(/script\.google(usercontent)?\.com/, (r) => r.abort());
      const errs = watchErrors(page);
      await page.goto(`${BASE}test.html?lang=${lang}`);
      await page.waitForSelector('#begin button');
      const dir = await page.evaluate(() => document.documentElement.dir);
      const n = await playSurvey(page, `${lang} ${dev.name}`);
      await page.waitForSelector('.res-name');
      const info = await page.evaluate(() => ({
        name: document.querySelector('.res-name').textContent,
        ticket: !!document.querySelector('.pt'),
        sideways: document.documentElement.scrollWidth > innerWidth,
        win: document.querySelector('.phone.result').dataset.win,
        mix: [...document.querySelectorAll('.phone.result #mix .mix-row')].map((r) => ({ s: r.dataset.stream, p: +r.dataset.p, label: r.querySelector('.sr-only').textContent, w: r.querySelector('.mix-bar i').style.getPropertyValue('--w') })),
        mixBox: (() => { const b = document.querySelector('.phone.result #mix'); if (!b) return null; const r = b.getBoundingClientRect(), c = b.closest('.phone').getBoundingClientRect(); return { inside: r.left >= c.left - 1 && r.right <= c.right + 1, h: r.height }; })(),
      }));
      // the breakdown: three rows, adding up to 100, winner first, highest to lowest
      const sum = info.mix.reduce((a, x) => a + x.p, 0);
      if (info.mix.length !== 3) failures.push(`${lang} ${dev.name}: the breakdown has ${info.mix.length} rows, not 3`);
      else {
        if (sum !== 100) failures.push(`${lang} ${dev.name}: the breakdown adds up to ${sum}, not 100`);
        if (info.mix[0].s !== info.win) failures.push(`${lang} ${dev.name}: the first bar (${info.mix[0].s}) is not the match (${info.win})`);
        if (info.mix.some((x, i) => i > 0 && x.p > info.mix[i - 1].p)) failures.push(`${lang} ${dev.name}: the bars are not highest to lowest`);
        if (info.mix.some((x) => x.w !== x.p + '%' || !x.label.includes(String(x.p)))) failures.push(`${lang} ${dev.name}: a bar width or label does not match its percentage`);
        if (!info.mixBox.inside) failures.push(`${lang} ${dev.name}: the breakdown sticks out of the sheet`);
      }
      if (!info.ticket) failures.push(`${lang} ${dev.name}: no personality ticket on the result`);
      if (info.sideways) failures.push(`${lang} ${dev.name}: page scrolls sideways`);
      if (lang === 'ar' && dir !== 'rtl') failures.push('ar: layout is not right to left');
      if (errs.length) failures.push(`${lang} ${dev.name}: ${errs.join(' | ')}`);
      console.log(`${lang.padEnd(2)} ${dev.name.padEnd(15)} ${n} questions → ${info.name} (${info.mix.map((x) => x.s + ' ' + x.p + '%').join(', ')})`);
      await page.close();
    }
  }
  // ---------- the website: landing page, the three form pages, and the test → program form ----------
  // the opening screen: shown when asked for, then it lifts away and leaves the page usable
  {
    const page = await browser.newPage({ viewport: devices[0].viewport });
    const errs = watchErrors(page);
    await page.goto(`${BASE}?intro=1`);
    if (!(await page.isVisible('#intro img'))) failures.push('intro: the opening screen with the logo did not show');
    await page.waitForSelector('#intro', { state: 'detached', timeout: 8000 }).catch(() => failures.push('intro: the opening screen did not go away'));
    await page.waitForSelector('#take-test');
    const shown = await page.evaluate(() => new Promise((done) => setTimeout(() => done(getComputedStyle(document.querySelector('.hero h1 .w')).opacity), 2500)));
    if (shown !== '1') failures.push(`intro: the headline did not appear after the opening screen (opacity ${shown})`);
    await page.goto(BASE);
    if (await page.isVisible('#intro')) failures.push('intro: the opening screen shows in automated runs without being asked for');
    if (errs.length) failures.push(`intro: ${errs.join(' | ')}`);
    console.log('intro                    shown on request, then cleared');
    await page.close();
  }
  const forms = JSON.parse(readFileSync(new URL('../content/forms.json', import.meta.url), 'utf8'));
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  for (const lang of config.languages) {
    for (const dev of [devices[0], { name: 'laptop', viewport: { width: 1280, height: 800 } }]) {
      const label = `site ${lang} ${dev.name}`;
      const page = await browser.newPage({ viewport: dev.viewport });
      await page.route(/script\.google(usercontent)?\.com/, (r) => r.abort());
      const errs = watchErrors(page);
      await page.goto(`${BASE}?lang=${lang}`);
      await page.waitForSelector('#take-test');
      if (lang === 'ar' && (await page.evaluate(() => document.documentElement.dir)) !== 'rtl') failures.push(`${label}: not right to left`);
      if (await sideways(page)) failures.push(`${label}: landing page scrolls sideways`);
      if (!(await page.isVisible('.hero-web canvas'))) failures.push(`${label}: the web behind the headline is missing`);
      // the web must keep drawing new frames; a slow test machine gets a few seconds to show it
      const from = await page.evaluate(() => window.__landing.web.frames);
      await page.waitForFunction((n) => window.__landing.web.frames >= n + 5, from, { timeout: 5000 }).catch(() => failures.push(`${label}: the web behind the headline is not moving`));
      if (!(await page.isVisible('.stats dt'))) failures.push(`${label}: the numbers in the hero are missing`);
      // the section links: in the bar on a laptop, behind the menu button on a phone
      if (dev.name === 'phone') {
        if (await page.isVisible('.site-nav')) failures.push(`${label}: the menu is open before it is asked for`);
        await page.click('#menu');
        if (!(await page.isVisible('.site-nav a[href="#path"]'))) failures.push(`${label}: the menu button does not open the menu`);
        await page.click('.site-nav a[href="#path"]');
        if (await page.isVisible('.site-nav')) failures.push(`${label}: the menu stays open after choosing a section`);
      } else if (!(await page.isVisible('.site-nav a[href="#path"]'))) failures.push(`${label}: the section links are missing from the top bar`);
      // every part that rises into view must have arrived once the page has been scrolled through
      const hidden = await page.evaluate(async () => {
        // jump (the page itself scrolls smoothly) and give each stop time to notice what came into view
        for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight / 2) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 200)); }
        await new Promise((r) => setTimeout(r, 300));
        return document.querySelectorAll('.reveal:not(.in)').length;
      });
      if (hidden) failures.push(`${label}: ${hidden} parts of the landing page stay hidden after scrolling`);
      if (await sideways(page)) failures.push(`${label}: landing page scrolls sideways after scrolling through`);
      for (const f of forms.forms) {
        await page.goto(`${BASE}?lang=${lang}`);
        await page.click(`#go-${f.id}`);
        await page.waitForSelector(`#form-${f.id}`);
        if (!page.url().includes('form.html')) failures.push(`${label}: ${f.id} did not open its own page`);
        if (!page.url().includes(`lang=${lang}`) && lang !== config.defaultLanguage) failures.push(`${label}: ${f.id} page lost the language`);
        await page.click('#send');
        if (!(await page.isVisible('.summary'))) failures.push(`${label}: ${f.id} sent with empty required fields`);
        if (await sideways(page)) failures.push(`${label}: ${f.id} form scrolls sideways`);
        await fillForm(page);
        await page.check('#f-consent');
        await page.click('#send');
        await page.waitForSelector('.success', { timeout: 3000 }).catch(() => failures.push(`${label}: ${f.id} did not reach the thank-you message`));
        const last = await page.evaluate(() => window.__site.submissions.at(-1));
        if (!last || last.form !== f.id || last.sheet !== f.sheet || last.email !== 'test@example.com') failures.push(`${label}: ${f.id} sent the wrong row ${JSON.stringify(last)}`);
      }
      let match = '';
      if (dev.name === 'phone') {
        // the test opens as its own page; "Apply to …" on its result opens the program form showing the match
        await page.goto(`${BASE}?lang=${lang}`);
        await page.click('#take-test');
        await page.waitForSelector('#begin button');
        await playSurvey(page, label);
        await page.click('#apply button');
        await page.waitForSelector('#form-join-program');
        const st = await page.evaluate(() => ({ note: (document.querySelector('.from-test') || {}).textContent || '', lang: document.documentElement.lang }));
        if (!st.note || st.lang !== lang) failures.push(`${label}: the test result did not open the program form with the match ${JSON.stringify(st)}`);
        await fillForm(page); await page.check('#f-consent'); await page.click('#send');
        const last = await page.evaluate(() => window.__site.submissions.at(-1));
        if (!last || !last.testMatch) failures.push(`${label}: the program form did not save the test match`);
        match = ' · test → ' + (last && last.testMatch);
      }
      if (errs.length) failures.push(`${label}: ${errs.join(' | ')}`);
      console.log(`${label.padEnd(24)} ${forms.forms.length} forms sent${match}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.log('\n' + failures.map((f) => 'FAIL: ' + f).join('\n')); process.exit(1); }
console.log('Smoke test passed.');
