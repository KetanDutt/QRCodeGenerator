#!/usr/bin/env node
/**
 * Zero-dependency static file server for local development and simple
 * deployments.
 *
 *   npm start                      -> http://127.0.0.1:8080
 *   PORT=3000 HOST=0.0.0.0 npm start
 *
 * It serves the repository root with correct MIME types, blocks path
 * traversal, and sends the same hardening headers recommended in
 * docs/DEPLOYMENT.md so that the app is exercised under a strict
 * Content-Security-Policy during development.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.vcf': 'text/vcard; charset=utf-8',
  '.woff2': 'font/woff2'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'"
    // Production deployments should also send "frame-ancestors 'none'" (see
    // docs/DEPLOYMENT.md); it is omitted here so local previews can be embedded.
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-cache'
};

// Never serve these even if someone guesses the path.
const HIDDEN = new Set(['.git', 'node_modules', '.env']);

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers || {}));
  res.end(body);
}

function safeResolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch (error) {
    return null;
  }
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(ROOT, normalized);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  const segments = path.relative(ROOT, resolved).split(path.sep);
  if (segments.some(function (segment) { return HIDDEN.has(segment); })) return null;
  return resolved;
}

const server = http.createServer(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
    return;
  }

  let filePath = safeResolve(req.url || '/');
  if (!filePath) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
    return;
  }

  fs.stat(filePath, function (error, stats) {
    if (!error && stats.isDirectory()) {
      if (!req.url.split('?')[0].endsWith('/')) {
        send(res, 301, '', { Location: req.url.split('?')[0] + '/' });
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, function (readError, data) {
      if (readError) {
        send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
        return;
      }
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, Object.assign({}, SECURITY_HEADERS, {
        'Content-Type': type,
        'Content-Length': data.length
      }));
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
});

server.listen(PORT, HOST, function () {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('Employee QR Code Generator is running at http://' + shownHost + ':' + PORT + '/');
  console.log('Serving ' + ROOT + ' (press Ctrl+C to stop)');
});

server.on('error', function (error) {
  if (error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Try: PORT=3000 npm start');
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
