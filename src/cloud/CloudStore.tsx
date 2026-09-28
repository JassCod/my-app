import type { User } from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Splash } from '../components/Backdrop';
import { db } from '../lib/firebase';
import { createOps, type Change } from '../lib/ops';
import { StoreCtx, loadPrefs, savePrefs, useToast, type Store } from '../lib/store';
import type { Access, Activity, AppState, DailyReport, Member, Session, Settings, Task, UserDoc } from '../lib/types';
import { addDays, appUrl, todayKey } from '../lib/utils';

type Lists = Pick<AppState, 'members' | 'tasks' | 'reports' | 'activity'> & { users: UserDoc[]; teamName: string };
const KEYS = ['members', 'tasks', 'reports', 'meta'] as const;

const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 22);
};

/** Shared workspace backed by Firestore. What each person can see is decided by their access level. */
export function CloudStoreProvider({ user, profile, onSignOut, children }: { user: User; profile: UserDoc; onSignOut: () => void; children: ReactNode }) {
  const { toast } = useToast();
  const isManager = profile.role === 'manager';
  const [lists, setLists] = useState<Lists>({ members: [], tasks: [], reports: [], activity: [], users: [], teamName: '' });
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    const mark = (k: string) => setReady((r) => (r.has(k) ? r : new Set(r).add(k)));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubs: (() => void)[] = [];
    /** Live query that re-subscribes after an error (e.g. access granted a moment after sign-up). */
    const listen = <T,>(key: keyof Lists, q: Query, map = (d: T) => d, attempt = 0) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          setLists((l) => ({ ...l, [key]: snap.docs.map((d) => map({ ...(d.data() as T), id: d.id })) }));
          mark(key);
        },
        (err) => {
          console.warn(key, err.code);
          mark(key);
          if (attempt < 6) timers.push(setTimeout(() => listen(key, q, map, attempt + 1), 1000 * 2 ** attempt));
        }
      );
      unsubs.push(unsub);
    };
    const mine = profile.memberId ?? '__none__';
    listen<Member>('members', collection(db, 'members'));
    listen<Task>('tasks', isManager ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('assigneeId', '==', mine)));
    listen<DailyReport>(
      'reports',
      isManager ? query(collection(db, 'reports'), where('date', '>=', addDays(todayKey(), -180))) : query(collection(db, 'reports'), where('memberId', '==', mine))
    );
    unsubs.push(
      onSnapshot(
        doc(db, 'meta/workspace'),
        (snap) => {
          setLists((l) => ({ ...l, teamName: (snap.data()?.teamName as string) ?? '' }));
          mark('meta');
        },
        () => mark('meta')
      )
    );
    if (isManager) {
      listen<Activity>('activity', query(collection(db, 'activity'), orderBy('at', 'desc'), limit(60)));
      listen<UserDoc>('users', collection(db, 'users'), (u) => ({ ...u, uid: (u as UserDoc & { id: string }).id }));
    }
    return () => {
      unsubs.forEach((u) => u());
      timers.forEach(clearTimeout);
    };
  }, [isManager, profile.memberId]);

  const state = useMemo<AppState>(
    () => ({
      members: [...lists.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
      tasks: [...lists.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      reports: [...lists.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      activity: lists.activity,
      users: lists.users,
      settings: { teamName: lists.teamName || 'My team', managerName: profile.name, theme: prefs.theme, effects: prefs.effects },
    }),
    [lists, profile.name, prefs]
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const session = useMemo<Session>(
    () => ({ mode: 'cloud', role: profile.role, uid: user.uid, memberId: profile.memberId, name: profile.name, email: user.email ?? '' }),
    [profile, user]
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const fail = useCallback(
    (err: { code?: string }) => {
      console.warn(err);
      toast(err?.code === 'permission-denied' ? 'You don’t have permission to do that' : 'Could not save — check your connection', 'warn');
    },
    [toast]
  );

  /** Writes are applied to the local cache immediately and synced in the background (works offline). */
  const apply = useCallback(
    (changes: Change[]) => {
      for (let i = 0; i < changes.length; i += 450) {
        const batch = writeBatch(db);
        let writes = 0;
        for (const c of changes.slice(i, i + 450)) {
          const ref = doc(db, c.coll, c.id);
          if (!c.doc) batch.delete(ref);
          else if (c.prev) {
            // Only the changed fields, so two people editing different parts of a task don't overwrite each other.
            const prev = c.prev as Record<string, unknown>;
            const patch: Record<string, unknown> = {};
            for (const k of new Set([...Object.keys(prev), ...Object.keys(c.doc)])) {
              if (k === 'id') continue;
              if (!(k in c.doc) || c.doc[k] === undefined) {
                if (prev[k] !== undefined) patch[k] = deleteField();
              } else if (JSON.stringify(prev[k]) !== JSON.stringify(c.doc[k])) patch[k] = c.doc[k];
            }
            if (!Object.keys(patch).length) continue;
            batch.update(ref, patch);
          } else batch.set(ref, c.doc, { merge: !!c.merge });
          writes++;
        }
        if (writes) batch.commit().catch(fail);
      }
    },
    [fail]
  );

  const ops = useMemo(() => createOps(() => stateRef.current, () => sessionRef.current, apply), [apply]);

  const deleteMember = useCallback(
    async (id: string) => {
      const m = stateRef.current.members.find((x) => x.id === id);
      const extra: Change[] = [];
      if (m?.uid) extra.push({ coll: 'users', id: m.uid, doc: null });
      try {
        const invites = await getDocs(query(collection(db, 'invites'), where('memberId', '==', id)));
        invites.forEach((d) => extra.push({ coll: 'invites', id: d.id, doc: null }));
      } catch (e) {
        fail(e as { code?: string });
      }
      ops.deleteMember(id, extra);
    },
    [ops, fail]
  );

  const inviteLink = useCallback(async (memberId: string) => {
    const m = stateRef.current.members.find((x) => x.id === memberId);
    if (!m?.email) throw new Error('no-email');
    const existing = await getDocs(query(collection(db, 'invites'), where('memberId', '==', memberId)));
    let code = existing.docs.find((d) => d.data().email === m.email)?.id;
    if (!code) {
      code = randomCode();
      await setDoc(doc(db, 'invites', code), { code, memberId, email: m.email, name: m.name, teamName: stateRef.current.settings.teamName, createdAt: new Date().toISOString() });
    }
    return appUrl(`/join/${code}`);
  }, []);

  const setAccess = useCallback((uid: string, role: Access) => updateDoc(doc(db, 'users', uid), { role }).catch(fail), [fail]);

  const signOut = useCallback(async () => onSignOut(), [onSignOut]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      if (patch.theme !== undefined || patch.effects !== undefined) {
        setPrefs((p) => {
          const next = { theme: patch.theme ?? p.theme, effects: patch.effects ?? p.effects };
          savePrefs(next);
          return next;
        });
      }
      if (patch.teamName !== undefined && isManager) updateDoc(doc(db, 'meta/workspace'), { teamName: patch.teamName }).catch(fail);
      if (patch.managerName !== undefined) updateDoc(doc(db, 'users', user.uid), { name: patch.managerName }).catch(fail);
    },
    [isManager, user.uid, fail]
  );

  const value = useMemo<Store>(
    () => ({ ...ops, deleteMember, state, session, can: { manage: isManager }, updateSettings, inviteLink, setAccess, signOut }),
    [ops, deleteMember, state, session, isManager, updateSettings, inviteLink, setAccess, signOut]
  );

  if (KEYS.some((k) => !ready.has(k))) return <Splash text="Syncing your team…" />;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
