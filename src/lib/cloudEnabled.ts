import { firebaseConfig } from './firebaseConfig';

/** True when the app should use shared cloud accounts instead of single-device demo mode. */
export const cloudEnabled = import.meta.env.VITE_FIREBASE_EMULATOR === '1' || !!firebaseConfig;
