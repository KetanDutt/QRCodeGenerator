# Roadmap & Improvement Ideas

Suggestions that were considered during the 2.0 rework but deliberately left out to keep the release focused. They are ordered roughly by expected value.

## Near term

| Idea | Why | Notes |
| --- | --- | --- |
| **Web Worker for QR encoding** | Encoding is ~8 ms per code on the main thread; 1,000+ employees keep the CPU busy for several seconds even though the UI stays responsive thanks to batching. | Move `vendor/qrcode-generator.js` + `js/qr.js` encode step into a worker pool; render PNG with `OffscreenCanvas` where available. |
| **Column sorting** | Large tables benefit from sorting by name, ID or status. | Pure DOM re-ordering; keep `contact.index` as the stable key. |
| **Excel (`.xlsx`) import** | Many HR exports are workbooks; users currently have to "Save as CSV". | Would require a vendored parser (e.g. SheetJS community edition, Apache-2.0); adds ~400 KB. |
| **Installable / offline PWA** | A service worker + manifest would make the hosted version installable and guarantee offline availability. | Only for hosted deployments (service workers do not run from `file://`). |
| **Playwright end-to-end tests** | The jsdom smoke test cannot verify pixels, real downloads or `<dialog>` behaviour. | Add a `test:e2e` script that is optional in CI. |

## Medium term

| Idea | Why | Notes |
| --- | --- | --- |
| **Logo / brand overlay on codes** | Common request for badges. | Needs error-correction level H and a size-capped overlay to stay scannable; provide a scan-check. |
| **Print layout templates** | Generate a ready-to-print sheet (e.g. 8 badges per A4 with name, title and code). | CSS grid + `@page`; could reuse the existing print stylesheet. |
| **Alternative payload types** | MeCard (smaller codes), plain URL to an internal directory entry, Wi-Fi codes for onboarding kits. | Only `vcard.build()` depends on the payload format. |
| **Per-row editing** | Fix a typo without re-exporting the CSV. | Inline edit → rebuild that contact only. |
| **Internationalisation** | UI strings are English only. | Extract strings from `app.js`/`index.html` into a small dictionary. |

## Long term / optional

- **Digital signature or verification URL** inside the card for anti-forgery use cases.
- **Photo support via a hosted profile link** (photos cannot be embedded in a QR code).
- **Batch history** kept in IndexedDB (opt-in) so a session survives a reload.

## Explicitly out of scope

- Any server-side component or third-party API - the privacy guarantee (nothing leaves the browser) is a core feature.
- Frameworks or a build pipeline - the project must stay editable with a text editor and runnable by opening `index.html`.

Have another idea? Please [open an issue](https://github.com/KetanDutt/QRCodeGenerator/issues).
