# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-09-21

A ground-up rework focused on privacy, correctness and production readiness. The CSV formats accepted by 1.x continue to work.

### Security & privacy
- **QR codes are now generated locally** with a vendored library. Version 1 sent every employee's vCard (name, phone numbers, e-mail) to the third-party `api.qrserver.com` service. The app now makes no network requests at all and works offline.
- Removed `contacts.csv`, which contained real-looking personal data, and replaced it with fictitious samples in `samples/`. Added a `.gitignore` rule that keeps CSV files outside `samples/` out of the repository.
- Dropped all CDN dependencies (Font Awesome, Google Fonts, Material Icons, SweetAlert2, FileSaver.js, CDN-hosted JSZip). Icons are inline SVG, fonts are system fonts, remaining libraries are pinned in `vendor/`.
- No inline scripts/styles, so a strict Content-Security-Policy can be enforced; the bundled dev server sends one.

### Fixed
- **QR codes could be attached to the wrong employee**: rows with an unexpected number of fields were dropped by the parser but still rendered in the table, shifting every following QR code by one row. Rows are now never silently dropped and the table is built from the same records as the codes.
- CSV parsing used `split(",")`: quoted values containing commas (e.g. `"Director, Engineering"`) broke the row. Replaced with an RFC 4180 parser (quotes, escaped quotes, embedded line breaks, BOM, CR/LF/CRLF, delimiter detection).
- Valid CSV files were rejected on Windows because the browser reports them as `application/vnd.ms-excel`; the file type check now uses the extension.
- Table columns were hard-coded to the positions of one specific form export; headers and data cells could show different columns. Columns are now detected by name.
- Uploading a second file without clearing left stale state (`qrCodeImages` was never reset), so no codes appeared; blob URLs were also leaked.
- vCards used LF instead of CRLF, did not escape `, ; \`, and put the emergency number in `TEL;TYPE=CELL`, making it look like the employee's own mobile number. Output is now standards-compliant and the emergency number is labelled "Emergency Contact" and mirrored in `NOTE`.
- Failed QR requests were counted as "generated"; HTTP errors were not detected.
- Accented and non-Latin names are encoded as UTF-8 and scan correctly.
- SweetAlert2's dark theme was applied even in light mode; the table was rendered outside the page container.
- README stated the project was MIT-licensed while `LICENSE` is "All rights reserved"; README now reflects the actual licence. Placeholder support links replaced.

### Added
- Automatic **column detection** with many header aliases, plus a **Column mapping** panel to override it.
- **Data-quality checks**: rows without a name (skipped and reported), invalid e-mail, missing contact details, duplicate e-mail/phone, emergency number identical to the employee number, malformed rows, non-UTF-8 encoding.
- **Settings** (persisted): default company, image size 256-2048 px, error-correction level, download format (PNG/SVG/both), toggles for emergency contact, employee ID and blood group.
- **SVG output** for print-quality codes; PNGs rendered with integer module sizes for crisp edges.
- **ZIP bundle** with `qr-codes/`, `vcards/`, `all-contacts.vcf`, `manifest.csv` and `README.txt`; **vCard (.vcf) export**; per-employee downloads from the preview dialog.
- **QR preview dialog** showing the large code and the exact encoded vCard, with copy-to-clipboard.
- **Search/filter**, sticky table header, status badges with tooltips, progress with `aria-live`, keyboard-accessible drop zone, `/` shortcut, print stylesheet.
- Theme follows the OS preference until changed; `prefers-reduced-motion` respected.
- Encoding detection (UTF-8 / UTF-16 BOM / Windows-1252 fallback), file-size (20 MB) and row-count (2,000) guards, multi-file drop handling, drop-outside-zone protection.
- Batched QR generation that keeps the UI responsive and can be cancelled by newer runs.
- Dependency-free static server (`npm start`) with security headers.
- Test-suite (`npm test`): CSV, mapping/validation, vCard, utils, QR encode→decode round trip (with `jsqr`) and a jsdom integration test that drives the real page.
- Documentation set in `docs/` (user guide, CSV format, vCard output, architecture, deployment, privacy & security, troubleshooting), `CONTRIBUTING.md`, `.editorconfig`, `vendor/LICENSES.md`, favicon.

### Changed
- Code split into modules (`js/csv.js`, `js/contacts.js`, `js/vcard.js`, `js/qr.js`, `js/ui.js`, `js/app.js`, `js/theme.js`, `js/utils.js`) and `css/styles.css`; `index.html` contains markup only.
- Complete visual redesign: card layout, design tokens, refined light/dark palettes, responsive toolbar and table.
- File names are now `First_Last-EmployeeID.ext`, sanitised for all operating systems and de-duplicated (previously `<column 3>-<row>-qrcode.png`).

### Removed
- `old/` legacy implementation (Materialize/quickchart.io based prototype).
- `contacts.csv` (see *Security & privacy*).

## [1.0.0] - 2026

Initial single-file version: drag & drop CSV, table of employees, QR codes fetched from `api.qrserver.com`, individual and ZIP download, light/dark toggle.

[Unreleased]: https://github.com/KetanDutt/QRCodeGenerator/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/KetanDutt/QRCodeGenerator/releases/tag/v2.0.0
