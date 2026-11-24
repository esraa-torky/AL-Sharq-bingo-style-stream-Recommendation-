// Make the printable QR code for the stand: `npm run qr -- https://your-address/`
// Writes assets/qr.svg and assets/qr.png (burgundy on white, high error correction).
import { createRequire } from 'node:module';
const QRCode = createRequire(import.meta.url)('qrcode');

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.log('Usage: npm run qr -- https://your-site-address/');
  process.exit(1);
}
const opts = { errorCorrectionLevel: 'H', margin: 2, color: { dark: '#8f1336', light: '#ffffff' } };
await QRCode.toFile('assets/qr.svg', url, { ...opts, type: 'svg' });
await QRCode.toFile('assets/qr.png', url, { ...opts, width: 1200 });
console.log('Wrote assets/qr.svg and assets/qr.png for ' + url);
