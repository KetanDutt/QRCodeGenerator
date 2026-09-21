# Employee QR Code Generator

Turn a CSV of employees into scannable **vCard QR codes** - one per person - ready for ID cards, badges and directories. Scanning a code adds the employee (name, title, company, work phone, e-mail, emergency contact) straight to a phone's contacts.

Everything runs **inside the browser**: the CSV is parsed and every QR code is rendered locally. No server, no build step, no data leaves the machine.

## Highlights

- **100 % client-side & privacy-safe** - contact data is never uploaded to a QR API; works offline once opened.
- **Robust CSV import** - RFC 4180 parser (quoted fields, embedded commas/line breaks), CRLF/LF, BOM, UTF-8 / UTF-16 / Windows-1252 detection, comma/semicolon/tab delimiters.
- **Smart column detection** - recognises many header variants (`Employee Contact Number`, `Phone`, `Mobile No.`, …) and form-builder exports with extra columns; override any mapping in the UI.
- **Data-quality checks** - flags missing names, invalid e-mails, duplicates and emergency numbers identical to the employee number - without silently dropping rows.
- **Correct vCards** - vCard 3.0 with CRLF line endings, proper escaping, UTF-8, and a clearly labelled *Emergency Contact* number.
- **Print-ready output** - PNG (256-2048 px) and resolution-independent SVG, selectable error-correction level.
- **Bulk export** - ZIP bundle with QR images, per-person `.vcf` files, a combined `all-contacts.vcf` and a `manifest.csv`; or individual downloads.
- **Polished UI** - drag & drop, live progress, search, QR preview with the encoded vCard, light/dark theme, keyboard accessible, print stylesheet.

## Quick start

**Option 1 - just open it**

1. Download or clone this repository.
2. Open `index.html` in Chrome, Edge, Firefox or Safari.

**Option 2 - serve it locally** (Node.js 18+)

```bash
git clone https://github.com/KetanDutt/QRCodeGenerator.git
cd QRCodeGenerator
npm start            # http://127.0.0.1:8080
```

Then drop a CSV onto the page. Try `samples/sample-employees.csv` first.

## CSV format

One row per employee; headers are matched case-insensitively and many aliases are accepted (see [docs/CSV_FORMAT.md](docs/CSV_FORMAT.md)).

| Column | Required | Examples of accepted headers |
| --- | --- | --- |
| First Name / Last Name | yes* | `First Name`, `Given Name` / `Last Name`, `Surname` |
| Name | *alternative | `Name`, `Full Name` (split automatically) |
| Designation | no | `Designation`, `Job Title`, `Position` |
| Company | no | `Company`, `Organisation` (else the default from Settings) |
| Employee Contact Number | no | `Employee Contact Number`, `Company Employee Contact Number`, `Phone`, `Mobile` |
| Emergency Contact Number | no | `Emergency Contact Number`, `Emergency Contact` |
| Official Email ID | no | `Official Email ID`, `Work Email`, `Email` |
| Employee ID | no | `Employee ID`, `Emp ID`, `Staff ID` |
| Blood Group | no | `Blood Group`, `Blood Type` |

```csv
First Name,Last Name,Designation,Company Employee Contact Number,Emergency Contact Number (Should not be same as employee contact number),Official Email ID
Ada,Lovelace,Lead Software Engineer,+91 90000 00001,+91 90000 00101,ada.lovelace@example.com
Grace,Hopper,"Director, Engineering",+91 90000 00003,+91 90000 00103,grace.hopper@example.com
```

Extra columns are ignored. Two ready-made samples live in [`samples/`](samples/).

## Documentation

| Document | What it covers |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Step-by-step usage, settings, downloads, printing, keyboard shortcuts |
| [CSV format](docs/CSV_FORMAT.md) | Column reference, header aliases, encoding/delimiter rules, validation messages |
| [vCard output](docs/VCARD_OUTPUT.md) | Exactly what is encoded in each QR code and how phones display it |
| [Architecture](docs/ARCHITECTURE.md) | Module layout, data flow, design decisions |
| [Deployment](docs/DEPLOYMENT.md) | Hosting as a static site, recommended security headers, offline/intranet use |
| [Privacy & security](docs/PRIVACY_AND_SECURITY.md) | Data handling, threat model, handling of personal data |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common problems and fixes |
| [Roadmap](docs/ROADMAP.md) | Ideas and planned improvements |
| [Contributing](CONTRIBUTING.md) | Development workflow, tests, coding conventions |
| [Changelog](CHANGELOG.md) | Release history |

## Project layout

```
index.html            Application shell (markup only)
css/styles.css        Styles - design tokens, light/dark themes, print
js/
  theme.js            Theme bootstrap (runs before first paint)
  utils.js            Shared helpers (file names, formatting, phone/e-mail checks)
  csv.js              RFC 4180 CSV parser / serialiser
  contacts.js         Column detection, contact records, validation
  vcard.js            vCard 3.0 builder
  qr.js               Local QR rendering (PNG + SVG)
  ui.js               Toasts and <dialog>-based modals
  app.js              Application controller
vendor/               Pinned third-party libraries (qrcode-generator, JSZip)
samples/              Example CSV files with fictitious data
tests/                Node test-suite (`npm test`)
scripts/serve.js      Dependency-free static server for local use
docs/                 Documentation
```

`csv.js`, `contacts.js`, `vcard.js` and `utils.js` are framework-free modules that run both in the browser and in Node, which is how they are unit-tested.

## Development

```bash
npm test          # unit + integration tests (node:test); jsdom/jsqr tests run when dev deps are installed
npm install       # optional: installs jsdom + jsqr for the browser-flow and QR-decoding tests
npm run lint      # syntax check of every script
npm start         # local server with production-like security headers
```

There is intentionally **no build step**: edit the files and reload the page. See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari (desktop and mobile). The app relies on `<dialog>`, `canvas.toBlob`, `TextDecoder` and Blob URLs; unsupported browsers get a clear message instead of a broken page. Internet Explorer is not supported.

## Limitations

- Everything lives in browser memory: very large files (tens of thousands of rows) may be slow or exhaust memory. The app warns above 2,000 rows and refuses files over 20 MB.
- A single QR code holds at most ~2.9 KB; unusually long field values can exceed this and are reported per row.
- Downloading many individual files triggers the browser's "allow multiple downloads" prompt - use the ZIP export for large teams.
- Photos are not embedded in the vCards (they would not fit into a QR code).

## Third-party software

| Library | Version | Licence | Purpose |
| --- | --- | --- | --- |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 1.4.4 | MIT | QR symbol encoding |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | MIT | ZIP bundle creation |
| [Feather Icons](https://feathericons.com/) | 4.x | MIT | UI icons (inlined SVG) |

See [vendor/LICENSES.md](vendor/LICENSES.md). *QR Code* is a registered trademark of DENSO WAVE INCORPORATED.

## License

Copyright © 2026 Ketan Dutt. **All rights reserved.** This repository is provided for viewing and evaluation only; see [LICENSE](LICENSE) for the full terms and for commercial licensing contact details.

## Support

Questions or problems? Check the [troubleshooting guide](docs/TROUBLESHOOTING.md) first, then [open an issue](https://github.com/KetanDutt/QRCodeGenerator/issues).
