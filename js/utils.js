/**
 * Shared, framework-free helper functions.
 *
 * Exposed as `QRGen.utils` in the browser and as a CommonJS module in Node
 * (so the same code can be unit-tested without a bundler).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QRGen = root.QRGen || {};
    root.QRGen.utils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Anything that is not a letter, number, dot, underscore or hyphen.
  const INVALID_FILENAME_CHARS = /[^\p{L}\p{N}._-]+/gu;
  // Names that are illegal on Windows regardless of extension.
  const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  // Pragmatic e-mail check: something@something.tld, no whitespace.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Turn an arbitrary string (e.g. an employee name) into a safe file name
   * fragment that works on Windows, macOS and Linux.
   *
   * @param {unknown} value      Raw value.
   * @param {string}  [fallback] Used when nothing usable remains.
   * @param {number}  [maxLength]
   * @returns {string}
   */
  function sanitizeFilename(value, fallback, maxLength) {
    fallback = fallback || 'employee';
    maxLength = maxLength || 80;

    let name = String(value == null ? '' : value)
      .normalize('NFKC')
      .trim()
      .replace(INVALID_FILENAME_CHARS, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[_.-]+|[_.-]+$/g, '');

    if (name.length > maxLength) {
      name = name.slice(0, maxLength).replace(/[_.-]+$/g, '');
    }
    if (!name || WINDOWS_RESERVED_NAMES.test(name)) {
      name = fallback;
    }
    return name;
  }

  /**
   * De-duplicate a list of file names (case-insensitively, because most
   * desktop file systems are case-insensitive) by appending `-2`, `-3`, ...
   *
   * @param {string[]} names
   * @returns {string[]}
   */
  function makeUniqueNames(names) {
    const used = new Set();
    const nextSuffix = new Map(); // lower-cased base name -> next counter to try
    return names.map(function (name) {
      const key = name.toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        return name;
      }
      // Resume from the last counter used for this base name so that long
      // runs of duplicates stay linear instead of quadratic.
      let counter = nextSuffix.get(key) || 2;
      let candidate;
      let candidateKey;
      do {
        candidate = name + '-' + counter;
        candidateKey = candidate.toLowerCase();
        counter += 1;
      } while (used.has(candidateKey));
      nextSuffix.set(key, counter);
      used.add(candidateKey);
      return candidate;
    });
  }

  /**
   * Human readable byte size (e.g. "12.4 KB").
   * @param {number} bytes
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    const text = unit === 0 ? String(value) : value.toFixed(value < 10 ? 2 : 1);
    return text + ' ' + units[unit];
  }

  /**
   * Collapse runs of whitespace and trim.
   * @param {unknown} value
   * @returns {string}
   */
  function collapseWhitespace(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  /**
   * Light-touch phone normalisation: trims, collapses whitespace and removes
   * characters that can never appear in a phone number (letters excluded on
   * purpose so that values like "ext" survive). Keeps a leading "+".
   * @param {unknown} value
   * @returns {string}
   */
  function normalizePhone(value) {
    return collapseWhitespace(value).replace(/[^\d+()\-. extEXT#*,;]/g, '').replace(/[,;]+/g, '').trim();
  }

  /**
   * Only the digits of a phone number - useful for comparisons.
   * @param {unknown} value
   * @returns {string}
   */
  function phoneDigits(value) {
    return String(value == null ? '' : value).replace(/\D+/g, '');
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isValidEmail(value) {
    return EMAIL_PATTERN.test(String(value == null ? '' : value).trim());
  }

  /**
   * Classic trailing debounce.
   * @template {Function} F
   * @param {F} fn
   * @param {number} wait milliseconds
   * @returns {F & { cancel: () => void }}
   */
  function debounce(fn, wait) {
    let timer = null;
    const debounced = function () {
      const args = arguments;
      const context = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        fn.apply(context, args);
      }, wait);
    };
    debounced.cancel = function () {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return debounced;
  }

  /**
   * Strip the extension from a file name ("people.csv" -> "people").
   * @param {string} fileName
   * @returns {string}
   */
  function baseName(fileName) {
    const name = String(fileName == null ? '' : fileName);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
  }

  return {
    sanitizeFilename: sanitizeFilename,
    makeUniqueNames: makeUniqueNames,
    formatBytes: formatBytes,
    collapseWhitespace: collapseWhitespace,
    normalizePhone: normalizePhone,
    phoneDigits: phoneDigits,
    isValidEmail: isValidEmail,
    debounce: debounce,
    baseName: baseName
  };
}));
