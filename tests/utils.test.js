'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../js/utils');

test('sanitizeFilename produces portable file names', () => {
  assert.equal(utils.sanitizeFilename('Ada Lovelace'), 'Ada_Lovelace');
  assert.equal(utils.sanitizeFilename('  a/b\\c:d*e?f"g<h>i|j  '), 'a_b_c_d_e_f_g_h_i_j');
  assert.equal(utils.sanitizeFilename('Zoë Müller'), 'Zoë_Müller', 'unicode letters are preserved');
  assert.equal(utils.sanitizeFilename('...hidden...'), 'hidden');
  assert.equal(utils.sanitizeFilename(''), 'employee');
  assert.equal(utils.sanitizeFilename(null, 'fallback'), 'fallback');
  assert.equal(utils.sanitizeFilename('CON'), 'employee', 'windows reserved names are avoided');
  assert.equal(utils.sanitizeFilename('x'.repeat(200), 'e', 10), 'xxxxxxxxxx');
});

test('makeUniqueNames de-duplicates case-insensitively', () => {
  assert.deepEqual(utils.makeUniqueNames(['a', 'A', 'a', 'a-2', 'b']), ['a', 'A-2', 'a-3', 'a-2-2', 'b']);
});

test('formatBytes', () => {
  assert.equal(utils.formatBytes(0), '0 B');
  assert.equal(utils.formatBytes(512), '512 B');
  assert.equal(utils.formatBytes(1024), '1.00 KB');
  assert.equal(utils.formatBytes(15 * 1024), '15.0 KB');
  assert.equal(utils.formatBytes(3.5 * 1024 * 1024), '3.50 MB');
  assert.equal(utils.formatBytes(-1), '0 B');
  assert.equal(utils.formatBytes(NaN), '0 B');
});

test('phone helpers', () => {
  assert.equal(utils.normalizePhone('  +91  99999 00000 '), '+91 99999 00000');
  assert.equal(utils.normalizePhone('(555) 010-0001 ext 12'), '(555) 010-0001 ext 12');
  assert.equal(utils.normalizePhone('555;0001,2'), '55500012');
  assert.equal(utils.phoneDigits('+91 (999) 99-000'), '9199999000');
});

test('isValidEmail', () => {
  assert.equal(utils.isValidEmail('ada@example.com'), true);
  assert.equal(utils.isValidEmail(' ada@example.com '), true);
  assert.equal(utils.isValidEmail('ada@example'), false);
  assert.equal(utils.isValidEmail('ada example@example.com'), false);
  assert.equal(utils.isValidEmail(''), false);
});

test('collapseWhitespace and baseName', () => {
  assert.equal(utils.collapseWhitespace('  a \n b\t c '), 'a b c');
  assert.equal(utils.collapseWhitespace(null), '');
  assert.equal(utils.baseName('people.csv'), 'people');
  assert.equal(utils.baseName('archive.tar.gz'), 'archive.tar');
  assert.equal(utils.baseName('.hidden'), '.hidden');
  assert.equal(utils.baseName('noext'), 'noext');
});

test('debounce only fires once after the wait and can be cancelled', async () => {
  let calls = 0;
  const fn = utils.debounce(() => { calls += 1; }, 20);
  fn(); fn(); fn();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls, 1);
  fn();
  fn.cancel();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls, 1);
});
