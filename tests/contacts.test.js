'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const csv = require('../js/csv');
const contacts = require('../js/contacts');

const CANONICAL_HEADERS = [
  'First Name', 'Last Name', 'Designation', 'Company Employee Contact Number',
  'Emergency Contact Number (Should not be same as employee contact number)', 'Official Email ID'
];

const FORMS_EXPORT_HEADERS = [
  'ID', 'Start time', 'Completion time', 'Email', 'Name', 'Last modified time', 'First Name', 'Last Name',
  'Designation', 'Blood Group', 'Employee ID', 'Employee Contact Number',
  'Emergency Contact Number (Should not be same as employee contact number)', 'Official Email ID',
  'Employee Photo (Please make sure background should be plain)'
];

test('normalizeHeader lower-cases, strips punctuation and parenthesised notes', () => {
  assert.equal(contacts.normalizeHeader('  Official  E-Mail_ID '), 'official e mail id');
  assert.equal(contacts.normalizeHeader('Emergency Contact Number (Should not be same as employee contact number)'),
    'emergency contact number');
});

test('detects the documented CSV layout', () => {
  const mapping = contacts.detectMapping(CANONICAL_HEADERS);
  assert.equal(mapping.firstName, 0);
  assert.equal(mapping.lastName, 1);
  assert.equal(mapping.designation, 2);
  assert.equal(mapping.phone, 3);
  assert.equal(mapping.emergencyPhone, 4);
  assert.equal(mapping.email, 5);
  assert.equal(mapping.company, -1);
  assert.equal(mapping.fullName, -1);
});

test('detects a Microsoft Forms style export with extra columns', () => {
  const mapping = contacts.detectMapping(FORMS_EXPORT_HEADERS);
  assert.equal(mapping.firstName, 6);
  assert.equal(mapping.lastName, 7);
  assert.equal(mapping.designation, 8);
  assert.equal(mapping.bloodGroup, 9);
  assert.equal(mapping.employeeId, 10, '"Employee ID" wins over the form response "ID"');
  assert.equal(mapping.phone, 11);
  assert.equal(mapping.emergencyPhone, 12);
  assert.equal(mapping.email, 13, '"Official Email ID" wins over the responder "Email"');
  assert.equal(mapping.fullName, 4);
});

test('keyword pass maps unusual but recognisable headers', () => {
  const mapping = contacts.detectMapping(['Given', 'Surname', 'Mobile No.', 'Emergency Mobile No.', 'Work E-mail Address', 'Org.']);
  assert.equal(mapping.firstName, 0);
  assert.equal(mapping.lastName, 1);
  assert.equal(mapping.phone, 2);
  assert.equal(mapping.emergencyPhone, 3, 'emergency is claimed before the generic phone keywords');
  assert.equal(mapping.email, 4);
  assert.equal(mapping.company, 5);
});

test('each column is claimed at most once', () => {
  const mapping = contacts.detectMapping(['Name', 'Phone']);
  const used = Object.values(mapping).filter((index) => index !== -1);
  assert.equal(new Set(used).size, used.length);
  assert.equal(mapping.fullName, 0);
  assert.equal(mapping.phone, 1);
});

test('hasNameColumn requires at least one name column', () => {
  assert.equal(contacts.hasNameColumn(contacts.detectMapping(['Phone', 'Email'])), false);
  assert.equal(contacts.hasNameColumn(contacts.detectMapping(['Name'])), true);
  assert.equal(contacts.hasNameColumn(contacts.detectMapping(['First Name'])), true);
});

