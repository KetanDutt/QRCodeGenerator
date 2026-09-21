# Deployment

The application is a set of static files. Deploying it means copying the repository (minus development files) to any web server or static host - or simply distributing the folder.

## What to deploy

```
index.html
css/
js/
vendor/
assets/
samples/        (optional - only the template link on the page uses it)
docs/           (optional - linked from the footer)
```

Not needed in production: `tests/`, `scripts/`, `package.json`, `node_modules/`, `.editorconfig`, `.gitignore`.

## Option A - open the file directly

Copy the folder to a shared drive or a user's machine and open `index.html`. Everything works from `file://`, including downloads. This is the simplest option for a single HR workstation and keeps data entirely offline.

## Option B - built-in server

```bash
npm start                       # 127.0.0.1:8080, local machine only
HOST=0.0.0.0 PORT=8080 npm start  # reachable on the LAN
```

`scripts/serve.js` needs only Node.js ≥ 18, serves correct MIME types, blocks path traversal and hidden folders, and sends the security headers listed below. It is fine for an intranet; for public exposure put it behind a reverse proxy with TLS or use a proper static host.

## Option C - static hosting

Any static host works: GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3 + CloudFront, Azure Static Web Apps, nginx, Apache, IIS. No server-side code, environment variables or build commands are required. Point the host at the repository root.

### GitHub Pages

Settings → Pages → *Deploy from a branch* → branch `main`, folder `/ (root)`. The app is then served at `https://<user>.github.io/QRCodeGenerator/`. Because all paths in `index.html` are relative, sub-path hosting works without changes.

## Recommended HTTP headers

The page contains no inline scripts or styles and makes no network requests after loading, so a strict policy can be applied:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains   (HTTPS only)
```

`img-src blob:` is required for the QR previews (they are Blob URLs); `data:` covers the favicon on some hosts. Drop `frame-ancestors 'none'` only if you intentionally embed the tool in another page.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name qr.example.com;
    root /var/www/qrcodegenerator;
    index index.html;

    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location ~* \.(js|css|svg)$ { expires 7d; }
    location ~ /\. { deny all; }
}
```

### Apache (`.htaccess`)

```apache
Header always set Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "no-referrer"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
AddType text/csv .csv
AddType text/vcard .vcf
```

### Netlify (`_headers`)

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Offline / air-gapped use

Nothing is fetched at runtime - fonts are system fonts, icons are inline SVG and all libraries are vendored. Once the folder is on a machine the tool works without any network access, which is the recommended setup for handling employee data.

## Updating

Replace the deployed files with the new version; there is no database or migration. Users' settings (theme, QR options) are kept in their browser's `localStorage` and survive updates.

## Versioning

The application version is defined once, in `APP_VERSION` (`js/app.js`), mirrored in `package.json` and shown in the page footer and in the `README.txt` inside every ZIP bundle. Bump all three when releasing and record the change in [CHANGELOG.md](../CHANGELOG.md).
