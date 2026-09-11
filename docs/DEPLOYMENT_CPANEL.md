# Deploying to Namecheap cPanel

## Build

```bash
npm run build
```

This produces the `dist/` folder containing all static assets.

---

## What to Upload

Upload the **entire contents** of `dist/` — not the `dist/` folder itself.

```
dist/
  index.html         ← upload this to the destination root
  assets/            ← upload this folder
  .htaccess          ← upload this (copied from public/ by Vite)
```

---

## Where to Place Files

| Scenario | Upload destination in cPanel |
|---|---|
| Root domain (yourdomain.com) | `public_html/` |
| Subdomain (app.yourdomain.com) | `public_html/app/` or the subdomain's document root |

---

## .htaccess

The `.htaccess` file in `public/` is automatically copied to `dist/` during build.
It handles:
- HTTP → HTTPS redirect
- Single-page application routing (all unknown routes → `index.html`)
- Long-term caching for hashed assets
- No-cache for `index.html`

**If your host does not have `mod_rewrite` enabled**, contact Namecheap support to enable it, or enable it via MultiPHP INI Editor if available.

---

## File Manager Upload Steps

1. Log in to Namecheap cPanel
2. Open **File Manager**
3. Navigate to `public_html/` (or your target directory)
4. Click **Upload** → drag and drop all files from `dist/`
5. After upload, confirm `.htaccess` is present (File Manager may hide dotfiles — enable "Show Hidden Files")

**Alternative: FTP/SFTP**
Use FileZilla or similar client to transfer all `dist/` contents.

---

## Domain Setup

1. Ensure your domain points to your Namecheap hosting
2. SSL/TLS must be active — the `.htaccess` enforces HTTPS redirect
3. Add your production domain to Firebase → Authentication → Settings → Authorized domains

---

## HTTPS

Namecheap provides free AutoSSL certificates. Ensure AutoSSL is enabled in cPanel → SSL/TLS → Manage AutoSSL.

---

## Firebase Authorized Domains

Add the following in Firebase Console → Authentication → Settings → Authorized domains:
- `yourdomain.com`
- `www.yourdomain.com` (if applicable)

---

## Cache Invalidation

Vite generates content-hashed filenames for all JS/CSS assets (e.g., `index-Abc123.js`). On each new deploy:
- Browsers automatically fetch the new hashed files
- Only `index.html` needs forced cache clearing (it has no cache headers and is set to `no-store`)

---

## Updating a Deployment

1. Run `npm run build`
2. Upload the new `dist/` contents, overwriting existing files
3. The updated `index.html` will reference the new hashed asset filenames

---

## Rollback

To roll back to a previous version:
1. Keep a copy of the previous `dist/` folder locally (or use Git to check out the previous commit and rebuild)
2. Upload the previous `dist/` contents

---

## Verifying SPA Routing

After uploading, test these URLs directly in the browser (no navigating from home — type them in the address bar):
- `https://yourdomain.com/join`
- `https://yourdomain.com/admin`
- `https://yourdomain.com/host`

All should load the React app (not a 404 from the server).
