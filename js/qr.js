/**
 * Local QR code rendering (browser only).
 *
 * Wraps the vendored `qrcode-generator` library so that codes are produced
 * entirely on the user's machine - no contact data is ever sent to a
 * third-party image API. Produces both a crisp PNG (via canvas) and a
 * resolution-independent SVG for print workflows.
 */
(function (root) {
  'use strict';

  const lib = root.qrcode;
  if (!lib) {
    throw new Error('qrcode-generator library is not loaded (vendor/qrcode-generator.js)');
  }
  // The library defaults to a Latin-1-ish encoding; switch to UTF-8 so that
  // accented and non-Latin names scan correctly.
  if (lib.stringToBytesFuncs && lib.stringToBytesFuncs['UTF-8']) {
    lib.stringToBytes = lib.stringToBytesFuncs['UTF-8'];
  }

  /** Quiet zone required by the QR specification, in modules. */
  const QUIET_ZONE = 4;
  const LEVELS = ['L', 'M', 'Q', 'H'];
  const MIN_SIZE = 128;
  const MAX_SIZE = 4096;

  function clampSize(size) {
    const value = Number(size);
    if (!Number.isFinite(value)) return 512;
    return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
  }

  function normalizeLevel(level) {
    const value = String(level || 'M').toUpperCase();
    return LEVELS.indexOf(value) === -1 ? 'M' : value;
  }

  /**
   * Encode text into a QR symbol.
   * @param {string} text
   * @param {string} [level] error correction level L/M/Q/H
   * @returns {{ isDark: (r: number, c: number) => boolean, getModuleCount: () => number, version: number }}
   */
  function encode(text, level) {
    const qr = lib(0, normalizeLevel(level)); // 0 = pick the smallest version that fits
    qr.addData(String(text), 'Byte');
    try {
      qr.make();
    } catch (error) {
      if (/overflow/i.test(String(error && error.message || error))) {
        throw new Error('The contact details are too long to fit into a single QR code. ' +
          'Shorten some fields or lower the error-correction level.');
      }
      throw error;
    }
    qr.version = (qr.getModuleCount() - 17) / 4;
    return qr;
  }

  /**
   * Draw the symbol onto a canvas with an integer module size so edges stay
   * pixel-perfect (no anti-aliasing blur that hurts scanners).
   * @param {object} qr  result of encode()
   * @param {number} size requested edge length in pixels
   * @returns {HTMLCanvasElement}
   */
  function toCanvas(qr, size) {
    const count = qr.getModuleCount();
    const total = count + QUIET_ZONE * 2;
    const cell = Math.max(1, Math.floor(clampSize(size) / total));
    const dimension = cell * total;

    const canvas = document.createElement('canvas');
    canvas.width = dimension;
    canvas.height = dimension;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dimension, dimension);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + QUIET_ZONE) * cell, (r + QUIET_ZONE) * cell, cell, cell);
        }
      }
    }
    return canvas;
  }

  function escapeXml(text) {
    return String(text).replace(/[<>&'"]/g, function (ch) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch];
    });
  }

  /**
   * Build a compact, scalable SVG document (one <path> for all modules).
   * @param {object} qr result of encode()
   * @param {{ size?: number, title?: string }} [options]
   * @returns {string}
   */
  function toSvg(qr, options) {
    options = options || {};
    const count = qr.getModuleCount();
    const total = count + QUIET_ZONE * 2;
    const size = clampSize(options.size || 512);
    let path = '';
    for (let r = 0; r < count; r++) {
      let c = 0;
      while (c < count) {
        if (!qr.isDark(r, c)) { c += 1; continue; }
        // Merge horizontal runs of dark modules into a single rectangle.
        let run = 1;
        while (c + run < count && qr.isDark(r, c + run)) run += 1;
        path += 'M' + (c + QUIET_ZONE) + ' ' + (r + QUIET_ZONE) + 'h' + run + 'v1h-' + run + 'z';
        c += run;
      }
    }
    const title = options.title ? '<title>' + escapeXml(options.title) + '</title>' : '';
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img">' +
      title +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<path d="' + path + '" fill="#000000"/>' +
      '</svg>';
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<Blob>}
   */
  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (typeof canvas.toBlob !== 'function') {
        reject(new Error('canvas.toBlob is not supported by this browser'));
        return;
      }
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode the QR code as PNG'));
      }, 'image/png');
    });
  }

  /**
   * Render a QR code for `text` in every format the app needs.
   * @param {string} text
   * @param {{ size?: number, level?: string, title?: string }} [options]
   * @returns {Promise<{ png: Blob, svg: string, version: number, modules: number, bytes: number }>}
   */
  function render(text, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      let qr;
      try {
        qr = encode(text, options.level);
      } catch (error) {
        reject(error);
        return;
      }
      const canvas = toCanvas(qr, options.size);
      canvasToBlob(canvas).then(function (png) {
        resolve({
          png: png,
          svg: toSvg(qr, { size: options.size, title: options.title }),
          version: qr.version,
          modules: qr.getModuleCount(),
          bytes: lib.stringToBytes(String(text)).length
        });
      }, reject);
    });
  }

  root.QRGen = root.QRGen || {};
  root.QRGen.qr = {
    QUIET_ZONE: QUIET_ZONE,
    LEVELS: LEVELS,
    MIN_SIZE: MIN_SIZE,
    MAX_SIZE: MAX_SIZE,
    encode: encode,
    toCanvas: toCanvas,
    toSvg: toSvg,
    render: render
  };
}(typeof self !== 'undefined' ? self : this));
