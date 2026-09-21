/**
 * Application controller (browser only).
 *
 * Orchestrates: file intake -> CSV parsing -> column mapping -> contact
 * validation -> vCard building -> local QR rendering -> table/preview ->
 * downloads (individual PNG/SVG, ZIP bundle, .vcf).
 *
 * All processing happens in the browser; nothing is uploaded anywhere.
 */
(function (root) {
  'use strict';

  const QRGen = root.QRGen;
  const csv = QRGen.csv;
  const vcard = QRGen.vcard;
  const contactsLib = QRGen.contacts;
  const utils = QRGen.utils;
  const qr = QRGen.qr;
  const ui = QRGen.ui;
  const theme = QRGen.theme;

  const APP_VERSION = '2.0.0';
  const SETTINGS_KEY = 'qrgen.settings';
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const LARGE_FILE_ROWS = 2000;
  const MAX_BATCH_SIZE = 24;
  const MAX_LISTED_ISSUES = 200;
  const INDIVIDUAL_DOWNLOAD_DELAY = 350;

  const DEFAULT_SETTINGS = Object.freeze({
    company: '',
    size: 512,
    level: 'M',
    format: 'png',
    includeEmergency: true,
    includeEmployeeId: true,
    includeBloodGroup: true
  });

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  const state = {
    file: null,
    parsed: null,
    mapping: null,
    contacts: [],
    issues: [],
    skipped: 0,
    generation: 0,
    generating: false,
    busy: false,
    reading: false,
    settings: loadSettings(),
    filter: ''
  };

  const dom = {};

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function loadSettings() {
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    try {
      const raw = root.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
          if (saved && typeof saved[key] === typeof DEFAULT_SETTINGS[key]) settings[key] = saved[key];
        });
      }
    } catch (error) {
      /* corrupt or unavailable storage - fall back to defaults */
    }
    settings.size = Math.min(qr.MAX_SIZE, Math.max(qr.MIN_SIZE, Number(settings.size) || DEFAULT_SETTINGS.size));
    if (qr.LEVELS.indexOf(settings.level) === -1) settings.level = DEFAULT_SETTINGS.level;
    if (['png', 'svg', 'both'].indexOf(settings.format) === -1) settings.format = DEFAULT_SETTINGS.format;
    settings.company = utils.collapseWhitespace(settings.company).slice(0, 120);
    return settings;
  }

  function saveSettings() {
    try {
      root.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (error) {
      /* ignore - settings simply will not persist */
    }
  }

  function vcardOptions() {
    return {
      defaultCompany: state.settings.company,
      include: {
        emergencyPhone: state.settings.includeEmergency,
        employeeId: state.settings.includeEmployeeId,
        bloodGroup: state.settings.includeBloodGroup
      }
    };
  }

  function syncSettingsForm() {
    dom.settingCompany.value = state.settings.company;
    dom.settingSize.value = String(state.settings.size);
    dom.settingLevel.value = state.settings.level;
    dom.settingFormat.value = state.settings.format;
    dom.settingIncludeEmergency.checked = state.settings.includeEmergency;
    dom.settingIncludeEmployeeId.checked = state.settings.includeEmployeeId;
    dom.settingIncludeBloodGroup.checked = state.settings.includeBloodGroup;
  }

  function readSettingsForm() {
    return {
      company: utils.collapseWhitespace(dom.settingCompany.value).slice(0, 120),
      size: Number(dom.settingSize.value) || DEFAULT_SETTINGS.size,
      level: dom.settingLevel.value,
      format: dom.settingFormat.value,
      includeEmergency: dom.settingIncludeEmergency.checked,
      includeEmployeeId: dom.settingIncludeEmployeeId.checked,
      includeBloodGroup: dom.settingIncludeBloodGroup.checked
    };
  }

  const applySettingsChange = utils.debounce(function () {
    const previous = state.settings;
    const next = readSettingsForm();
    state.settings = next;
    saveSettings();
    if (!state.contacts.length && !state.parsed) return;

    if (next.company !== previous.company) {
      rebuildContacts();
    } else if (next.size !== previous.size || next.level !== previous.level ||
      next.includeEmergency !== previous.includeEmergency ||
      next.includeEmployeeId !== previous.includeEmployeeId ||
      next.includeBloodGroup !== previous.includeBloodGroup) {
      generateAll();
    }
  }, 350);

  function resetSettings() {
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    saveSettings();
    syncSettingsForm();
    ui.toast('Settings reset to defaults.', { type: 'info' });
    if (state.parsed) rebuildContacts();
  }

  function toggleSettingsPanel(force) {
    const open = typeof force === 'boolean' ? force : dom.settingsPanel.hidden;
    dom.settingsPanel.hidden = !open;
    dom.settingsToggle.setAttribute('aria-expanded', String(open));
    if (open) dom.settingCompany.focus();
  }

  /* ------------------------------------------------------------------ */
  /* File intake                                                         */
  /* ------------------------------------------------------------------ */

  function looksLikeCsv(file) {
    const name = String(file.name || '').toLowerCase();
    if (/\.(csv|tsv|txt)$/.test(name)) return true;
    const type = String(file.type || '').toLowerCase();
    return type.indexOf('csv') !== -1 || type === 'text/plain' || type === 'text/tab-separated-values' ||
      type === 'application/vnd.ms-excel';
  }

  /** Decode bytes as UTF-8, falling back to UTF-16 (BOM) or Windows-1252. */
  function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16LE' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16BE' };
    }
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
    } catch (error) {
      return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
    }
  }

  function readAsArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read the file')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function handleFile(file) {
    if (!file) return;
    if (state.reading) {
      ui.toast('Please wait - the previous file is still being read.', { type: 'warning' });
      return;
    }

    if (!looksLikeCsv(file)) {
      ui.alert({
        type: 'error',
        title: 'Unsupported file',
        message: 'Please choose a CSV file (.csv). "' + file.name + '" does not look like one.'
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      ui.alert({
        type: 'error',
        title: 'File too large',
        message: 'The file is ' + utils.formatBytes(file.size) + '. The maximum supported size is ' +
          utils.formatBytes(MAX_FILE_BYTES) + '. Split the file and try again.'
      });
      return;
    }
    if (file.size === 0) {
      ui.alert({ type: 'error', title: 'Empty file', message: 'The selected file is empty.' });
      return;
    }

    state.reading = true;
    setBusy(true);
    showProgress(0, 'Reading ' + file.name + '…');

    readAsArrayBuffer(file).then(function (buffer) {
      state.reading = false;
      const decoded = decodeText(buffer);
      const parsed = csv.parse(decoded.text);
      const issues = parsed.issues.map(function (issue) {
        return { row: issue.row, level: 'warning', message: issue.message };
      });
      if (decoded.encoding !== 'UTF-8') {
        issues.unshift({
          row: 0,
          level: 'warning',
          message: 'The file is not UTF-8 encoded; it was decoded as ' + decoded.encoding +
            '. Save it as "CSV UTF-8" if names look wrong.'
        });
      }

      if (!parsed.headers.length || !parsed.rows.length) {
        setBusy(false);
        hideProgress();
        ui.alert({
          type: 'error',
          title: 'No data found',
          message: parsed.headers.length
            ? 'The file only contains a header row.'
            : 'The file appears to be empty or is not a valid CSV file.'
        });
        return;
      }

      const mapping = contactsLib.detectMapping(parsed.headers);
      if (!contactsLib.hasNameColumn(mapping)) {
        setBusy(false);
        hideProgress();
        ui.alert({
          type: 'error',
          title: 'Could not find a name column',
          message: 'The CSV needs a "First Name"/"Last Name" pair or a "Name" column. Columns found:',
          details: parsed.headers.filter(Boolean).slice(0, 30)
        });
        return;
      }

      const proceed = parsed.rows.length > LARGE_FILE_ROWS
        ? ui.confirm({
          type: 'warning',
          title: 'Large file',
          message: 'This file has ' + parsed.rows.length.toLocaleString() + ' rows. Generating that many QR codes ' +
            'works, but may take a while and use a lot of memory. Continue?',
          confirmText: 'Continue'
        })
        : Promise.resolve(true);

      return proceed.then(function (ok) {
        if (!ok) {
          setBusy(false);
          hideProgress();
          return;
        }
        releaseContacts();
        state.file = { name: file.name, size: file.size };
        state.parsed = parsed;
        state.parseIssues = issues;
        state.mapping = mapping;
        state.filter = '';
        dom.searchInput.value = '';
        setBusy(false);
        rebuildContacts();
      });
    }).catch(function (error) {
      console.error('Failed to read file', error);
      state.reading = false;
      setBusy(false);
      hideProgress();
      ui.alert({ type: 'error', title: 'Could not read the file', message: String(error && error.message || error) });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Contacts + rendering                                                */
  /* ------------------------------------------------------------------ */

  function releaseContacts() {
    state.generation += 1; // cancels any generation still in flight
    state.generating = false;
    ui.closeDialog(dom.previewDialog);
    state.contacts.forEach(function (contact) {
      if (contact.qr && contact.qr.url) URL.revokeObjectURL(contact.qr.url);
    });
    state.contacts = [];
  }

  /** (Re)build contact records from the parsed CSV + mapping, then render. */
  function rebuildContacts() {
    if (!state.parsed || !state.mapping) return;
    releaseContacts();

    const result = contactsLib.buildContacts(state.parsed, state.mapping, { defaultCompany: state.settings.company });
    const fileNames = contactsLib.fileBaseNames(result.contacts);
    result.contacts.forEach(function (contact, index) {
      contact.index = index;
      contact.fileBase = fileNames[index];
      contact.qr = null;
      contact.error = null;
      contact.vcard = '';
      contact.searchText = [contact.displayName, contact.designation, contact.employeeId, contact.email,
        contact.phone, contact.company].join(' ').toLowerCase();
    });

    state.contacts = result.contacts;
    state.skipped = result.skipped;
    state.issues = (state.parseIssues || []).concat(result.issues);

    renderMapping();
    renderIssues();
    renderTable();
    updateSummary();
    applyFilter();

    dom.emptyState.hidden = true;
    dom.summarySection.hidden = false;
    dom.resultsSection.hidden = state.contacts.length === 0;
    dom.mappingSection.hidden = false;

    if (!state.contacts.length) {
      hideProgress();
      setBusy(false);
      ui.alert({
        type: 'warning',
        title: 'No usable rows',
        message: 'Every row was skipped because no name could be found. Check the column mapping below.'
      });
      return;
    }
    generateAll();
  }

  function renderMapping() {
    dom.mappingGrid.textContent = '';
    const headers = state.parsed.headers;
    contactsLib.FIELDS.forEach(function (field) {
      const id = 'map-' + field.key;
      const label = ui.el('label', { className: 'mapping-label', for: id, text: field.label });
      const select = ui.el('select', { id: id, className: 'mapping-select', 'data-field': field.key });
      select.appendChild(ui.el('option', { value: '-1', text: '— not used —' }));
      headers.forEach(function (header, index) {
        if (header === '') return;
        const option = ui.el('option', { value: String(index), text: header });
        select.appendChild(option);
      });
      select.value = String(state.mapping[field.key]);
      if (select.value !== String(state.mapping[field.key])) select.value = '-1';
      const row = ui.el('div', { className: 'mapping-row' }, [label, select]);
      dom.mappingGrid.appendChild(row);
    });
  }

  function onMappingChange(event) {
    const select = event.target.closest('select[data-field]');
    if (!select) return;
    const key = select.getAttribute('data-field');
    const index = Number(select.value);
    const next = Object.assign({}, state.mapping);

    // Keep the mapping one-to-one: un-assign the column from any other field.
    Object.keys(next).forEach(function (otherKey) {
      if (otherKey !== key && next[otherKey] === index && index !== -1) next[otherKey] = -1;
    });
    next[key] = index;

    if (!contactsLib.hasNameColumn(next)) {
      ui.toast('At least one name column (First/Last/Full Name) must stay mapped.', { type: 'warning' });
      select.value = String(state.mapping[key]);
      return;
    }
    state.mapping = next;
    rebuildContacts();
  }

  function renderIssues() {
    const issues = state.issues;
    dom.issuesSection.hidden = issues.length === 0;
    dom.issuesList.textContent = '';
    if (!issues.length) return;

    const errors = issues.filter(function (issue) { return issue.level === 'error'; }).length;
    const warnings = issues.length - errors;
    const parts = [];
    if (errors) parts.push(errors + (errors === 1 ? ' row skipped' : ' rows skipped'));
    if (warnings) parts.push(warnings + (warnings === 1 ? ' warning' : ' warnings'));
    dom.issuesSummaryText.textContent = parts.join(', ');

    const fragment = document.createDocumentFragment();
    issues.slice(0, MAX_LISTED_ISSUES).forEach(function (issue) {
      fragment.appendChild(ui.el('li', { className: 'issue issue-' + issue.level }, [
        ui.icon(issue.level === 'error' ? 'alert-circle' : 'alert-triangle', 'issue-icon'),
        ui.el('span', { text: issue.message })
      ]));
    });
    if (issues.length > MAX_LISTED_ISSUES) {
      fragment.appendChild(ui.el('li', { className: 'issue issue-more', text: '… and ' + (issues.length - MAX_LISTED_ISSUES) + ' more.' }));
    }
    dom.issuesList.appendChild(fragment);
  }

  function renderTable() {
    const showEmployeeId = state.mapping.employeeId !== -1;
    const showCompany = state.mapping.company !== -1;
    dom.tableHead.textContent = '';
    dom.tableBody.textContent = '';

    const headRow = ui.el('tr');
    const columns = [
      { label: '#', className: 'col-row' },
      { label: 'Employee', className: 'col-employee' }
    ];
    if (showEmployeeId) columns.push({ label: 'Employee ID', className: 'col-id' });
    columns.push({ label: 'Contact', className: 'col-contact' });
    columns.push({ label: 'Email', className: 'col-email' });
    if (showCompany) columns.push({ label: 'Company', className: 'col-company' });
    columns.push({ label: 'Status', className: 'col-status' });
    columns.push({ label: 'QR Code', className: 'col-qr' });
    columns.forEach(function (column) {
      headRow.appendChild(ui.el('th', { scope: 'col', className: column.className, text: column.label }));
    });
    dom.tableHead.appendChild(headRow);

    const fragment = document.createDocumentFragment();
    state.contacts.forEach(function (contact) {
      const tr = ui.el('tr', { 'data-index': String(contact.index) });

      tr.appendChild(ui.el('td', { className: 'col-row', text: String(contact.row) }));

      const nameCell = ui.el('td', { className: 'col-employee' }, [
        ui.el('div', { className: 'employee-name', text: contact.displayName })
      ]);
      if (contact.designation) {
        nameCell.appendChild(ui.el('div', { className: 'employee-title', text: contact.designation }));
      }
      tr.appendChild(nameCell);

      if (showEmployeeId) tr.appendChild(ui.el('td', { className: 'col-id', text: contact.employeeId || '—' }));

      const contactCell = ui.el('td', { className: 'col-contact' }, [
        ui.el('div', { text: contact.phone || '—' })
      ]);
      if (contact.emergencyPhone && state.settings.includeEmergency) {
        contactCell.appendChild(ui.el('div', { className: 'employee-emergency', title: 'Emergency contact', text: 'Emergency: ' + contact.emergencyPhone }));
      }
      tr.appendChild(contactCell);

      tr.appendChild(ui.el('td', { className: 'col-email', text: contact.email || '—' }));
      if (showCompany) tr.appendChild(ui.el('td', { className: 'col-company', text: contact.company || '—' }));

      tr.appendChild(ui.el('td', { className: 'col-status' }, [statusBadge(contact)]));

      const button = ui.el('button', {
        type: 'button',
        className: 'qr-thumb',
        'data-index': String(contact.index),
        'aria-label': 'Preview QR code for ' + contact.displayName,
        disabled: ''
      }, [ui.el('span', { className: 'qr-placeholder', 'aria-hidden': 'true' })]);
      tr.appendChild(ui.el('td', { className: 'col-qr' }, [button]));

      fragment.appendChild(tr);
    });
    dom.tableBody.appendChild(fragment);
  }

  function statusBadge(contact) {
    if (contact.error) {
      return ui.el('span', { className: 'badge badge-error', title: contact.error }, [ui.icon('alert-circle'), 'Failed']);
    }
    if (contact.warnings.length) {
      return ui.el('span', { className: 'badge badge-warning', title: contact.warnings.join('\n') }, [
        ui.icon('alert-triangle'), contact.warnings.length === 1 ? '1 warning' : contact.warnings.length + ' warnings'
      ]);
    }
    if (contact.qr) {
      return ui.el('span', { className: 'badge badge-ok', title: 'QR version ' + contact.qr.version + ', ' + contact.qr.bytes + ' bytes' }, [ui.icon('check-circle'), 'Ready']);
    }
    return ui.el('span', { className: 'badge badge-pending', text: 'Pending' });
  }

  function updateRow(contact) {
    const tr = dom.tableBody.querySelector('tr[data-index="' + contact.index + '"]');
    if (!tr) return;
    const statusCell = tr.querySelector('.col-status');
    statusCell.textContent = '';
    statusCell.appendChild(statusBadge(contact));

    const button = tr.querySelector('.qr-thumb');
    button.textContent = '';
    if (contact.qr) {
      const img = ui.el('img', { src: contact.qr.url, alt: 'QR code for ' + contact.displayName, width: '88', height: '88', decoding: 'async' });
      button.appendChild(img);
      button.disabled = false;
    } else if (contact.error) {
      button.appendChild(ui.el('span', { className: 'qr-placeholder qr-placeholder-error', 'aria-hidden': 'true' }, [ui.icon('alert-circle')]));
      button.disabled = true;
    } else {
      button.appendChild(ui.el('span', { className: 'qr-placeholder', 'aria-hidden': 'true' }));
      button.disabled = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* QR generation                                                       */
  /* ------------------------------------------------------------------ */

  /** Concurrent canvases per batch, scaled down for large images to cap memory use. */
  function batchSize() {
    const ratio = Math.pow(512 / state.settings.size, 2);
    return Math.max(2, Math.min(MAX_BATCH_SIZE, Math.floor(MAX_BATCH_SIZE * ratio)));
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(function () { resolve(); });
      else setTimeout(resolve, 0);
    });
  }

  function generateOne(contact) {
    const options = vcardOptions();
    const text = vcard.build(contact, options);
    contact.vcard = text;
    if (contact.qr && contact.qr.url) URL.revokeObjectURL(contact.qr.url);
    contact.qr = null;
    contact.error = null;

    return qr.render(text, { size: state.settings.size, level: state.settings.level, title: contact.displayName })
      .then(function (result) {
        contact.qr = {
          png: result.png,
          svg: result.svg,
          url: URL.createObjectURL(result.png),
          version: result.version,
          bytes: result.bytes
        };
      })
      .catch(function (error) {
        contact.error = String(error && error.message || error);
      });
  }

  function generateAll() {
    if (!state.contacts.length) return Promise.resolve();
    const token = ++state.generation;
    state.generating = true;
    setBusy(true);
    ui.closeDialog(dom.previewDialog);

    const total = state.contacts.length;
    let done = 0;
    showProgress(0, 'Generating QR codes: 0 of ' + total);
    // Reset row visuals so stale codes never show next to new settings.
    state.contacts.forEach(function (contact) {
      if (contact.qr && contact.qr.url) URL.revokeObjectURL(contact.qr.url);
      contact.qr = null;
      contact.error = null;
      updateRow(contact);
    });

    const size = batchSize();
    function processBatch(start) {
      if (token !== state.generation) return Promise.resolve();
      const batch = state.contacts.slice(start, start + size);
      if (!batch.length) return Promise.resolve();
      return Promise.all(batch.map(generateOne)).then(function () {
        if (token !== state.generation) return;
        batch.forEach(updateRow);
        done += batch.length;
        showProgress(Math.round((done / total) * 100), 'Generating QR codes: ' + done + ' of ' + total);
        updateSummary();
        return nextFrame().then(function () { return processBatch(start + size); });
      });
    }

    return processBatch(0).then(function () {
      if (token !== state.generation) return;
      state.generating = false;
      setBusy(false);
      const failed = state.contacts.filter(function (contact) { return contact.error; }).length;
      updateSummary();
      showProgress(100, failed ? 'Finished with ' + failed + ' failure' + (failed === 1 ? '' : 's') : 'All QR codes generated');
      setTimeout(function () { if (token === state.generation) hideProgress(); }, 1500);
      if (failed) {
        ui.toast(failed + ' QR code' + (failed === 1 ? '' : 's') + ' could not be generated. See the Status column.', { type: 'error' });
      } else {
        ui.toast(total + ' QR code' + (total === 1 ? '' : 's') + ' ready.', { type: 'success' });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Summary / progress / filter                                         */
  /* ------------------------------------------------------------------ */

  function updateSummary() {
    const generated = state.contacts.filter(function (contact) { return contact.qr; }).length;
    const failed = state.contacts.filter(function (contact) { return contact.error; }).length;
    const warnings = state.issues.filter(function (issue) { return issue.level === 'warning'; }).length;
    dom.statEmployees.textContent = String(state.contacts.length);
    dom.statGenerated.textContent = String(generated);
    dom.statWarnings.textContent = String(warnings);
    dom.statSkipped.textContent = String(state.skipped + failed);
    dom.statFile.textContent = state.file ? state.file.name : '—';
    dom.statFileSize.textContent = state.file ? utils.formatBytes(state.file.size) : '';

    const hasCodes = generated > 0 && !state.generating;
    dom.downloadZipBtn.disabled = !hasCodes;
    dom.downloadPngBtn.disabled = !hasCodes;
    dom.downloadVcfBtn.disabled = state.contacts.length === 0 || state.generating;
    dom.clearBtn.disabled = !state.parsed;
  }

  function showProgress(percent, message) {
    dom.progressSection.hidden = false;
    dom.progressBar.style.width = percent + '%';
    dom.progressBar.parentElement.setAttribute('aria-valuenow', String(percent));
    dom.progressText.textContent = message;
  }

  function hideProgress() {
    dom.progressSection.hidden = true;
  }

  function setBusy(busy) {
    state.busy = busy;
    dom.dropzone.classList.toggle('is-busy', busy);
    dom.browseBtn.disabled = busy;
  }

  function applyFilter() {
    const query = state.filter.trim().toLowerCase();
    let visible = 0;
    const rows = dom.tableBody.children;
    for (let i = 0; i < rows.length; i++) {
      const contact = state.contacts[Number(rows[i].getAttribute('data-index'))];
      const match = !query || (contact && contact.searchText.indexOf(query) !== -1);
      rows[i].hidden = !match;
      if (match) visible += 1;
    }
    dom.resultsCount.textContent = query
      ? visible + ' of ' + state.contacts.length + ' shown'
      : state.contacts.length + (state.contacts.length === 1 ? ' employee' : ' employees');
    dom.noResults.hidden = !(query && visible === 0 && state.contacts.length > 0);
  }

  const onSearchInput = utils.debounce(function () {
    state.filter = dom.searchInput.value;
    applyFilter();
  }, 120);

  /* ------------------------------------------------------------------ */
  /* Preview dialog                                                      */
  /* ------------------------------------------------------------------ */

  let previewIndex = -1;

  function openPreview(index) {
    const contact = state.contacts[index];
    if (!contact || !contact.qr) return;
    previewIndex = index;

    dom.previewTitle.textContent = contact.displayName;
    dom.previewSubtitle.textContent = [contact.designation, contact.company].filter(Boolean).join(' · ');
    dom.previewImage.src = contact.qr.url;
    dom.previewImage.alt = 'QR code for ' + contact.displayName;
    dom.previewVcard.textContent = contact.vcard;
    dom.previewMeta.textContent = 'QR version ' + contact.qr.version + ' · ' + contact.qr.bytes + ' bytes · ' +
      'error correction ' + state.settings.level + ' · ' + state.settings.size + ' px';
    ui.openDialog(dom.previewDialog);
  }

  function previewContact() {
    return state.contacts[previewIndex] || null;
  }

  /* ------------------------------------------------------------------ */
  /* Downloads                                                           */
  /* ------------------------------------------------------------------ */

  function saveBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function svgBlob(svg) {
    return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  }

  function vcfBlob(text) {
    return new Blob([text], { type: 'text/vcard;charset=utf-8' });
  }

  function imageFormats() {
    return state.settings.format === 'both' ? ['png', 'svg'] : [state.settings.format];
  }

  function bundleName() {
    return utils.sanitizeFilename(utils.baseName(state.file ? state.file.name : ''), 'employees', 60) + '-qr-codes';
  }

  function withButtonBusy(button, label, task) {
    const original = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-busy');
    const setLabel = function (text) {
      button.textContent = '';
      button.appendChild(ui.el('span', { className: 'spinner', 'aria-hidden': 'true' }));
      button.appendChild(document.createTextNode(' ' + text));
    };
    setLabel(label);
    return Promise.resolve().then(function () { return task(setLabel); }).finally(function () {
      button.innerHTML = original;
      button.classList.remove('is-busy');
      button.disabled = false;
      updateSummary();
    });
  }

  function downloadZip() {
    if (typeof root.JSZip === 'undefined') {
      ui.alert({ type: 'error', title: 'ZIP support unavailable', message: 'vendor/jszip.min.js failed to load.' });
      return;
    }
    const ready = state.contacts.filter(function (contact) { return contact.qr; });
    if (!ready.length) return;

    withButtonBusy(dom.downloadZipBtn, 'Packing…', function (setLabel) {
      const zip = new root.JSZip();
      const rootFolder = zip.folder(bundleName());
      const images = rootFolder.folder('qr-codes');
      const vcards = rootFolder.folder('vcards');
      const formats = imageFormats();
      const manifest = [['File', 'Row', 'First Name', 'Last Name', 'Employee ID', 'Designation', 'Company', 'Phone', 'Email', 'QR Generated', 'Warnings']];

      state.contacts.forEach(function (contact) {
        if (contact.qr) {
          if (formats.indexOf('png') !== -1) images.file(contact.fileBase + '.png', contact.qr.png);
          if (formats.indexOf('svg') !== -1) images.file(contact.fileBase + '.svg', contact.qr.svg);
        }
        vcards.file(contact.fileBase + '.vcf', contact.vcard || vcard.build(contact, vcardOptions()));
        manifest.push([
          contact.fileBase, contact.row, contact.firstName, contact.lastName, contact.employeeId, contact.designation,
          contact.company, contact.phone, contact.email, contact.qr ? 'yes' : 'no', contact.warnings.join(' | ')
        ]);
      });

      rootFolder.file('all-contacts.vcf', vcard.buildMany(state.contacts, vcardOptions()));
      rootFolder.file('manifest.csv', '\uFEFF' + csv.stringify(manifest));
      rootFolder.file('README.txt', [
        'Employee QR Code Generator v' + APP_VERSION,
        'Source file: ' + (state.file ? state.file.name : 'unknown'),
        'Generated: ' + new Date().toISOString(),
        '',
        'qr-codes/        One QR code per employee (' + formats.join(' + ').toUpperCase() + '). Scanning it adds the employee to the phone\'s contacts.',
        'vcards/          The same contact data as individual .vcf files.',
        'all-contacts.vcf Every contact in one importable file.',
        'manifest.csv     Maps each file name back to the source row.',
        '',
        'QR settings: ' + state.settings.size + ' px, error correction ' + state.settings.level + '.'
      ].join('\r\n'));

      return zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        function (meta) { setLabel('Packing… ' + Math.round(meta.percent) + '%'); }
      ).then(function (blob) {
        saveBlob(blob, bundleName() + '.zip');
        ui.toast('ZIP with ' + ready.length + ' QR code' + (ready.length === 1 ? '' : 's') + ' downloaded (' + utils.formatBytes(blob.size) + ').', { type: 'success' });
      });
    }).catch(function (error) {
      console.error('ZIP creation failed', error);
      ui.alert({ type: 'error', title: 'ZIP creation failed', message: String(error && error.message || error) });
    });
  }

  function downloadIndividually() {
    const ready = state.contacts.filter(function (contact) { return contact.qr; });
    if (!ready.length) return;
    const formats = imageFormats();
    const fileCount = ready.length * formats.length;

    const confirmation = fileCount > 3
      ? ui.confirm({
        type: 'info',
        title: 'Download ' + fileCount + ' files?',
        message: 'Each QR code will be saved as a separate file. Your browser may ask for permission to download multiple files - please allow it. For large teams the ZIP download is more convenient.',
        confirmText: 'Download files'
      })
      : Promise.resolve(true);

    confirmation.then(function (ok) {
      if (!ok) return;
      return withButtonBusy(dom.downloadPngBtn, 'Downloading…', function (setLabel) {
        let saved = 0;
        const queue = [];
        ready.forEach(function (contact) {
          if (formats.indexOf('png') !== -1) queue.push({ blob: contact.qr.png, name: contact.fileBase + '.png' });
          if (formats.indexOf('svg') !== -1) queue.push({ blob: svgBlob(contact.qr.svg), name: contact.fileBase + '.svg' });
        });
        return queue.reduce(function (chain, item) {
          return chain.then(function () {
            saveBlob(item.blob, item.name);
            saved += 1;
            setLabel('Downloading… ' + saved + ' of ' + queue.length);
            return new Promise(function (resolve) { setTimeout(resolve, INDIVIDUAL_DOWNLOAD_DELAY); });
          });
        }, Promise.resolve()).then(function () {
          ui.toast(saved + ' file' + (saved === 1 ? '' : 's') + ' sent to your downloads folder.', { type: 'success' });
        });
      });
    });
  }

  function downloadVcf() {
    if (!state.contacts.length) return;
    const text = vcard.buildMany(state.contacts, vcardOptions());
    saveBlob(vcfBlob(text), bundleName().replace(/-qr-codes$/, '') + '-contacts.vcf');
    ui.toast('vCard file with ' + state.contacts.length + ' contact' + (state.contacts.length === 1 ? '' : 's') + ' downloaded.', { type: 'success' });
  }

  /* ------------------------------------------------------------------ */
  /* Clear                                                               */
  /* ------------------------------------------------------------------ */

  function resetView() {
    releaseContacts();
    state.file = null;
    state.parsed = null;
    state.parseIssues = [];
    state.mapping = null;
    state.issues = [];
    state.skipped = 0;
    state.generating = false;
    state.filter = '';

    dom.fileInput.value = '';
    dom.searchInput.value = '';
    dom.tableHead.textContent = '';
    dom.tableBody.textContent = '';
    dom.issuesList.textContent = '';
    dom.mappingGrid.textContent = '';
    dom.summarySection.hidden = true;
    dom.resultsSection.hidden = true;
    dom.issuesSection.hidden = true;
    dom.mappingSection.hidden = true;
    dom.noResults.hidden = true;
    dom.emptyState.hidden = false;
    hideProgress();
    setBusy(false);
    updateSummary();
  }

  function clearAll() {
    if (!state.parsed) return;
    ui.confirm({
      type: 'warning',
      title: 'Clear everything?',
      message: 'This removes the loaded CSV data and all generated QR codes from this page. Nothing on your disk is affected.',
      confirmText: 'Clear',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      resetView();
      ui.toast('Cleared. Drop another CSV file to start again.', { type: 'info' });
      dom.browseBtn.focus();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Bootstrapping                                                       */
  /* ------------------------------------------------------------------ */

  function cacheDom() {
    const ids = [
      'themeToggle', 'settingsToggle', 'settingsPanel', 'settingsClose', 'settingsReset',
      'settingCompany', 'settingSize', 'settingLevel', 'settingFormat',
      'settingIncludeEmergency', 'settingIncludeEmployeeId', 'settingIncludeBloodGroup',
      'dropzone', 'fileInput', 'browseBtn',
      'progressSection', 'progressBar', 'progressText',
      'summarySection', 'statEmployees', 'statGenerated', 'statWarnings', 'statSkipped', 'statFile', 'statFileSize',
      'issuesSection', 'issuesSummaryText', 'issuesList',
      'mappingSection', 'mappingGrid',
      'resultsSection', 'searchInput', 'resultsCount', 'noResults',
      'downloadZipBtn', 'downloadPngBtn', 'downloadVcfBtn', 'clearBtn',
      'tableHead', 'tableBody', 'emptyState',
      'previewDialog', 'previewTitle', 'previewSubtitle', 'previewImage', 'previewMeta', 'previewVcard',
      'previewDownloadPng', 'previewDownloadSvg', 'previewDownloadVcf', 'previewCopy', 'previewClose',
      'appVersion'
    ];
    ids.forEach(function (id) {
      dom[id] = document.getElementById(id);
      if (!dom[id]) throw new Error('Missing element #' + id);
    });
  }

  function checkBrowserSupport() {
    const missing = [];
    if (typeof root.TextDecoder === 'undefined') missing.push('TextDecoder');
    if (typeof root.Blob === 'undefined' || typeof root.URL === 'undefined' || typeof root.URL.createObjectURL !== 'function') missing.push('Blob URLs');
    if (typeof document.createElement('canvas').toBlob !== 'function') missing.push('canvas.toBlob');
    if (typeof root.Promise === 'undefined') missing.push('Promise');
    return missing;
  }

  function updateThemeButton() {
    const current = theme.get();
    dom.themeToggle.setAttribute('aria-label', current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    dom.themeToggle.setAttribute('title', current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    dom.themeToggle.querySelector('.icon-sun').hidden = current !== 'dark';
    dom.themeToggle.querySelector('.icon-moon').hidden = current === 'dark';
  }

  function bindEvents() {
    dom.themeToggle.addEventListener('click', function () {
      theme.toggle();
      updateThemeButton();
    });
    dom.settingsToggle.addEventListener('click', function () { toggleSettingsPanel(); });
    dom.settingsClose.addEventListener('click', function () { toggleSettingsPanel(false); dom.settingsToggle.focus(); });
    dom.settingsReset.addEventListener('click', resetSettings);
    [dom.settingCompany, dom.settingSize, dom.settingLevel, dom.settingFormat,
      dom.settingIncludeEmergency, dom.settingIncludeEmployeeId, dom.settingIncludeBloodGroup].forEach(function (input) {
      input.addEventListener('change', applySettingsChange);
    });

    dom.browseBtn.addEventListener('click', function () { dom.fileInput.click(); });
    dom.fileInput.addEventListener('change', function () {
      const file = dom.fileInput.files && dom.fileInput.files[0];
      if (file) handleFile(file);
      dom.fileInput.value = '';
    });

    dom.dropzone.addEventListener('click', function (event) {
      if (event.target.closest('button, a')) return;
      dom.fileInput.click();
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      dom.dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        dom.dropzone.classList.add('is-dragover');
      });
    });
    dom.dropzone.addEventListener('dragleave', function (event) {
      if (!dom.dropzone.contains(event.relatedTarget)) dom.dropzone.classList.remove('is-dragover');
    });
    dom.dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      dom.dropzone.classList.remove('is-dragover');
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (event.dataTransfer.files && event.dataTransfer.files.length > 1) {
        ui.toast('Only the first file was used; drop one CSV file at a time.', { type: 'warning' });
      }
      if (file) handleFile(file);
    });
    // Dropping a file anywhere else must not navigate the page away.
    ['dragover', 'drop'].forEach(function (name) {
      document.addEventListener(name, function (event) {
        if (!dom.dropzone.contains(event.target)) event.preventDefault();
      });
    });

    dom.mappingGrid.addEventListener('change', onMappingChange);
    dom.searchInput.addEventListener('input', onSearchInput);
    dom.tableBody.addEventListener('click', function (event) {
      const button = event.target.closest('.qr-thumb');
      if (button && !button.disabled) openPreview(Number(button.getAttribute('data-index')));
    });

    dom.downloadZipBtn.addEventListener('click', downloadZip);
    dom.downloadPngBtn.addEventListener('click', downloadIndividually);
    dom.downloadVcfBtn.addEventListener('click', downloadVcf);
    dom.clearBtn.addEventListener('click', clearAll);

    dom.previewClose.addEventListener('click', function () { ui.closeDialog(dom.previewDialog); });
    dom.previewDownloadPng.addEventListener('click', function () {
      const contact = previewContact();
      if (contact && contact.qr) saveBlob(contact.qr.png, contact.fileBase + '.png');
    });
    dom.previewDownloadSvg.addEventListener('click', function () {
      const contact = previewContact();
      if (contact && contact.qr) saveBlob(svgBlob(contact.qr.svg), contact.fileBase + '.svg');
    });
    dom.previewDownloadVcf.addEventListener('click', function () {
      const contact = previewContact();
      if (contact) saveBlob(vcfBlob(contact.vcard), contact.fileBase + '.vcf');
    });
    dom.previewCopy.addEventListener('click', function () {
      const contact = previewContact();
      if (!contact) return;
      const done = function () { ui.toast('vCard text copied to the clipboard.', { type: 'success', duration: 2500 }); };
      const fail = function () { ui.toast('Copying is not available in this browser.', { type: 'warning' }); };
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(contact.vcard).then(done, fail);
      } else {
        fail();
      }
    });

    // Keyboard shortcut: "/" focuses the search box when results are visible.
    document.addEventListener('keydown', function (event) {
      const target = event.target && typeof event.target.closest === 'function' ? event.target : null;
      if (event.key === '/' && !dom.resultsSection.hidden && !(target && target.closest('input, textarea, select, [contenteditable]'))) {
        event.preventDefault();
        dom.searchInput.focus();
      }
    });
  }

  function init() {
    cacheDom();
    dom.appVersion.textContent = 'v' + APP_VERSION;
    syncSettingsForm();
    updateThemeButton();
    bindEvents();
    resetView();

    const missing = checkBrowserSupport();
    if (missing.length) {
      ui.alert({
        type: 'error',
        title: 'Browser not supported',
        message: 'This browser lacks features the app needs: ' + missing.join(', ') + '. Please use a current version of Chrome, Edge, Firefox or Safari.'
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a tiny read-only surface for debugging / integration tests.
  QRGen.app = {
    version: APP_VERSION,
    getState: function () { return state; },
    handleFile: handleFile
  };
}(typeof self !== 'undefined' ? self : this));
