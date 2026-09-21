# Contributing

Thanks for your interest in improving the Employee QR Code Generator.

> **Licence note.** This project is *not* open source - see [LICENSE](LICENSE). Bug reports and suggestions are always welcome; by submitting a pull request you confirm that you are entitled to contribute the code and that the author may use it under the project's licence terms.

## Reporting bugs

Open an issue with:

- browser name and version, operating system;
- what you did, what you expected, what happened;
- a **CSV that reproduces the problem using fictitious data** - never attach real employee data (the files in `samples/` are a good starting point).

## Development setup

```bash
git clone https://github.com/KetanDutt/QRCodeGenerator.git
cd QRCodeGenerator
npm install        # optional: jsdom + jsqr for the integration/decoding tests
npm test           # run the test-suite
npm start          # serve at http://127.0.0.1:8080 with production-like headers
```

Requirements: Node.js ≥ 18 for tests and the dev server. The app itself needs only a browser - there is **no build step**; edit a file and reload.

## Project conventions

- **Plain JavaScript (ES2018-ish), no frameworks, no bundler.** Browser files are classic scripts sharing the `QRGen` namespace; logic that does not need the DOM lives in UMD modules (`utils`, `csv`, `vcard`, `contacts`) so it can be unit-tested in Node.
- **No inline scripts or styles** in `index.html` - the page must keep working under a strict Content-Security-Policy.
- **No runtime network access.** Do not add CDN links, web fonts or analytics. New third-party code goes into `vendor/`, pinned, with its licence recorded in `vendor/LICENSES.md`.
- **Never build HTML from user data.** Use `textContent`/`createTextNode` or the `ui.el()` helper.
- **Accessibility matters:** every control needs an accessible name, dialogs use `<dialog>`, dynamic status text uses `aria-live`.
- **Style:** 2-space indentation, single quotes, semicolons, `'use strict'` (see `.editorconfig`). Keep functions small and comment *why*, not *what*.

## Tests

- Add or update tests for any behavioural change. Core suites must stay dependency-free (`node:test` + `node:assert`).
- `tests/app.smoke.test.js` drives the real `index.html` in jsdom - extend it when you add UI elements (it fails fast if an expected element id is missing).
- Run `npm run lint` (syntax check) and `npm test` before opening a pull request.

## Pull requests

1. Branch from `main`, keep the change focused.
2. Update documentation in `docs/` and `README.md` when behaviour or the CSV format changes.
3. Add an entry under *Unreleased* in `CHANGELOG.md`.
4. Bump `APP_VERSION` in `js/app.js` and `version` in `package.json` only in release commits.

## Releasing

1. Move the *Unreleased* changelog entries under a new version heading with the date.
2. Bump `APP_VERSION` (`js/app.js`) and `package.json`.
3. Tag the commit (`git tag v2.x.y`) and push.

## Handling sensitive data in history

If real personal data was ever committed, removing the file in a new commit is **not** enough - it remains in Git history. Maintainers should rewrite history (e.g. `git filter-repo --invert-paths --path contacts.csv`), force-push, ask collaborators to re-clone, and treat the data as disclosed (notify the affected people/data-protection officer where required). The `.gitignore` in this repository excludes CSV files outside `samples/` to prevent a repeat.
