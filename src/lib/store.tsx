import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createOps, type Change, type Ops } from './ops';
import { createSeed } from './seed';
import type { Access, AppState, Session, Settings } from './types';
import { uid } from './utils';

export interface Store extends Ops {
  state: AppState;
  session: Session;
  /** Managers can do everything; colleagues only work on their own tasks and reports. */
  can: { manage: boolean };
  updateSettings: (patch: Partial<Settings>) => void;
  // single-device demo mode only
  replaceState?: (s: AppState) => void;
  resetDemo?: () => void;
  clearAll?: () => void;
  // shared cloud mode only
  inviteLink?: (memberId: string) => Promise<string>;
  setAccess?: (uid: string, role: Access) => Promise<void>;
  signOut?: () => Promise<void>;
}

export const StoreCtx = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}

/* ---------- Per-device preferences (theme, motion) ---------- */

const PREFS = 'teampulse.prefs.v1';
type Prefs = Pick<Settings, 'theme' | 'effects'>;
export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && (p.theme === 'dark' || p.theme === 'light')) return { theme: p.theme, effects: p.effects !== false };
  } catch {
    /* ignore */
  }
  return { theme: 'dark', effects: true };
}
export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/* ---------- Single-device demo store (no accounts) ---------- */

const KEY = 'teampulse.state.v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && Array.isArray(s.tasks) && Array.isArray(s.members)) return { ...createSeed(), ...s, settings: { ...createSeed().settings, ...s.settings } };
    }
  } catch {
    /* storage unavailable — fall through to demo data */
  }
  return createSeed();
}

function applyLocal(s: AppState, changes: Change[]): AppState {
  const next = { ...s, members: [...s.members], tasks: [...s.tasks], reports: [...s.reports], activity: [...s.activity] };
  for (const c of changes) {
    if (c.coll === 'activity') {
      if (c.doc) next.activity = [c.doc as never, ...next.activity].slice(0, 80);
      continue;
    }
    if (c.coll !== 'members' && c.coll !== 'tasks' && c.coll !== 'reports') continue;
    const list = next[c.coll] as { id: string }[];
    const i = list.findIndex((x) => x.id === c.id);
    if (!c.doc) {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) list[i] = c.doc as never;
    else list.unshift(c.doc as never);
  }
  return next;
}

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  const session = useMemo<Session>(
    () => ({ mode: 'local', role: 'manager', uid: null, memberId: null, name: state.settings.managerName, email: '' }),
    [state.settings.managerName]
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const ops = useMemo(
    () =>
      createOps(
        () => ref.current,
        () => sessionRef.current,
        (changes) => {
          ref.current = applyLocal(ref.current, changes);
          setState(ref.current);
        }
      ),
    []
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })), []);
  const replaceState = useCallback((next: AppState) => setState(next), []);
  const resetDemo = useCallback(() => setState((s) => ({ ...createSeed(), settings: s.settings })), []);
  const clearAll = useCallback(() => setState((s) => ({ members: [], tasks: [], reports: [], activity: [], settings: s.settings })), []);

  const value = useMemo<Store>(
    () => ({ ...ops, state, session, can: { manage: true }, updateSettings, replaceState, resetDemo, clearAll }),
    [ops, state, session, updateSettings, replaceState, resetDemo, clearAll]
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/* ---------- Hash router ---------- */

export function useRoute() {
  const read = () => {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (to: string) => {
  if (location.hash.replace(/^#/, '') !== to) location.hash = to;
};

/* ---------- Toasts ---------- */

type Toast = { id: string; text: string; tone: 'ok' | 'info' | 'warn' };
const ToastCtx = createContext<{ toasts: Toast[]; toast: (text: string, tone?: Toast['tone']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = uid();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  const value = useMemo(() => ({ toasts, toast }), [toasts, toast]);
  return <ToastCtx.Provider value={value}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast outside provider');
  return ctx;
}
