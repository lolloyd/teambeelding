#!/usr/bin/env node
/**
 * Assign Admin custom claim to a Firebase Auth user.
 *
 * Usage:
 *   node scripts/assignAdminClaim.js <user-email>
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase Console →
 *      Project Settings → Service accounts → Generate new private key.
 *   2. Save it as scripts/serviceAccountKey.json  (NEVER commit this file).
 *   3. Run: npm install firebase-admin   (or use the functions package)
 *
 * Security:
 *   - This script must only be run by a trusted operator.
 *   - Never commit serviceAccountKey.json.
 *   - Keep this script out of any CI environment that does not have the key.
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getAuth }             = require('firebase-admin/auth')
const path  = require('path')
const fs    = require('fs')

const keyPath = path.join(__dirname, 'serviceAccountKey.json')
if (!fs.existsSync(keyPath)) {
  console.error('Error: serviceAccountKey.json not found in scripts/.')
  console.error('Download it from Firebase Console → Project Settings → Service accounts.')
  process.exit(1)
}

const serviceAccount = require(keyPath)

// Validate this is a service account key, not a Firebase web config
if (!serviceAccount || serviceAccount.type !== 'service_account' || !serviceAccount.private_key) {
  console.error('Error: scripts/serviceAccountKey.json does not look like a valid service account key.')
  console.error('Make sure you downloaded a SERVICE ACCOUNT key, not a web app config.')
  console.error('Firebase Console → Project Settings → Service accounts → Generate new private key')
  process.exit(1)
}

let app
try {
  app = initializeApp({
    credential:  cert(serviceAccount),
    projectId:   serviceAccount.project_id,
  })
} catch (err) {
  console.error('Error initializing Firebase Admin SDK:', err.message)
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: node assignAdminClaim.js <user-email>')
  process.exit(1)
}

async function run() {
  try {
    const auth = getAuth(app)
    const user = await auth.getUserByEmail(email)
    await auth.setCustomUserClaims(user.uid, { admin: true })
    console.log(`✅ Admin claim set for ${email} (uid: ${user.uid})`)
    console.log('   The user must sign out and sign back in for the claim to take effect.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

run()
