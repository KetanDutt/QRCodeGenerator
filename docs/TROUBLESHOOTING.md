# Troubleshooting

## Loading files

**"Unsupported file"**
The file extension is not `.csv`, `.tsv` or `.txt`. Export/save your spreadsheet as CSV and try again. Excel workbooks (`.xlsx`) are not CSV files.

**"No data found"**
The file is empty or contains only a header row. Make sure the export includes employee rows.

**"Could not find a name column"**
None of the headers was recognised as a first, last or full name. The dialog lists the headers that *were* found - rename one to `First Name`/`Last Name`/`Name`, or make sure the first row of the file is actually the header (some exports put a title line above it).

**Nothing happens when I drop a file**
Drop it *onto the dashed area*. Dropping elsewhere on the page is ignored on purpose (so the browser does not navigate away). If multiple files are dropped, only the first is used.

**The same file will not load twice**
It does - the file picker is reset after every load. If you are using drag & drop from a file manager, re-drop the file.

## Wrong or missing data

**Names show `Ã©`, `Ã¼` or `?` instead of accents**
The CSV is not UTF-8. The app falls back to Windows-1252 and warns you; if characters are still wrong, re-export as *CSV UTF-8* (Excel: File → Save As → *CSV UTF-8 (Comma delimited)*).

**Columns are mixed up (e-mail in the phone field, etc.)**
Open **Column mapping** and correct the assignment. Also check the *Data quality* panel for "Row n has X fields but the header has Y" - that means a value contains an unquoted delimiter which shifts the remaining columns of that row.

**The Company is empty / says the wrong thing**
Either add a `Company` column to the CSV or set the *Default company* in Settings. A CSV column always wins over the default.

**An employee is missing from the table**
Rows without any name are skipped and listed under *Data quality* as "Row n skipped". Add the name and reload the file.

**The emergency number shows as the employee's own number on my phone**
The number is labelled *Emergency Contact* using the standard `X-ABLabel` mechanism, which iOS, Android and Outlook honour. A few contact apps ignore custom labels; the number is also listed in the contact's notes with the text "Emergency Contact:" for that reason.

## QR codes

**Status shows "Failed" with "too long to fit into a single QR code"**
The row's data exceeds the QR capacity for the chosen error-correction level. Shorten long designations/notes, disable optional fields in Settings, or lower the error-correction level (H → M).

**Codes do not scan when printed**
- Print larger: a full vCard is typically a version 10-15 code; aim for at least 25 mm × 25 mm (1 in), more for glossy cards.
- Use the **SVG** or the **2048 px PNG** for print jobs, never a screenshot of the thumbnail.
- Keep the white quiet zone that is part of the image - do not crop it.
- Choose error-correction **M** or **Q**; H makes the code denser.
- Ensure high contrast (black on white). Do not print on dark or reflective material.

**Codes look blurry on screen**
Thumbnails are scaled down in the table. Click one to see the full-size preview, or download the file.

## Downloads

**Only the first file downloads when using "Download images"**
Browsers ask for permission to download multiple files; look for a prompt or an icon in the address bar and allow it. Alternatively use **Download ZIP**.

**The ZIP will not open / file names look garbled**
File names are stored in UTF-8. Use a modern archiver (Windows Explorer, macOS Archive Utility, 7-Zip, `unzip` 6+). Very old tools may show non-ASCII names incorrectly but the files are intact.

**Downloads are blocked**
Some corporate browser policies block Blob downloads. Ask your administrator, or run the tool from `file://` on a machine without the restriction.

## Other

**The page says "Browser not supported"**
The browser lacks `<dialog>`, `canvas.toBlob`, `TextDecoder` or Blob URLs. Update to a current version of Chrome, Edge, Firefox or Safari. Internet Explorer is not supported.

**The page loads without styles or nothing works when hosted**
Check the browser console. If a Content-Security-Policy is applied, it must allow `script-src 'self'`, `style-src 'self'` and `img-src blob:` (see [DEPLOYMENT.md](DEPLOYMENT.md)). Also make sure `.js` files are served with a JavaScript MIME type.

**Settings do not persist**
`localStorage` is disabled (private browsing or policy). The app still works; settings just reset on reload.

**Performance with thousands of rows**
Generation runs in batches and stays responsive, but the table becomes heavy beyond a few thousand rows. Split very large files by department; the app asks for confirmation above 2,000 rows.

Still stuck? [Open an issue](https://github.com/KetanDutt/QRCodeGenerator/issues) with the browser name/version and a **sample CSV containing fictitious data** that reproduces the problem.
