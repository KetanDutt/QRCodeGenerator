# vCard Output

Each QR code contains a **vCard 3.0** (RFC 2426) - the format every phone camera and contacts app understands. This page documents exactly what is encoded so that HR and security teams know what ends up on an ID card.

## Example

For the sample row

```csv
First Name,Last Name,Designation,Company,Employee Contact Number,Emergency Contact Number,Official Email ID,Employee ID,Blood Group
Ada,Lovelace,"Analyst, Engines",Example Corp,+44 20 7946 0001,+44 20 7946 0002,ada.lovelace@example.com,E-1001,A+
```

the encoded text is (lines end with CRLF):

```
BEGIN:VCARD
VERSION:3.0
N:Lovelace;Ada;;;
FN:Ada Lovelace
ORG:Example Corp
TITLE:Analyst\, Engines
TEL;TYPE=WORK,VOICE:+44 20 7946 0001
item1.TEL;TYPE=VOICE:+44 20 7946 0002
item1.X-ABLabel:Emergency Contact
EMAIL;TYPE=INTERNET,WORK:ada.lovelace@example.com
NOTE:Employee ID: E-1001\nBlood Group: A+\nEmergency Contact: +44 20 7946 0002
END:VCARD
```

## Property reference

| Property | Source | Notes |
| --- | --- | --- |
| `N` | Last Name; First Name | Mandatory. When only a full name is available it is split at the last space (`Ada King Lovelace` → given *Ada King*, family *Lovelace*). |
| `FN` | First + Last Name (or Full Name) | Mandatory display name. |
| `ORG` | Company column, else the *Default company* setting | Omitted when both are empty. |
| `TITLE` | Designation | Omitted when empty. |
| `TEL;TYPE=WORK,VOICE` | Employee Contact Number | The employee's own number. |
| `item1.TEL;TYPE=VOICE` + `item1.X-ABLabel:Emergency Contact` | Emergency Contact Number | A *grouped* property with a custom label. iOS, Android and most desktop clients show it as a phone number labelled "Emergency Contact", so it is never mistaken for the employee's own number. Can be disabled in Settings. |
| `EMAIL;TYPE=INTERNET,WORK` | Official Email ID | |
| `NOTE` | Employee ID, Blood Group, Emergency Contact | One line each. Acts as a universally visible fallback for clients that ignore custom labels. Each part can be disabled in Settings. |

Deliberately **not** included:

- `REV`/`UID` timestamps - they would make the output non-deterministic (the same CSV must always yield identical QR codes).
- `PHOTO` - images do not fit into a QR code.
- Home addresses or personal e-mail addresses - the tool is meant for work contact details only.

## Escaping and encoding

- Text values are escaped as required by RFC 2426: `\` → `\\`, newline → `\n`, `,` → `\,`, `;` → `\;`.
- Phone numbers are not escaped (they are not text values) but any `;`, `,` or line break is removed from them.
- The text is encoded as **UTF-8** inside the QR code, so accented and non-Latin names scan correctly.
- Lines are terminated with **CRLF** as the specification requires. Lines are not folded at 75 characters; every mainstream reader accepts long lines, and unfolded output is the norm for QR vCards.

## QR code parameters

| Parameter | Value |
| --- | --- |
| Mode | Byte (UTF-8) |
| Version | Smallest that fits the payload (typically 9-15 for a full contact) |
| Error correction | Selectable: L 7 %, **M 15 % (default)**, Q 25 %, H 30 % |
| Quiet zone | 4 modules on every side, included in the image |
| PNG | Integer module size for pixel-perfect edges; 256-2048 px |
| SVG | One merged `<path>`, `shape-rendering="crispEdges"`, scales to any print size |

Capacity of a single QR code in byte mode is 2,953 bytes at level L and 1,273 bytes at level H. A typical employee card is 250-400 bytes; rows that exceed the limit are marked *Failed* with an explanation.

## Downloaded `.vcf` files

The per-employee `.vcf` files and `all-contacts.vcf` contain the exact same text as the QR codes. They can be imported into iOS/Android contacts, Google Contacts, Outlook and Apple Contacts.
