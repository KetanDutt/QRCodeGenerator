'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const csv = require('../js/csv');

test('parses a simple comma separated file', () => {
  const result = csv.parse('First Name,Last Name\nAda,Lovelace\nAlan,Turing\n');
  assert.deepEqual(result.headers, ['First Name', 'Last Name']);
  assert.deepEqual(result.rows, [['Ada', 'Lovelace'], ['Alan', 'Turing']]);
  assert.deepEqual(result.lines, [2, 3]);
  assert.equal(result.delimiter, ',');
  assert.equal(result.issues.length, 0);
});

test('handles quoted fields, escaped quotes and embedded line breaks', () => {
  const text = 'Name,Title,Note\r\n"Smith, Jr.","Head of ""Ops""","line one\nline two"\r\n';
  const result = csv.parse(text);
  assert.deepEqual(result.rows, [['Smith, Jr.', 'Head of "Ops"', 'line one\nline two']]);
});

test('supports CRLF, LF and CR line endings', () => {
  assert.deepEqual(csv.parse('a,b\r\n1,2\r\n3,4').rows, [['1', '2'], ['3', '4']]);
  assert.deepEqual(csv.parse('a,b\n1,2\n3,4').rows, [['1', '2'], ['3', '4']]);
  assert.deepEqual(csv.parse('a,b\r1,2\r3,4').rows, [['1', '2'], ['3', '4']]);
});

test('strips a UTF-8 byte order mark', () => {
  const result = csv.parse('\uFEFFFirst Name,Last Name\nAda,Lovelace');
  assert.deepEqual(result.headers, ['First Name', 'Last Name']);
});

test('drops blank lines and trailing empty columns from spreadsheet exports', () => {
  const text = 'ID,Name,Email,\n1,Ada,ada@example.com,\n\n   \n2,Alan,alan@example.com,\n';
  const result = csv.parse(text);
  assert.deepEqual(result.headers, ['ID', 'Name', 'Email']);
  assert.deepEqual(result.rows, [['1', 'Ada', 'ada@example.com'], ['2', 'Alan', 'alan@example.com']]);
  // Row numbers still refer to the physical record in the file.
  assert.deepEqual(result.lines, [2, 5]);
});

test('pads short rows and reports rows with too many fields', () => {
  const result = csv.parse('a,b,c\n1,2\n1,2,3,4\n');
  assert.deepEqual(result.rows, [['1', '2', ''], ['1', '2', '3', '4']]);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].type, 'extra-fields');
  assert.equal(result.issues[0].row, 3);
});

test('auto-detects semicolon, tab and pipe delimiters', () => {
  assert.equal(csv.detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(csv.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(csv.detectDelimiter('a|b|c\n1|2|3'), '|');
  assert.equal(csv.detectDelimiter('"x;y",b,c\n1,2,3'), ',', 'delimiters inside quotes are ignored');
  assert.equal(csv.detectDelimiter('single'), ',', 'falls back to comma');
  assert.deepEqual(csv.parse('a;b\n"1;5";2').rows, [['1;5', '2']]);
});

test('an explicit delimiter overrides detection', () => {
  const result = csv.parse('a,b;c\n1,2;3', { delimiter: ';' });
  assert.deepEqual(result.headers, ['a,b', 'c']);
});

test('returns an empty result for empty input', () => {
  const result = csv.parse('');
  assert.deepEqual(result.headers, []);
  assert.deepEqual(result.rows, []);
  assert.equal(result.totalRecords, 0);
});

test('header-only files yield no rows', () => {
  const result = csv.parse('First Name,Last Name\n');
  assert.deepEqual(result.headers, ['First Name', 'Last Name']);
  assert.equal(result.rows.length, 0);
  assert.equal(result.totalRecords, 1);
});

test('flags unterminated quotes instead of throwing', () => {
  const result = csv.parse('a,b\n"open,2\n');
  assert.ok(result.issues.some((issue) => issue.type === 'unterminated-quote'));
});

test('trimming can be disabled', () => {
  assert.deepEqual(csv.parse('a,b\n 1 , 2 ', { trim: false }).rows, [[' 1 ', ' 2 ']]);
  assert.deepEqual(csv.parse('a,b\n 1 , 2 ').rows, [['1', '2']]);
});

test('rejects non-string input', () => {
  assert.throws(() => csv.parse(null), TypeError);
});

test('stringify quotes values that need it and round-trips through parse', () => {
  const rows = [['name', 'note'], ['Smith, Jr.', 'says "hi"'], ['plain', 'multi\nline'], [' padded ', '']];
  const text = csv.stringify(rows);
  assert.equal(text, 'name,note\r\n"Smith, Jr.","says ""hi"""\r\nplain,"multi\nline"\r\n" padded ",\r\n');
  const parsed = csv.parse(text, { trim: false });
  assert.deepEqual(parsed.rows, rows.slice(1));
});
