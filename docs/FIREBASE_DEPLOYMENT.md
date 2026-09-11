# Firebase Deployment & Configuration Guide

This document outlines the steps to build, deploy, and configure Firebase services (Cloud Functions v2, Firestore Security Rules, Storage Rules, and Auth Authorized Domains) for TeamBeelding.

---

## 1. Prerequisites & CLI Setup

Make sure you have the Firebase CLI installed and logged into your account:

```bash
npm install -g firebase-tools
firebase login
firebase use --add # Select your Firebase project (e.g., teambeelding-56d56)
```

---

## 2. Deploying Cloud Functions (v2)

### Build and Deploy

Before deploying, compile the TypeScript source files inside the `functions` directory:

```bash
cd functions
npm run build
firebase deploy --only functions
```

### Fixing CORS & Invoker Permissions for 2nd Gen Cloud Functions

If your web application is hosted on a custom domain (e.g., `https://teambeelding.lloydmiguel.com`), browser preflight OPTIONS requests to Cloud Functions v2 may fail with a **CORS error** (`Access-Control-Allow-Origin` missing) if unauthenticated invoker access is not permitted at the Cloud Run IAM level.

#### Solution A: Enable Public Invocation via gcloud CLI

Run the following command for your deployed functions (or target function):

```bash
# Allow public invocation for createRoomFromDeck
gcloud run services add-iam-policy-binding createroomfromdeck \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region=us-central1

# Allow public invocation for createRoom
gcloud run services add-iam-policy-binding createroom \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region=us-central1
```

#### Solution B: Enable Public Invocation via GCP Console

1. Open [Google Cloud Console - Cloud Run](https://console.cloud.google.com/run).
2. Select your project.
3. Check the checkbox next to the function service name (e.g. `createroomfromdeck` or `createroom`).
4. Click **Permissions** in the right-hand panel.
5. Click **Add Principal**:
   - New principal: `allUsers`
   - Role: `Cloud Run Invoker`
6. Click **Save** and select **Allow unauthenticated calls**.

---

## 3. Firebase Authorized Domains

To allow user authentication (including Anonymous Authentication) from your custom domain:

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Authentication** > **Settings** > **Authorized domains**.
3. Click **Add domain**.
4. Enter your custom domain (e.g. `teambeelding.lloydmiguel.com`).
5. Click **Save**.

---

## 4. Firestore & Storage Security Rules

Deploy Firestore and Cloud Storage security rules using:

```bash
firebase deploy --only firestore:rules,storage
```

---

## 5. Summary Checklist for Hosting & Functions

- [ ] Run `cd functions && npm run build` and `firebase deploy --only functions`
- [ ] Ensure `allUsers` has `Cloud Run Invoker` role for 2nd Gen Cloud Functions (fixes CORS preflight blocks)
- [ ] Add custom domain (`teambeelding.lloydmiguel.com`) to Firebase Auth Authorized Domains
- [ ] Deploy Firestore & Storage rules (`firebase deploy --only firestore:rules,storage`)
- [ ] Build frontend (`npm run build`) and upload `dist/` contents to web server
