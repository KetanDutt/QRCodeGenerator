# Employee QR Code Generator

A web application that generates QR codes containing employee contact information from CSV files. Each QR code encodes a vCard with the employee's details, making it easy to share contact information.

## Features

- **Drag & Drop Interface**: Simply drag and drop your CSV file to get started
- **CSV Processing**: Parses employee data from properly formatted CSV files
- **vCard Generation**: Creates digital business cards (vCards) for each employee
- **QR Code Generation**: Generates QR codes that can be scanned to save contact information
- **Bulk Download**: Download all QR codes at once as individual files or in a ZIP archive
- **Responsive Design**: Works on desktop and mobile devices
- **Light/Dark Mode**: Toggle between light and dark themes
- **Progress Tracking**: Visual feedback during QR code generation
- **Summary Statistics**: Shows total employees and processing status

## CSV Format Requirements

The application expects CSV files with the following headers (case sensitive):

```
First Name, Last Name, Designation, Company Employee Contact Number, Emergency Contact Number (Should not be same as employee contact number), Official Email ID
```

## How to Use

1. **Prepare your CSV file** with employee data in the required format
2. **Upload the file** by either:
   - Clicking "Browse Files" and selecting your CSV
   - Dragging and dropping the file onto the upload area
3. **Wait for processing** - the app will parse the CSV and generate QR codes
4. **Download QR codes**:
   - Click "Download All QR Codes" to save each QR code as a separate PNG file
   - Click "Download as ZIP" to get all QR codes in a single ZIP archive
5. **Clear data** when finished using the "Clear All" button

## Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript (no frameworks)
- **QR Generation**: Uses [QR Server API](https://goqr.me/api/)
- **ZIP Creation**: Uses JSZip library
- **File Saving**: Uses FileSaver.js
- **UI Components**: Custom implementation with Font Awesome icons
- **Theme System**: CSS variables with localStorage persistence

## Browser Compatibility

The application should work on all modern browsers including:
- Chrome
- Firefox
- Safari
- Edge
- Opera

Internet Explorer is not supported.

## Installation

No installation required! The application runs entirely in the browser. Simply:

1. Download the `index.html` file
2. Open it in any modern web browser

## Development

To modify or extend the application:

1. Clone the repository
2. Edit the `index.html` file
   - All CSS is in the `<style>` section
   - All JavaScript is in the `<script>` section at the bottom
3. Open the file in a browser to test changes

### Dependencies

All dependencies are loaded from CDNs:
- Font Awesome (icons)
- SweetAlert2 (alerts and dialogs)
- JSZip (ZIP file creation)
- FileSaver.js (file downloading)

## Limitations

- Maximum file size may be limited by browser memory
- Very large CSV files may cause performance issues
- Requires internet connection for QR code generation

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please open an issue or pull request for any:
- Bug fixes
- Feature requests
- Improvements to documentation

## Support

For questions or issues, please [open an issue](https://github.com/your-repo/issues) on GitHub.