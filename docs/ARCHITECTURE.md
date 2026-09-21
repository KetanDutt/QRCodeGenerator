# Architecture

## Goals

1. **Privacy by design** - personal data must never leave the browser.
2. **Zero infrastructure** - a static page that works from `file://`, a plain web server or any static host; no build step.
3. **Correctness** - proper CSV parsing, standards-compliant vCards, deterministic QR output.
4. **Testability without tooling** - the core logic runs under Node's built-in test runner.

## Module layout

```
index.html                 markup + inline SVG icon sprite; loads scripts in dependency order
css/styles.css             design tokens, components, dark theme, print styles
js/theme.js                sets data-theme before first paint (sync in <head>)
js/utils.js        ─┐      pure helpers
js/csv.js           ├─     UMD modules: browser (QRGen.*) + Node (require)
js/vcard.js         │
js/contacts.js     ─┘      column detection, record building, validation
js/qr.js                   browser-only: wraps vendor/qrcode-generator, renders PNG + SVG
js/ui.js                   browser-only: toasts, <dialog> alert/confirm helpers
js/app.js                  browser-only: state, DOM wiring, generation pipeline, downloads
vendor/                    qrcode-generator 1.4.4, JSZip 3.10.1 (pinned, unmodified)
scripts/serve.js           optional dev/static server with hardening headers
tests/                     node:test suites (unit + jsdom integration)
```

All browser code shares a single global namespace, `window.QRGen`, populated in load order. Classic `<script>` tags (not ES modules) are used on purpose: module scripts are blocked on `file://` in Chromium, and "double-click `index.html`" is a supported way to run the app.

### Why UMD wrappers?

`utils`, `csv`, `vcard` and `contacts` are wrapped in a small UMD shim:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.QRGen = root.QRGen || {}; root.QRGen.csv = factory(); }
}(typeof self !== 'undefined' ? self : this, function () { /* … */ }));
```

The same file is therefore a browser script and a CommonJS module, which lets the test-suite import the real code with no bundler or transpiler.

## Data flow

```
File ──► decodeText() ──► csv.parse() ──► contacts.detectMapping()
                                              │
                        user override ◄───────┤ (Column mapping panel)
                                              ▼
                              contacts.buildContacts()  → records + issues
                                              │
                                              ▼
                     for each record (batches of 24, yielding to the UI):
                        vcard.build() ──► qr.render() ──► { png Blob, svg, url }
                                              │
                                              ▼
                       table rows / preview dialog / ZIP / individual downloads
```

### Intake (`app.js › handleFile`)

- File type is decided by extension first, MIME type second (Windows reports CSVs as `application/vnd.ms-excel`).
- Bytes are decoded as UTF-8 with `fatal: true`; on failure the app tries UTF-16 BOMs and finally Windows-1252, recording a warning.
- Size (20 MB) and row-count (2,000, confirm) guards protect against accidental huge files.

### Parsing (`csv.js`)

A single-pass state machine that implements RFC 4180 (quotes, escaped quotes, embedded line breaks) and tolerates real-world exports: BOM, mixed line endings, blank lines, trailing empty columns, short rows (padded) and long rows (kept and reported). The delimiter is detected from the header line.

### Mapping & validation (`contacts.js`)

Every logical field has an ordered list of header aliases and a set of keywords. Detection claims columns in field priority order so specific columns (`Emergency Contact Number`, `Employee ID`, `Official Email ID`) win over generic ones (`Contact`, `ID`, `Email`). The result is a plain `{ field: columnIndex }` object that the UI can edit.

`buildContacts()` never drops a row for a data-quality reason other than "no name" - this guarantees row *n* in the table corresponds to row *n* in the file, which was a bug in the original implementation. Issues are returned as structured objects `{ row, level, message }`.

### vCards (`vcard.js`)

Deterministic vCard 3.0 output with correct escaping and CRLF line endings. The emergency number uses the grouped `item1.TEL` + `item1.X-ABLabel` idiom for a custom label and is mirrored in `NOTE` as a fallback.

### QR rendering (`qr.js`)

Wraps the vendored `qrcode-generator` library:

- UTF-8 byte mode, automatic version selection, selectable error-correction level.
- PNG via `<canvas>` with an **integer module size** so edges stay crisp; blob produced with `canvas.toBlob`.
- SVG produced by the app itself (one `<path>` with merged horizontal runs, `crispEdges`), independent of image size.
- "Code length overflow" from the library is translated into a friendly per-row error.

### Generation pipeline (`app.js › generateAll`)

Contacts are processed in batches of 24 with `Promise.all`, yielding to the browser via `requestAnimationFrame` between batches so the progress bar, table and buttons stay responsive. A monotonically increasing *generation token* invalidates in-flight work when the user changes settings, edits the mapping, loads another file or clears the page; blob URLs of superseded codes are revoked to avoid leaks.

### UI primitives (`ui.js`)

Toasts and a shared message `<dialog>` (alert/confirm returning promises) replace the former SweetAlert2 dependency, follow the app theme, and keep the page free of third-party UI code.

## State

A single `state` object in `app.js` holds the loaded file, parsed CSV, mapping, contact records (each with its vCard text, QR blobs and object URL), issues and settings. Settings persist in `localStorage` under `qrgen.settings`; the theme under `qrgen.theme`. Nothing else is stored.

## Security considerations

- No network requests are made at runtime. All scripts are local and pinned.
- No inline scripts or styles, so a strict Content-Security-Policy (`script-src 'self'; style-src 'self'`) can be enforced by the hosting server - `scripts/serve.js` does exactly that for local testing.
- All user-supplied text is inserted with `textContent`/`createTextNode`; no `innerHTML` with CSV data.
- Generated file names are sanitised for Windows/macOS/Linux and de-duplicated.

See [PRIVACY_AND_SECURITY.md](PRIVACY_AND_SECURITY.md) for the data-handling perspective.

## Testing strategy

| Suite | Scope | Dependencies |
| --- | --- | --- |
| `tests/csv.test.js` | parser & serialiser edge cases | none |
| `tests/contacts.test.js` | header detection, record building, warnings, file names | none |
| `tests/vcard.test.js` | exact vCard output, escaping, options | none |
| `tests/utils.test.js` | helpers | none |
| `tests/qr-roundtrip.test.js` | vCard → QR → decode with an independent decoder | `jsqr` (skips if absent) |
| `tests/app.smoke.test.js` | loads `index.html` + scripts in jsdom and drives the full UI flow with the sample CSVs | `jsdom` (skips if absent) |

Run `npm test`. Only Node ≥ 18 is required for the core suites.

## Extending

- **New CSV field:** add an entry to `FIELDS` in `contacts.js` (aliases + keywords), read it in `buildContacts()`, emit it in `vcard.build()`, and - if it should be user-toggleable - add a checkbox in `index.html` + `DEFAULT_SETTINGS` in `app.js`.
- **New output format:** extend `qr.js` (rendering) and the download helpers in `app.js`.
- **Different card content (e.g. MeCard, URL):** replace `vcard.build()`; nothing else depends on the payload format.
