import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase app (idempotent — safe in React Strict Mode / HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Auth
export const auth = getAuth(app)

// Firestore — use initializeFirestore only once on first init; fall back to
// getFirestore on subsequent module evaluations (hot reload / Strict Mode).
export const db = getApps().length === 1
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : getFirestore(app)

// Functions
export const functions = getFunctions(app)

// Storage
export const storage = getStorage(app)

// ── Emulator connections (local dev only) ─────────────────────────────────────
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectFunctionsEmulator(functions, 'localhost', 5001)
  connectStorageEmulator(storage, 'localhost', 9199)
  console.info('[TeamBeelding] Using Firebase Emulator Suite')
}

export { app }
