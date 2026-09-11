# TeamBeelding

Live team-building game platform for online company activities and watercooler sessions. A Game Master shares the main screen through Microsoft Teams while players join from any phone or browser.

---

## Architecture at a Glance

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript (strict) + Tailwind CSS |
| Routing | React Router (browser history) |
| Validation | Zod |
| Excel processing | SheetJS (xlsx) |
| ZIP processing | JSZip |
| Realtime backend | Firebase Firestore |
| Auth | Firebase Authentication (email/password + Anonymous) |
| Storage | Cloud Storage for Firebase |
| Backend logic | Cloud Functions for Firebase (TypeScript) |
| Audio | Web Audio API (synthesized - no external files) |
| Testing | Vitest + React Testing Library |
| Hosting | Namecheap cPanel (static Vite build) |

---

## Prerequisites

- Node.js 20+
- Firebase CLI: npm install -g firebase-tools
- A Firebase project with Blaze plan

---

## Local Installation

git clone <repo-url> ; cd TeamBEElding ; npm install ; cd functions && npm install && cd ..

Copy .env.example to .env.local and fill in your Firebase credentials.

---

## Admin User Creation

1. Firebase Console > Authentication > Add User
2. Run: node scripts/assignAdminClaim.js admin@example.com
   (Requires scripts/serviceAccountKey.json - never commit this file)
3. User must sign out and back in for claim to take effect

---

## Emulator Suite (Local Dev)

firebase emulators:start
Set VITE_USE_EMULATORS=true in .env.local

---

## Deploy

Rules:    firebase deploy --only firestore:rules,storage
Functions: cd functions && npm run build && firebase deploy --only functions
Frontend:  npm run build  (upload dist/ to cPanel)

See docs/DEPLOYMENT_CPANEL.md for full cPanel instructions.

---

## Production Checklist

- Anonymous + Email/Password Authentication enabled
- Admin custom claim assigned
- Firestore and Storage rules deployed (not test mode)
- App Check enabled
- Production domain added to Firebase authorized domains
- CORS configured for Storage
- .htaccess uploaded with dist/
