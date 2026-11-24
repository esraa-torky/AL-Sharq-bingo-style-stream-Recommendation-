// Smoke test: plays the survey to a result in every language, on a phone and an iPad in landscape.
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
const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  for (const lang of config.languages) {
    for (const dev of devices) {
      const page = await browser.newPage({ viewport: dev.viewport });
      // never send test surveys to the real results sheet
      await page.route(/script\.google(usercontent)?\.com/, (r) => r.abort());
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      // our own files must load; other sites (Google Fonts) may be unreachable from a test machine, and the site falls back to system fonts
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const src = (m.location() && m.location().url) || '';
        if (/^Failed to load resource/.test(m.text()) && src && !src.startsWith(BASE)) return;
        errs.push(m.text() + (src ? ' (' + src + ')' : ''));
      });
      await page.goto(`${BASE}?lang=${lang}`);
      await page.waitForSelector('#begin button');
      const dir = await page.evaluate(() => document.documentElement.dir);
      await page.click('#begin button');
      const n = await page.evaluate(() => window.__finder.questions().length);
      for (let q = 0; q < n; q++) {
        await page.waitForSelector('#ans-0');
        const count = await page.evaluate(() => document.querySelectorAll('.sq:not([aria-hidden="true"] .sq)').length); // ignore the hidden copy of the last page during a page turn
        if (!(await page.locator('#next-wrap button').isDisabled())) failures.push(`${lang} ${dev.name}: Next is enabled before picking (q${q + 1})`);
        await page.click(`#ans-${(q * 3 + 1) % count}`);
        await page.click('#next-wrap button');
        await page.waitForTimeout(600);
      }
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
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.log('\n' + failures.map((f) => 'FAIL: ' + f).join('\n')); process.exit(1); }
console.log('Smoke test passed.');
