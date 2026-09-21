'use strict';

/**
 * Integration smoke test: loads index.html + all scripts into jsdom, feeds
 * the sample CSV files through the real UI code path and checks the result.
 *
 * Browser APIs that jsdom lacks (canvas, Blob URLs, <dialog>) are stubbed
 * just enough for the flow to run. Skipped when jsdom is not installed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let JSDOM = null;
try {
  ({ JSDOM } = require('jsdom'));
} catch (error) {
  JSDOM = null;
}

const ROOT = path.resolve(__dirname, '..');
const skip = !JSDOM && 'jsdom not installed (run npm install)';

async function createApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const { VirtualConsole } = require('jsdom');
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (error) => {
    // Navigation via <a download> is expected and unsupported in jsdom.
    if (!/navigation/i.test(String(error && error.message))) errors.push(error);
  });
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;

  /* ---- polyfills for APIs jsdom does not implement -------------------- */
  window.TextDecoder = TextDecoder;
  window.Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
  let objectUrls = 0;
  window.URL.createObjectURL = () => 'blob:mock/' + (++objectUrls);
  window.URL.revokeObjectURL = () => {};
  // JSZip's bundled setImmediate polyfill relies on postMessage `event.source`,
  // which jsdom leaves null, so its callbacks would never fire here.
  window.setImmediate = function (fn) {
    const args = Array.prototype.slice.call(arguments, 1);
    return setTimeout(() => fn.apply(null, args), 0);
  };

  const canvasCalls = { fillRect: 0 };
  window.HTMLCanvasElement.prototype.getContext = function () {
    return { fillStyle: '', fillRect() { canvasCalls.fillRect += 1; } };
  };
  window.HTMLCanvasElement.prototype.toBlob = function (callback) {
    setTimeout(() => callback(new window.Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })), 0);
  };

  const dialogProto = (window.HTMLDialogElement || window.HTMLElement).prototype;
  if (typeof dialogProto.showModal !== 'function') {
    dialogProto.showModal = function () {
      this.setAttribute('open', '');
      Object.defineProperty(this, 'open', { value: true, configurable: true });
    };
    dialogProto.close = function (value) {
      this.returnValue = value || '';
      this.removeAttribute('open');
      Object.defineProperty(this, 'open', { value: false, configurable: true });
      this.dispatchEvent(new window.Event('close'));
    };
  }

  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) downloads.push(this.getAttribute('download'));
  };

  await new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });

  /* ---- load the page's scripts in document order ---------------------- */
  const sources = Array.from(document.querySelectorAll('script[src]')).map((script) => script.getAttribute('src'));
  for (const src of sources) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    window.eval(code + '\n//# sourceURL=' + src);
  }

  return { window, document, downloads, errors, canvasCalls };
}

function loadSample(window, name) {
  const text = fs.readFileSync(path.join(ROOT, 'samples', name), 'utf8');
  const file = new window.File([text], name, { type: 'text/csv' });
  window.QRGen.app.handleFile(file);
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 5000);
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for condition');
}

function generationFinished(window) {
  const state = window.QRGen.app.getState();
  return state.contacts.length > 0 && !state.generating && state.contacts.every((c) => c.qr || c.error);
}

test('the page wires up every element the app expects', { skip }, async () => {
  const app = await createApp();
  assert.equal(app.errors.length, 0, 'no script errors: ' + app.errors.join('\n'));
  assert.ok(app.window.QRGen.app, 'app initialised');
  assert.equal(app.document.getElementById('appVersion').textContent, 'v' + app.window.QRGen.app.version);
  assert.equal(app.document.getElementById('emptyState').hidden, false);
  assert.equal(app.document.getElementById('resultsSection').hidden, true);
});

test('processes the canonical sample CSV end to end', { skip }, async () => {
  const app = await createApp();
  const { window, document } = app;

  loadSample(window, 'sample-employees.csv');
  await waitFor(() => generationFinished(window));

  const state = window.QRGen.app.getState();
  assert.equal(state.contacts.length, 8);
  assert.equal(state.skipped, 0);
  assert.ok(state.contacts.every((c) => c.qr && !c.error), 'every contact has a QR code');
  assert.ok(app.canvasCalls.fillRect > 8, 'QR modules were drawn locally');

  assert.equal(document.getElementById('statEmployees').textContent, '8');
  assert.equal(document.getElementById('statGenerated').textContent, '8');
  assert.equal(document.getElementById('emptyState').hidden, true);
  assert.equal(document.getElementById('resultsSection').hidden, false);
  assert.equal(document.querySelectorAll('#tableBody tr').length, 8);
  assert.equal(document.querySelectorAll('#tableBody img').length, 8);

  // Quoted designation survived and the vCard escapes the comma.
  const grace = state.contacts.find((c) => c.firstName === 'Grace');
  assert.equal(grace.designation, 'Director, Engineering');
  assert.match(grace.vcard, /^TITLE:Director\\, Engineering\r?$/m);
  assert.match(grace.vcard, /^item1\.X-ABLabel:Emergency Contact\r?$/m);

  // Buttons are enabled once generation has finished.
  assert.equal(document.getElementById('downloadZipBtn').disabled, false);
  assert.equal(document.getElementById('downloadPngBtn').disabled, false);
  assert.equal(document.getElementById('downloadVcfBtn').disabled, false);

  // Preview dialog shows the vCard of the clicked row.
  document.querySelector('#tableBody .qr-thumb').click();
  assert.equal(document.getElementById('previewTitle').textContent, 'Ada Lovelace');
  assert.match(document.getElementById('previewVcard').textContent, /FN:Ada Lovelace/);

  // Search filters rows.
  const search = document.getElementById('searchInput');
  search.value = 'turing';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 200));
  const visible = Array.from(document.querySelectorAll('#tableBody tr')).filter((tr) => !tr.hidden);
  assert.equal(visible.length, 1);
  assert.match(document.getElementById('resultsCount').textContent, /1 of 8/);

  // vCard download produces a .vcf file.
  document.getElementById('downloadVcfBtn').click();
  assert.deepEqual(app.downloads, ['sample-employees-contacts.vcf']);
  assert.equal(app.errors.length, 0, app.errors.join('\n'));
});

