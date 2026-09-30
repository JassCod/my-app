import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

const config: FirebaseOptions | null = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-teampulse.firebaseapp.com', projectId: 'demo-teampulse', appId: 'demo-app' }
  : firebaseConfig;

export const app = initializeApp(config!);
export const auth = getAuth(app);
// Offline cache: the app opens instantly from the device and syncs when the network is back.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  // Some networks and proxies block streaming connections; long polling works everywhere (test/diagnostic switch).
  experimentalForceLongPolling: import.meta.env.VITE_FIRESTORE_LONG_POLLING === '1',
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
