/**
 * Small, dependency-free CSV parser/serialiser (RFC 4180 compatible).
 *
 * Handles:
 *  - quoted fields, escaped quotes ("") and line breaks inside quotes
 *  - CRLF, LF and CR line endings (mixed is fine)
 *  - a leading UTF-8 byte-order mark
 *  - delimiter auto-detection (",", ";", tab, "|") for locale-specific exports
 *  - trailing empty columns produced by spreadsheet exports
 *
 * Exposed as `QRGen.csv` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QRGen = root.QRGen || {};
    root.QRGen.csv = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

  function stripBOM(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }

  /** First logical line of the file, honouring quotes. */
  function firstLine(text) {
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
        return text.slice(0, i);
      }
    }
    return text;
  }

  function countOutsideQuotes(line, delimiter) {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === delimiter) count += 1;
    }
    return count;
  }

  /**
   * Guess the delimiter from the header line. Falls back to a comma.
   * @param {string} text
   * @returns {string}
   */
  function detectDelimiter(text) {
    const line = firstLine(stripBOM(String(text == null ? '' : text)));
    let best = ',';
    let bestCount = 0;
    CANDIDATE_DELIMITERS.forEach(function (delimiter) {
      const count = countOutsideQuotes(line, delimiter);
      if (count > bestCount) {
        best = delimiter;
        bestCount = count;
      }
    });
    return best;
  }

  /**
   * Tokenise CSV text into an array of rows (arrays of strings).
   * @param {string} text
   * @param {string} delimiter single character
   * @returns {{ rows: string[][], unterminatedQuote: boolean }}
   */
  function tokenize(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let fieldStart = true;
    const length = text.length;

    for (let i = 0; i < length; i++) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"' && fieldStart) {
        inQuotes = true;
        fieldStart = false;
        continue;
      }
      if (ch === delimiter) {
        row.push(field);
        field = '';
        fieldStart = true;
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        fieldStart = true;
        continue;
      }
      // Plain character: consume the whole run up to the next delimiter or
      // line break in one slice instead of appending char by char.
      let end = i + 1;
      while (end < length) {
        const next = text[end];
        if (next === delimiter || next === '\n' || next === '\r') break;
        end += 1;
      }
      field += text.slice(i, end);
      fieldStart = false;
      i = end - 1;
    }

    if (field !== '' || row.length > 0 || !fieldStart) {
      row.push(field);
      rows.push(row);
    }

    return { rows: rows, unterminatedQuote: inQuotes };
  }

  /**
   * Parse CSV text into headers + data rows.
   *
   * Rows that are completely blank are dropped. Data rows shorter than the
   * header are padded with empty strings; rows that are longer are kept
   * intact but reported in `issues` so the caller can warn the user.
   *
   * @param {string} text
   * @param {{ delimiter?: string, trim?: boolean }} [options]
   * @returns {{
   *   headers: string[],
   *   rows: string[][],
   *   lines: number[],          // 1-based record number of each row in the file (header = 1)
   *   delimiter: string,
   *   issues: { row: number, type: string, message: string }[],
   *   totalRecords: number      // non-empty records including the header
   * }}
   */
  function parse(text, options) {
    if (typeof text !== 'string') {
      throw new TypeError('CSV input must be a string');
    }
    options = options || {};
    const source = stripBOM(text);
    const delimiter = options.delimiter || detectDelimiter(source);
    const trim = options.trim !== false;

    const tokenized = tokenize(source, delimiter);
    const issues = [];
    if (tokenized.unterminatedQuote) {
      issues.push({
        row: 0,
        type: 'unterminated-quote',
        message: 'The file contains an unterminated quote; the last rows may be malformed.'
      });
    }

    const records = [];
    const recordNumbers = [];
    tokenized.rows.forEach(function (cells, index) {
      const values = trim ? cells.map(function (cell) { return cell.trim(); }) : cells;
      const hasContent = values.some(function (cell) { return cell !== ''; });
      if (hasContent) {
        records.push(values);
        recordNumbers.push(index + 1);
      }
    });

    if (records.length === 0) {
      return { headers: [], rows: [], lines: [], delimiter: delimiter, issues: issues, totalRecords: 0 };
    }

    const headers = records[0].slice();
    while (headers.length && headers[headers.length - 1] === '') headers.pop();

    const rows = [];
    const lines = [];
    for (let i = 1; i < records.length; i++) {
      let cells = records[i].slice();
      while (cells.length > headers.length && cells[cells.length - 1] === '') cells.pop();

      if (cells.length > headers.length) {
        issues.push({
          row: recordNumbers[i],
          type: 'extra-fields',
          message: 'Row ' + recordNumbers[i] + ' has ' + cells.length + ' fields but the header has ' +
            headers.length + '. Values containing the delimiter must be wrapped in double quotes.'
        });
      } else if (cells.length < headers.length) {
        while (cells.length < headers.length) cells.push('');
      }
      rows.push(cells);
      lines.push(recordNumbers[i]);
    }

    return {
      headers: headers,
      rows: rows,
      lines: lines,
      delimiter: delimiter,
      issues: issues,
      totalRecords: records.length
    };
  }

  /**
   * Quote a single CSV value when needed.
   * @param {unknown} value
   * @param {string} delimiter
   */
  function escapeValue(value, delimiter) {
    const text = value == null ? '' : String(value);
    if (text === '') return '';
    const needsQuotes = text.indexOf(delimiter) !== -1 || /["\r\n]/.test(text) ||
      text[0] === ' ' || text[text.length - 1] === ' ';
    return needsQuotes ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  /**
   * Serialise rows to CSV text (CRLF line endings, as per RFC 4180).
   * @param {unknown[][]} rows
   * @param {{ delimiter?: string }} [options]
   * @returns {string}
   */
  function stringify(rows, options) {
    const delimiter = (options && options.delimiter) || ',';
    return rows.map(function (row) {
      return row.map(function (value) { return escapeValue(value, delimiter); }).join(delimiter);
    }).join('\r\n') + '\r\n';
  }

  return {
    parse: parse,
    stringify: stringify,
    detectDelimiter: detectDelimiter
  };
}));
