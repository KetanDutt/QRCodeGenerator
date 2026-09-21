# User Guide

This guide walks through everything you can do with the Employee QR Code Generator. No installation or account is needed - the whole tool is a web page.

## 1. Opening the app

- **Locally:** open `index.html` in a current browser (Chrome, Edge, Firefox, Safari).
- **Hosted:** open the URL where your organisation has deployed it (see [DEPLOYMENT.md](DEPLOYMENT.md)).

The blue notice at the top is a reminder that your data stays on your device: the CSV is read and the QR codes are drawn by your browser. The page keeps working if you go offline.

## 2. Preparing the CSV

Export a CSV with one row per employee from your HR system, spreadsheet or form tool. The minimum is a name; everything else is optional. See [CSV_FORMAT.md](CSV_FORMAT.md) for the full column reference.

Tips:

- In Excel choose **File → Save As → CSV UTF-8 (Comma delimited)** so accented names survive.
- Values containing commas (e.g. `"Director, Engineering"`) must be wrapped in double quotes - spreadsheets do this automatically.
- Use the **Download the sample CSV** link under the drop zone as a template.

## 3. Loading the file

Either drag the file onto the dashed drop zone, click anywhere inside it, or use the **Browse files** button (which is also the keyboard path: <kbd>Tab</kbd> to it and press <kbd>Enter</kbd>).

The app then:

1. detects the file encoding and delimiter,
2. detects which column holds which piece of information,
3. validates every row,
4. renders one QR code per employee, showing progress as it goes.

For a few hundred rows this takes a second or two.

## 4. Reviewing the result

### Summary

Five tiles show how many employees were found, how many QR codes are ready, how many warnings were raised, how many rows were skipped or failed, and which file is loaded.

### Data quality

If anything looks off, a **Data quality** panel appears. Expand it to see one line per finding, each referencing the row number in your file (the header is row 1, so the first employee is row 2 - the same numbering as in a spreadsheet).

| Level | Meaning |
| --- | --- |
| **Row skipped** | No name could be found in the row. The row is excluded. |
| **Warning** | The row was kept, but something deserves a look - e.g. an invalid e-mail, a duplicate, or an emergency number that equals the employee's own number. |

Warnings never remove rows, so the QR code for row *n* always belongs to the person in row *n*.

### Column mapping

The **Column mapping** panel shows which CSV column was used for each field. If the automatic detection picked the wrong column (or your headers are unusual), change the drop-downs; the table and QR codes update immediately. At least one name column must stay mapped.

### The table

Each row shows the employee, their ID (if present), contact numbers, e-mail, a status badge and the QR code.

- Hover a **warning** badge to read the details.
- Click a **QR code** to open a large preview together with the exact vCard text that is encoded. From there you can download that single code as PNG or SVG, download the `.vcf`, or copy the text.
- Use the **search box** (or press <kbd>/</kbd>) to filter by name, e-mail, ID, designation or phone number.

## 5. Settings

Open the settings with the sliders icon in the header. Settings are remembered by your browser and re-applied to loaded data straight away.

| Setting | Effect |
| --- | --- |
| **Default company / organisation** | Written into the vCard `ORG` field when the CSV has no Company column. |
| **Image size** | Edge length of the PNG files (256-2048 px). 512 px is fine for screens and small prints; choose 1024 or 2048 px for large prints. SVG files scale to any size. |
| **Error correction** | How much of the code may be damaged or obscured and still scan. `M` (15 %) is the usual choice; `H` (30 %) is more robust but denser. |
| **Download format** | PNG, SVG, or both - for the ZIP bundle and individual downloads. |
| **Include in the vCard** | Toggle the emergency contact number, the employee ID and the blood group. Fields absent from the CSV are never included. |

**Reset to defaults** restores the original values.

## 6. Downloading

| Button | What you get |
| --- | --- |
| **Download ZIP** | One archive containing `qr-codes/` (PNG and/or SVG per employee), `vcards/` (one `.vcf` per employee), `all-contacts.vcf` (every contact in one file), `manifest.csv` (maps file names back to source rows, includes warnings) and a `README.txt`. |
| **Download images** | Each QR code as a separate file. Browsers ask for permission to download multiple files - allow it. For more than a handful of employees the ZIP is more convenient. |
| **Download vCards** | A single `.vcf` file with every contact, ready to import into a phone, Outlook or Google Contacts. |

File names follow the pattern `First_Last-EmployeeID.png`. Duplicates get a numeric suffix so nothing is overwritten.

## 7. Printing

Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>P</kbd> while the table is visible to print a clean sheet of employees and their QR codes (controls, settings and warnings are hidden automatically). For ID-card production use the SVG or 2048 px PNG files from the ZIP instead.

## 8. Clearing data

**Clear** removes the loaded CSV and all generated codes from the page. Nothing is stored anywhere - reloading the page has the same effect. Remember that downloaded files remain on your disk.

## 9. Keyboard shortcuts & accessibility

| Key | Action |
| --- | --- |
| <kbd>Tab</kbd> | Move between the drop zone, buttons, table and dialogs |
| <kbd>Enter</kbd> on **Browse files** | Open the file picker |
| <kbd>/</kbd> | Focus the search box (when results are shown) |
| <kbd>Esc</kbd> | Close a dialog |

The interface follows the operating-system dark/light preference until you pick a theme with the sun/moon button, respects "reduce motion" settings, and announces progress to screen readers.

## 10. Scanning the codes

Any modern phone camera or QR reader app recognises the vCard and offers to save the contact. The emergency number appears as a phone number labelled **Emergency Contact** and is repeated in the contact's notes together with the employee ID and blood group (when enabled). See [VCARD_OUTPUT.md](VCARD_OUTPUT.md) for the exact content.
