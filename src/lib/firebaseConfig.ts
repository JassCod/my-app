import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web app config (Firebase console → Project settings → Your apps → Web app).
 * These values are public identifiers, not secrets: access is protected by Firebase Authentication
 * and the security rules in `firestore.rules`.
 *
 * Set this to `null` to run the app in single-device demo mode.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyB-BsG1syBRcQ1ivLoa0Qa3UmCb8UeH49U',
  authDomain: 'task-manager-d14c4.firebaseapp.com',
  projectId: 'task-manager-d14c4',
  storageBucket: 'task-manager-d14c4.firebasestorage.app',
  messagingSenderId: '49901194077',
  appId: '1:49901194077:web:24aebc7c8045212ffb76b4',
};
