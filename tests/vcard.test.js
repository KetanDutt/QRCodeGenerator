'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vcard = require('../js/vcard');

const contact = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  designation: 'Analyst, Engines',
  company: 'Example Corp',
  phone: '+44 20 7946 0001',
  emergencyPhone: '+44 20 7946 0002',
  email: 'ada.lovelace@example.com',
  employeeId: 'E-1001',
  bloodGroup: 'A+'
};

test('builds a complete vCard 3.0 with CRLF line endings', () => {
  const card = vcard.build(contact);
  assert.equal(card, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Lovelace;Ada;;;',
    'FN:Ada Lovelace',
    'ORG:Example Corp',
    'TITLE:Analyst\\, Engines',
    'TEL;TYPE=WORK,VOICE:+44 20 7946 0001',
    'item1.TEL;TYPE=VOICE:+44 20 7946 0002',
    'item1.X-ABLabel:Emergency Contact',
    'EMAIL;TYPE=INTERNET,WORK:ada.lovelace@example.com',
    'NOTE:Employee ID: E-1001\\nBlood Group: A+\\nEmergency Contact: +44 20 7946 0002',
    'END:VCARD',
    ''
  ].join('\r\n'));
});

test('is deterministic', () => {
  assert.equal(vcard.build(contact), vcard.build(contact));
});

test('escapes backslashes, newlines, commas and semicolons in text values', () => {
  assert.equal(vcard.escapeText('a\\b'), 'a\\\\b');
  assert.equal(vcard.escapeText('a\nb\r\nc'), 'a\\nb\\nc');
  assert.equal(vcard.escapeText('a,b;c'), 'a\\,b\\;c');
  const card = vcard.build({ firstName: 'Semi;colon', lastName: 'Back\\slash' });
  assert.match(card, /^N:Back\\\\slash;Semi\\;colon;;;$/m);
});

test('omits optional properties that have no value', () => {
  const card = vcard.build({ firstName: 'Solo' });
  assert.equal(card, 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:;Solo;;;\r\nFN:Solo\r\nEND:VCARD\r\n');
});

test('falls back to the default company when the contact has none', () => {
  const card = vcard.build({ firstName: 'Ada', lastName: 'Lovelace' }, { defaultCompany: 'Fallback Ltd' });
  assert.match(card, /^ORG:Fallback Ltd$/m);
  const withOwn = vcard.build({ firstName: 'Ada', company: 'Own Co' }, { defaultCompany: 'Fallback Ltd' });
  assert.match(withOwn, /^ORG:Own Co$/m);
});

test('optional fields can be excluded', () => {
  const card = vcard.build(contact, { include: { emergencyPhone: false, employeeId: false, bloodGroup: false } });
  assert.doesNotMatch(card, /item1\./);
  assert.doesNotMatch(card, /^NOTE:/m);
  assert.doesNotMatch(card, /Emergency/);
});

test('uses displayName for FN when provided', () => {
  const card = vcard.build({ firstName: 'Ada', lastName: 'Lovelace', displayName: 'Countess Lovelace' });
  assert.match(card, /^FN:Countess Lovelace$/m);
});

test('phone numbers never contain separators or line breaks', () => {
  const card = vcard.build({ firstName: 'X', phone: '123;456,\n789' });
  assert.match(card, /^TEL;TYPE=WORK,VOICE:123 456 789$/m);
});

test('buildMany concatenates cards into a single .vcf document', () => {
  const doc = vcard.buildMany([contact, { firstName: 'Alan', lastName: 'Turing' }]);
  assert.equal((doc.match(/BEGIN:VCARD/g) || []).length, 2);
  assert.ok(doc.endsWith('END:VCARD\r\n'));
});
