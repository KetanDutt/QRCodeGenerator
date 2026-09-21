# CSV Format Reference

The app accepts a plain CSV (or TSV) file with a header row followed by one row per employee.

## Columns

Headers are matched **case-insensitively**; punctuation, underscores and text in parentheses are ignored (so `Emergency Contact Number (Should not be same as employee contact number)` is simply read as *emergency contact number*). Detection works in two passes - exact alias match first, then keyword match - and each CSV column is assigned to at most one field.

| Field | Required | Accepted headers (aliases) | Keyword fallback | Where it ends up |
| --- | --- | --- | --- | --- |
| **First Name** | yes¹ | First Name, Firstname, Given Name, FName, First | *first name*, *given* | `N`, `FN` |
| **Last Name** | yes¹ | Last Name, Lastname, Surname, Family Name, LName, Last | *last name*, *surname*, *family* | `N`, `FN` |
| **Full Name** | alt.¹ | Full Name, Employee Name, Name | *full name* | Split into first/last when no First/Last columns exist |
| **Employee ID** | no | Employee ID, Emp ID, Employee Code, Employee Number, Employee No, Staff ID, Staff Number, Emp Code, ID | *employee id*, *emp id*, *employee code*, *staff id* | `NOTE`, file name |
| **Emergency Contact Number** | no | Emergency Contact Number, Emergency Contact No, Emergency Contact, Emergency Number, Emergency Phone, Emergency Mobile, Emergency | *emergency* | Labelled `TEL` + `NOTE` |
| **Employee Contact Number** | no | Company Employee Contact Number, Employee Contact Number, Employee Contact No, Employee Contact, Employee Phone, Employee Mobile, Contact Number, Contact No, Work Phone, Office Phone, Mobile Number, Mobile No, Phone Number, Phone No, Mobile, Phone, Telephone, Tel, Contact | *phone*, *mobile*, *contact*, *tel* | `TEL;TYPE=WORK,VOICE` |
| **Official Email ID** | no | Official Email ID, Official Email, Official E-mail, Work Email, Company Email, Email Address, E-mail Address, Email ID, E-mail ID, E-mail, Email, Mail | *email*, *e mail* | `EMAIL;TYPE=INTERNET,WORK` |
| **Designation** | no | Designation, Job Title, JobTitle, Title, Position, Role, Post | *designation*, *title*, *position*, *role* | `TITLE` |
| **Company** | no | Company, Company Name, Organization, Organisation, Org, Employer, Firm | *company*, *organi* | `ORG` (falls back to the default company in Settings) |
| **Blood Group** | no | Blood Group, BloodGroup, Blood Type, BloodType | *blood* | `NOTE` |

¹ A row needs *some* name: either a first and/or last name, or a full name. Files without any name column are rejected with a list of the headers that were found.

Priority matters when several headers could match: `Employee ID` is preferred over a bare `ID`, `Official Email ID` over `Email`, and the emergency number is claimed before the generic phone keywords, so a form export that contains both a responder `Email` column and an `Official Email ID` column is handled correctly.

Unknown columns (photos, timestamps, form IDs, …) are ignored.

If detection gets something wrong, fix it in the **Column mapping** panel - the change is applied instantly.

## Example files

**Canonical layout** (`samples/sample-employees.csv`):

```csv
First Name,Last Name,Designation,Company Employee Contact Number,Emergency Contact Number (Should not be same as employee contact number),Official Email ID
Ada,Lovelace,Lead Software Engineer,+91 90000 00001,+91 90000 00101,ada.lovelace@example.com
Grace,Hopper,"Director, Engineering",+91 90000 00003,+91 90000 00103,grace.hopper@example.com
```

**Form-builder export** with extra columns (`samples/sample-forms-export.csv`):

```csv
ID,Start time,Completion time,Email,Name,Last modified time,First Name,Last Name,Designation,Blood Group,Employee ID,Employee Contact Number,Emergency Contact Number (Should not be same as employee contact number),Official Email ID,Employee Photo (Please make sure background should be plain),
1,1/2/26 9:00:00,1/2/26 9:05:00,ada.lovelace@example.com,Ada Lovelace,,Ada,Lovelace,Lead Software Engineer,A+,E1001,+91 90000 00001,+91 90000 00101,ada.lovelace@example.com,https://intranet.example.com/photos/ada.png,
```

## File rules

| Aspect | Supported |
| --- | --- |
| Extension | `.csv`, `.tsv`, `.txt` (the MIME type reported by the OS is not trusted, because Windows often labels CSVs as `application/vnd.ms-excel`) |
| Delimiter | Comma, semicolon, tab or pipe - detected from the header row |
| Quoting | RFC 4180: fields may be wrapped in `"…"`; a literal quote is written as `""`; quoted fields may contain delimiters and line breaks |
| Line endings | CRLF (Windows), LF (macOS/Linux), CR - mixed is fine |
| Encoding | UTF-8 (with or without BOM) preferred. UTF-16 LE/BE with BOM is detected. Anything else is decoded as Windows-1252 and a warning is shown. |
| Blank lines | Ignored |
| Trailing empty columns | Ignored (common in spreadsheet exports) |
| Size | Up to 20 MB; a confirmation is requested above 2,000 rows |

Rows that are **shorter** than the header are padded with empty values. Rows that are **longer** are kept but reported - this usually means an unquoted comma inside a value.

## Value handling

- Leading/trailing whitespace is trimmed and internal runs of whitespace are collapsed.
- Phone numbers keep digits, `+`, spaces, brackets, dots and hyphens; separators that would break a vCard (`;` `,` and line breaks) are removed.
- Nothing else is reformatted - what you put in the CSV is what is encoded.

## Validation messages

| Message | Cause | Effect |
| --- | --- | --- |
| *Row n skipped: no name found.* | All mapped name columns are empty | Row excluded |
| *No phone number or e-mail address.* | Neither field has a value | Warning |
| *E-mail address "…" does not look valid.* | Not in the form `x@y.z` | Warning |
| *Emergency contact number is the same as the employee contact number.* | Digits of both numbers are identical | Warning |
| *Duplicate e-mail address (also in row n).* | Same e-mail (case-insensitive) as an earlier row | Warning |
| *Duplicate contact number (also in row n).* | Same digits as an earlier row | Warning |
| *Row n has X fields but the header has Y.* | Unquoted delimiter in a value | Warning |
| *The file is not UTF-8 encoded; it was decoded as …* | Legacy encoding | Warning |
| *The file contains an unterminated quote…* | Mismatched `"` | Warning |
| *The contact details are too long to fit into a single QR code.* | The vCard exceeds the QR capacity (≈2.9 KB at level L, ≈1.2 KB at level H) | Row marked *Failed* |
