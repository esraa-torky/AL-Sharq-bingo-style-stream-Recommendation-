// Checking the contact details a visitor leaves on the result screen.
// apps-script/Code.gs repeats exactly these rules (it cannot import this file), and tests/check-apps-script.mjs
// runs both on the same inputs, so the sheet never rejects details that the form accepted.

export const LIMITS = { name: 100, email: 254, phone: 30 };
// an address may not start with = + - (they could turn it into a formula if the sheet is opened in Excel)
const EMAIL = /^[^\s@<>"=+\-][^\s@<>"]*@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const PHONE = /^\+?[0-9 ().-]+$/;

// Arabic-Indic (\u0660-\u0669) and Persian (\u06F0-\u06F9) digits become 0-9, so a phone number typed on an Arabic keyboard is accepted.
export function asciiDigits(s) {
  return s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

// Control characters and invisible direction overrides are removed (they can disguise text in the sheet),
// runs of spaces become one, and the text is cut to its limit.
export function tidy(v, max) {
  return String(v == null ? '' : v).normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Returns { ok, errors: ['name' | 'email' | 'phone' | 'consent', ...], value: { name, email, phone } }. */
export function checkContact(raw) {
  const r = raw || {};
  const name = tidy(r.name, LIMITS.name).replace(/^[=+\-@\s]+/, ''); // leading = + - @ could start a formula
  const email = tidy(r.email, LIMITS.email).replace(/ /g, '').toLowerCase();
  const phone = tidy(asciiDigits(String(r.phone == null ? '' : r.phone)), LIMITS.phone);
  const digits = phone.replace(/[^0-9]/g, '').length;
  const errors = [];
  if (!name) errors.push('name');
  if (!EMAIL.test(email)) errors.push('email');
  if (phone && !(PHONE.test(phone) && digits >= 7 && digits <= 15)) errors.push('phone');
  if (r.consent !== true) errors.push('consent');
  return { ok: !errors.length, errors, value: { name, email, phone } };
}
