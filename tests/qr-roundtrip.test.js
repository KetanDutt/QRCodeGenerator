'use strict';

/**
 * End-to-end check: contact -> vCard -> QR modules -> decoded text.
 *
 * Uses the optional `jsqr` dev dependency as an independent decoder. When it
 * is not installed (e.g. a checkout without `npm install`) the test is skipped
 * rather than failed, so the core test-suite stays dependency-free.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const qrcode = require('../vendor/qrcode-generator');
const vcard = require('../js/vcard');

let jsQR = null;
try {
  jsQR = require('jsqr');
} catch (error) {
  jsQR = null;
}

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function rasterize(qr, scale, quietZone) {
  const count = qr.getModuleCount();
  const dim = (count + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (c + quietZone) * scale + dx;
          const y = (r + quietZone) * scale + dy;
          const offset = (y * dim + x) * 4;
          data[offset] = data[offset + 1] = data[offset + 2] = 0;
        }
      }
    }
  }
  return { data, dim };
}

function encodeAndDecode(text, level) {
  const qr = qrcode(0, level);
  qr.addData(text, 'Byte');
  qr.make();
  const { data, dim } = rasterize(qr, 4, 4);
  const decoded = jsQR(data, dim, dim);
  return decoded ? decoded.data : null;
}

const contact = {
  firstName: 'Zoë',
  lastName: 'Müller',
  designation: 'Sr. Engineer, Platform',
  company: 'Example Corp',
  phone: '+91 90000 00001',
  emergencyPhone: '+91 90000 00002',
  email: 'zoe.mueller@example.com',
  employeeId: 'E-1001',
  bloodGroup: 'A+'
};

test('vCard survives a QR encode/decode round trip at every error-correction level', { skip: !jsQR && 'jsqr not installed (run npm install)' }, () => {
  const card = vcard.build(contact);
  ['L', 'M', 'Q', 'H'].forEach((level) => {
    assert.equal(encodeAndDecode(card, level), card, 'level ' + level);
  });
});

test('non-Latin text is encoded as UTF-8', { skip: !jsQR && 'jsqr not installed (run npm install)' }, () => {
  const text = '日本語テスト — Ünïcödé';
  assert.equal(encodeAndDecode(text, 'M'), text);
});

test('the QR library exposes the API the app relies on', () => {
  const qr = qrcode(0, 'M');
  qr.addData(vcard.build(contact), 'Byte');
  qr.make();
  assert.ok(qr.getModuleCount() > 21);
  assert.equal(typeof qr.isDark, 'function');
  assert.throws(() => {
    const huge = qrcode(0, 'H');
    huge.addData('x'.repeat(5000), 'Byte');
    huge.make();
  }, /overflow/i, 'oversized payloads throw a recognisable error');
});
