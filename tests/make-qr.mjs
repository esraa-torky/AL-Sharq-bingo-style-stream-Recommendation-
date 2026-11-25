// Make printable QR codes: `npm run qr -- https://your-address/ [name]`
// Writes assets/qr-<name>.svg (for print) and assets/qr-<name>.png (burgundy on white, high error correction).
// With no name it writes assets/qr.svg and assets/qr.png.
//   npm run qr -- https://<owner>.github.io/<repo>/ site                 → the landing page
//   npm run qr -- "https://<owner>.github.io/<repo>/test.html?site=1" test → the test, with "Apply to …" at the end
import { createRequire } from 'node:module';
const QRCode = createRequire(import.meta.url)('qrcode');

const [url, name] = process.argv.slice(2);
if (!url || !/^https:\/\//.test(url) || (name && !/^[a-z0-9-]+$/.test(name))) {
  console.log('Usage: npm run qr -- https://your-site-address/ [name]');
  process.exit(1);
}
const base = 'assets/qr' + (name ? '-' + name : '');
const opts = { errorCorrectionLevel: 'H', margin: 2, color: { dark: '#8f1336', light: '#ffffff' } };
await QRCode.toFile(base + '.svg', url, { ...opts, type: 'svg' });
await QRCode.toFile(base + '.png', url, { ...opts, width: 1200 });
console.log(`Wrote ${base}.svg and ${base}.png for ${url}`);
