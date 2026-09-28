import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc, onSnapshot, terminate, writeBatch } from 'firebase/firestore';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Backdrop, Splash, useThemeAttrs } from '../components/Backdrop';
import { auth, db } from '../lib/firebase';
import { loadPrefs } from '../lib/store';
import type { Invite, UserDoc } from '../lib/types';
import { AuthScreens, clearPending, readPending } from './AuthScreens';
import { CloudStoreProvider } from './CloudStore';

/** Signed-out → sign-in screens; signed-in without access → finish joining; otherwise the shared app. */
export default function CloudRoot({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserDoc | null | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const stopProfile = useRef<() => void>(undefined);
  useThemeAttrs(loadPrefs());

  // Sign out: first unmount the app (stops all live queries), then clear the team's data from this device.
  const onSignOut = useCallback(() => setLeaving(true), []);
  useEffect(() => {
    if (!leaving) return;
    (async () => {
      stopProfile.current?.();
      await signOut(auth).catch(() => {});
      await terminate(db).catch(() => {});
      await clearIndexedDbPersistence(db).catch(() => {});
      location.hash = '/';
      location.reload();
    })();
  }, [leaving]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    return (stopProfile.current = onSnapshot(
      doc(db, 'users', user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        // Only trust the profile once the server has it: the access rules read it on the server.
        if (snap.metadata.hasPendingWrites) return;
        setProfile(snap.exists() ? { ...(snap.data() as UserDoc), uid: snap.id } : null);
      },
      () => setProfile(null)
    ));
  }, [user]);

  if (leaving) return <Shell><Splash text="Signing out…" /></Shell>;
  if (user === undefined || (user && profile === undefined)) return <Shell><Splash /></Shell>;
  if (!user) return <Shell><AuthScreens /></Shell>;
  if (!profile) return <Shell><FinishAccess user={user} /></Shell>;
  return (
    <CloudStoreProvider key={`${profile.role}:${profile.memberId}`} user={user} profile={profile} onSignOut={onSignOut}>
      {children}
    </CloudStoreProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Backdrop />
      <div className="app solo">
        <main className="view">{children}</main>
      </div>
    </>
  );
}

/** Completes the pending "create team" or "accept invite" step right after the account exists. */
function FinishAccess({ user }: { user: User }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const pending = readPending();
    const email = (user.email ?? '').toLowerCase();
    (async () => {
      try {
        if (pending?.kind === 'setup') {
          const ws = await getDoc(doc(db, 'meta/workspace'));
          if (ws.exists()) throw new Error('This app already has a team. Ask its manager for an invite link.');
          const b = writeBatch(db);
          const profile: UserDoc = { uid: user.uid, name: pending.name, email, role: 'manager', memberId: null, createdAt: new Date().toISOString() };
          b.set(doc(db, 'users', user.uid), profile);
          b.set(doc(db, 'meta/workspace'), { teamName: pending.teamName, ownerUid: user.uid, createdAt: new Date().toISOString() });
          await b.commit();
        } else if (pending?.kind === 'join') {
          const snap = await getDoc(doc(db, 'invites', pending.code));
          if (!snap.exists()) throw new Error('This invite is no longer valid. Ask your manager for a new link.');
          const inv = snap.data() as Invite;
          if (inv.email !== email) throw new Error(`This invite is for ${inv.email}, but you are signed in as ${email}.`);
          const b = writeBatch(db);
          const profile: UserDoc = { uid: user.uid, name: inv.name, email, role: 'member', memberId: inv.memberId, inviteCode: pending.code, createdAt: new Date().toISOString() };
          b.set(doc(db, 'users', user.uid), profile);
          b.update(doc(db, 'members', inv.memberId), { uid: user.uid });
          await b.commit();
        } else {
          setBusy(false);
          return;
        }
        clearPending();
      } catch (e) {
        const code = (e as { code?: string }).code;
        setError(code === 'permission-denied' ? 'This invite doesn’t match your account. Ask your manager for a new link.' : (e as Error).message);
        setBusy(false);
      }
    })();
  }, [user]);

  if (busy) return <Splash text="Setting up your access…" />;
  return (
    <div className="page auth">
      <div className="empty">
        <div className="empty-orb">
          <ShieldAlert size={28} />
        </div>
        <h3>No access yet</h3>
        <p>{error || `${user.email} isn’t part of a team yet. Open the invite link your manager sent you to join.`}</p>
        <button
          className="btn ghost"
          onClick={() => {
            clearPending();
            signOut(auth);
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