test('builds contact records from the canonical layout', () => {
  const parsed = csv.parse([
    CANONICAL_HEADERS.join(','),
    'Ada,Lovelace,"Analyst, Engines",+44 20 7946 0001,+44 20 7946 0002,ada@example.com'
  ].join('\n'));
  const mapping = contacts.detectMapping(parsed.headers);
  const result = contacts.buildContacts(parsed, mapping, { defaultCompany: 'Example Corp' });

  assert.equal(result.contacts.length, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.issues.length, 0);
  const ada = result.contacts[0];
  assert.equal(ada.row, 2);
  assert.equal(ada.displayName, 'Ada Lovelace');
  assert.equal(ada.designation, 'Analyst, Engines');
  assert.equal(ada.company, 'Example Corp');
  assert.equal(ada.phone, '+44 20 7946 0001');
  assert.equal(ada.emergencyPhone, '+44 20 7946 0002');
  assert.equal(ada.email, 'ada@example.com');
});

test('splits a single full-name column into first and last name', () => {
  const parsed = csv.parse('Name,Email\nAda King Lovelace,ada@example.com\nPlato,plato@example.com');
  const result = contacts.buildContacts(parsed, contacts.detectMapping(parsed.headers));
  assert.equal(result.contacts[0].firstName, 'Ada King');
  assert.equal(result.contacts[0].lastName, 'Lovelace');
  assert.equal(result.contacts[1].firstName, 'Plato');
  assert.equal(result.contacts[1].lastName, '');
  assert.equal(result.contacts[1].displayName, 'Plato');
});

test('rows without a name are skipped and reported, everything else is kept aligned', () => {
  const parsed = csv.parse('First Name,Last Name,Phone\nAda,Lovelace,1\n,,2\nAlan,Turing,3');
  const result = contacts.buildContacts(parsed, contacts.detectMapping(parsed.headers));
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.contacts.map((c) => c.row), [2, 4]);
  assert.ok(result.issues.some((issue) => issue.level === 'error' && issue.row === 3));
});

test('emits data-quality warnings', () => {
  const parsed = csv.parse([
    'First Name,Last Name,Phone,Emergency Contact,Email',
    'Ada,Lovelace,555 0001,555-0001,ada@example.com',
    'Alan,Turing,555 0002,555 0003,not-an-email',
    'Grace,Hopper,,,',
    'Ada,Again,555 0001,,ADA@example.com'
  ].join('\n'));
  const result = contacts.buildContacts(parsed, contacts.detectMapping(parsed.headers));
  const messages = result.issues.map((issue) => issue.message);

  assert.ok(messages.some((m) => m.includes('Row 2') && m.includes('same as the employee contact number')));
  assert.ok(messages.some((m) => m.includes('Row 3') && m.includes('does not look valid')));
  assert.ok(messages.some((m) => m.includes('Row 4') && m.includes('No phone number or e-mail')));
  assert.ok(messages.some((m) => m.includes('Row 5') && m.includes('Duplicate e-mail') && m.includes('row 2')));
  assert.ok(messages.some((m) => m.includes('Row 5') && m.includes('Duplicate contact number') && m.includes('row 2')));
  assert.equal(result.contacts.length, 4, 'warnings never drop rows');
});

test('honours a manual mapping override', () => {
  const parsed = csv.parse('Col A,Col B\nLovelace,Ada');
  const mapping = contacts.detectMapping(parsed.headers);
  assert.equal(contacts.hasNameColumn(mapping), false);
  mapping.lastName = 0;
  mapping.firstName = 1;
  const result = contacts.buildContacts(parsed, mapping);
  assert.equal(result.contacts[0].displayName, 'Ada Lovelace');
});

test('fileBaseNames are safe, include the employee id and are unique', () => {
  const names = contacts.fileBaseNames([
    { displayName: 'Ada Lovelace', employeeId: 'E/1001' },
    { displayName: 'Ada Lovelace', employeeId: 'E/1001' },
    { displayName: 'ada lovelace', employeeId: 'e/1001' },
    { displayName: 'Zoë Müller', employeeId: '' },
    { displayName: '   ', employeeId: '' }
  ]);
  assert.deepEqual(names, ['Ada_Lovelace-E_1001', 'Ada_Lovelace-E_1001-2', 'ada_lovelace-e_1001-3', 'Zoë_Müller', 'employee']);
});
