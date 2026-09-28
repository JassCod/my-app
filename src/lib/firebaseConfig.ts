import type { FirebaseOptions } from 'firebase/app';

/**
 * Paste your Firebase web app config here (Firebase console → Project settings → Your apps → Web app).
 * These values are public identifiers, not secrets: access is protected by Firebase Authentication
 * and the security rules in `firestore.rules`.
 *
 * While this is `null` the app runs in single-device demo mode.
 */
export const firebaseConfig: FirebaseOptions | null = null;