test('handles a form-builder export: extra columns, duplicates, same emergency number', { skip }, async () => {
  const app = await createApp();
  const { window, document } = app;

  loadSample(window, 'sample-forms-export.csv');
  await waitFor(() => generationFinished(window));

  const state = window.QRGen.app.getState();
  assert.equal(state.contacts.length, 7);
  assert.equal(state.mapping.employeeId, 10, 'Employee ID column detected (not the form response ID)');
  assert.equal(state.mapping.email, 13, 'Official Email ID preferred over responder e-mail');
  assert.equal(state.mapping.bloodGroup, 9);

  const messages = state.issues.map((issue) => issue.message);
  assert.ok(messages.some((m) => /Row 5/.test(m) && /same as the employee contact/.test(m)));
  assert.ok(messages.some((m) => /Row 8/.test(m) && /Duplicate e-mail/.test(m)));
  assert.equal(document.getElementById('issuesSection').hidden, false);

  // Blood group and employee id made it into the note.
  assert.match(state.contacts[0].vcard, /^NOTE:Employee ID: E1001\\nBlood Group: A\+\\nEmergency Contact: /m);

  // Employee ID column is shown, file names carry the id and stay unique.
  assert.ok(Array.from(document.querySelectorAll('#tableHead th')).some((th) => th.textContent === 'Employee ID'));
  assert.equal(state.contacts[0].fileBase, 'Ada_Lovelace-E1001');
  assert.equal(state.contacts[6].fileBase, 'Ada_Lovelace-E1001-2');

  // Column mapping panel lists all headers and reflects the detection.
  const select = document.getElementById('map-employeeId');
  assert.equal(select.value, '10');

  // Turning off optional fields regenerates without them.
  const toggle = document.getElementById('settingIncludeBloodGroup');
  toggle.checked = false;
  toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  await waitFor(() => generationFinished(window));
  assert.doesNotMatch(window.QRGen.app.getState().contacts[0].vcard, /Blood Group/);

  // ZIP bundle is produced with the expected structure.
  document.getElementById('downloadZipBtn').click();
  await waitFor(() => app.downloads.length > 0, 10000);
  assert.deepEqual(app.downloads, ['sample-forms-export-qr-codes.zip']);
  assert.equal(app.errors.length, 0, app.errors.join('\n'));
});

test('rejects files without a name column and non-CSV files gracefully', { skip }, async () => {
  const app = await createApp();
  const { window, document } = app;

  window.QRGen.app.handleFile(new window.File(['Phone,Email\n1,a@b.co'], 'nonames.csv', { type: 'text/csv' }));
  await waitFor(() => document.querySelector('.dialog-message[open]'));
  assert.match(document.querySelector('.dialog-title').textContent, /name column/i);
  document.querySelector('.dialog-message .btn').click();

  window.QRGen.app.handleFile(new window.File(['x'], 'photo.png', { type: 'image/png' }));
  await waitFor(() => document.querySelector('.dialog-message[open]'));
  assert.match(document.querySelector('.dialog-title').textContent, /Unsupported file/);
  assert.equal(window.QRGen.app.getState().contacts.length, 0);
  assert.equal(app.errors.length, 0, app.errors.join('\n'));
});

test('a CSV with Windows-1252 encoding is decoded with a warning', { skip }, async () => {
  const app = await createApp();
  const { window } = app;
  const bytes = Buffer.from('First Name,Last Name\nZo\xeb,M\xfcller\n', 'latin1');
  window.QRGen.app.handleFile(new window.File([bytes], 'legacy.csv', { type: 'application/vnd.ms-excel' }));
  await waitFor(() => generationFinished(window));
  const state = window.QRGen.app.getState();
  assert.equal(state.contacts[0].displayName, 'Zoë Müller');
  assert.ok(state.issues.some((issue) => /Windows-1252/.test(issue.message)));
});
