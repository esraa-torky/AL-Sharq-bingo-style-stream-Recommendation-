// Smoke test: plays the survey (test.html) to a result in every language, on a phone and an iPad in landscape,
// then checks the landing page (index.html): each form validates and sends, and the test inside it hands its match to the program form.
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
      }));
      if (!info.ticket) failures.push(`${lang} ${dev.name}: no personality ticket on the result`);
      if (info.sideways) failures.push(`${lang} ${dev.name}: page scrolls sideways`);
      if (lang === 'ar' && dir !== 'rtl') failures.push('ar: layout is not right to left');
      if (errs.length) failures.push(`${lang} ${dev.name}: ${errs.join(' | ')}`);
      console.log(`${lang.padEnd(2)} ${dev.name.padEnd(15)} ${n} questions → ${info.name}`);
      await page.close();
    }
  }
  // ---------- the landing page ----------
  const forms = JSON.parse(readFileSync(new URL('../content/forms.json', import.meta.url), 'utf8'));
  for (const lang of config.languages) {
    for (const dev of [devices[0], { name: 'laptop', viewport: { width: 1280, height: 800 } }]) {
      const label = `landing ${lang} ${dev.name}`;
      const page = await browser.newPage({ viewport: dev.viewport });
      await page.route(/script\.google(usercontent)?\.com/, (r) => r.abort());
      const errs = watchErrors(page);
      await page.goto(`${BASE}?lang=${lang}`);
      await page.waitForSelector('#start-test button');
      if (lang === 'ar' && (await page.evaluate(() => document.documentElement.dir)) !== 'rtl') failures.push(`${label}: not right to left`);
      for (const f of forms.forms) {
        await page.click(`#choose-${f.id}`);
        await page.waitForSelector(`#form-${f.id}`);
        await page.click('#send');
        if (!(await page.isVisible('.summary'))) failures.push(`${label}: ${f.id} sent with empty required fields`);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push(`${label}: ${f.id} form makes the page scroll sideways`);
        await fillForm(page);
        await page.check('#f-consent');
        await page.click('#send');
        await page.waitForSelector('.success', { timeout: 3000 }).catch(() => failures.push(`${label}: ${f.id} did not reach the thank-you message`));
        const last = await page.evaluate(() => window.__landing.submissions.at(-1));
        if (!last || last.form !== f.id || last.sheet !== f.sheet || last.email !== 'test@example.com') failures.push(`${label}: ${f.id} sent the wrong row ${JSON.stringify(last)}`);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push(`${label}: ${f.id} page scrolls sideways`);
      }
      let match = '';
      if (dev.name === 'phone') {
        // the test opens on top of the page; its "Apply" button opens the program form with the match chosen
        await page.click('#start-test button');
        const frame = page.frameLocator('#test-frame');
        await frame.locator('#begin button').waitFor();
        const fr = page.frames().find((x) => x.url().includes('test.html'));
        await playSurvey(fr, label);
        await fr.waitForSelector('#apply button');
        await fr.click('#apply button');
        await page.waitForSelector('#form-join-program');
        const st = await page.evaluate(() => ({ overlay: !!document.querySelector('.overlay'), checked: (document.querySelector('[name="program"]:checked') || {}).value, note: !!document.querySelector('.from-test') }));
        if (st.overlay || !st.checked || !st.note) failures.push(`${label}: the test result did not open the program form with the match chosen ${JSON.stringify(st)}`);
        match = ' · test → ' + st.checked;
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
