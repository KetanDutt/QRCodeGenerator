# Sample files

All data in this folder is **fictitious** (example.com addresses, non-existent phone numbers). Use these files to try the app or as templates for your own export.

| File | Layout | Demonstrates |
| --- | --- | --- |
| `sample-employees.csv` | The documented six-column format | Quoted value with a comma, non-ASCII name |
| `sample-forms-export.csv` | A form-builder export with extra columns (`ID`, timestamps, responder `Email`, photo URL, trailing empty column) | Column detection priorities, Employee ID + Blood Group in notes, a duplicate row and an emergency number equal to the employee number (both produce warnings) |

Real employee data must never be committed to this repository - `.gitignore` blocks `*.csv` everywhere except this folder.
