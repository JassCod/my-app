import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSeed } from './seed';
import type { Activity, AppState, DailyReport, Member, Note, Settings, Task } from './types';
import { memberName, uid } from './utils';

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

type TaskInput = Omit<Task, 'id' | 'createdAt' | 'notes' | 'completedAt'>;
type ReportInput = Omit<DailyReport, 'id' | 'createdAt' | 'managerNote' | 'rating' | 'reviewed'> & Partial<Pick<DailyReport, 'managerNote' | 'rating' | 'reviewed'>>;

interface Store {
  state: AppState;
  addTask: (t: TaskInput) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addNote: (taskId: string, text: string, author?: Note['author']) => void;
  addMember: (m: Omit<Member, 'id' | 'joinedAt'>) => Member;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  upsertReport: (r: ReportInput) => void;
  updateReport: (id: string, patch: Partial<DailyReport>) => void;
  deleteReport: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceState: (s: AppState) => void;
  resetDemo: () => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  const log = (s: AppState, text: string, kind: Activity['kind']): Activity[] =>
    [{ id: uid(), at: new Date().toISOString(), text, kind }, ...s.activity].slice(0, 80);

  /** Keep status, progress and completedAt consistent whichever one changed. */
  const normalize = (prev: Task | undefined, next: Task): Task => {
    const t = { ...next, progress: Math.max(0, Math.min(100, Math.round(next.progress))) };
    if (prev && next.status !== prev.status) {
      if (t.status === 'done') t.progress = 100;
      else if (prev.status === 'done' && t.progress === 100) t.progress = 90;
      else if (t.status === 'todo' && prev.status !== 'todo' && t.progress === prev.progress) t.progress = 0;
    } else if (prev && next.progress !== prev.progress) {
      t.status = t.progress >= 100 ? 'done' : t.progress > 0 ? 'in_progress' : prev.status === 'done' ? 'in_progress' : prev.status;
    }
    if (t.status === 'done') t.completedAt = t.completedAt ?? new Date().toISOString();
    else delete t.completedAt;
    return t;
  };

  const addTask = useCallback((input: TaskInput) => {
    const task = normalize(undefined, { ...input, id: uid(), createdAt: new Date().toISOString(), notes: [] });
    setState((s) => ({ ...s, tasks: [task, ...s.tasks], activity: log(s, `Assigned “${task.title}” to ${memberName(s, task.assigneeId)}`, 'task') }));
    return task;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((s) => {
      let activity = s.activity;
      const tasks = s.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = normalize(t, { ...t, ...patch });
        if (next.status === 'done' && t.status !== 'done') activity = log(s, `${memberName(s, t.assigneeId)} completed “${t.title}”`, 'task');
        else if (patch.assigneeId && patch.assigneeId !== t.assigneeId) activity = log(s, `Reassigned “${t.title}” to ${memberName(s, patch.assigneeId)}`, 'task');
        return next;
      });
      return { ...s, tasks, activity };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => {
      const t = s.tasks.find((x) => x.id === id);
      return { ...s, tasks: s.tasks.filter((x) => x.id !== id), activity: t ? log(s, `Deleted task “${t.title}”`, 'task') : s.activity };
    });
  }, []);

  const addNote = useCallback((taskId: string, text: string, author: Note['author'] = 'manager') => {
    setState((s) => {
      const t = s.tasks.find((x) => x.id === taskId);
      if (!t) return s;
      const note: Note = { id: uid(), text, at: new Date().toISOString(), author };
      return {
        ...s,
        tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, notes: [...x.notes, note] } : x)),
        activity: log(s, `${author === 'manager' ? 'You' : memberName(s, t.assigneeId)} added a note on “${t.title}”`, 'note'),
      };
    });
  }, []);

  const addMember = useCallback((m: Omit<Member, 'id' | 'joinedAt'>) => {
    const member: Member = { ...m, id: uid(), joinedAt: new Date().toISOString() };
    setState((s) => ({ ...s, members: [...s.members, member], activity: log(s, `${member.name} joined the team`, 'member') }));
    return member;
  }, []);

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const deleteMember = useCallback((id: string) => {
    setState((s) => {
      const m = s.members.find((x) => x.id === id);
      return {
        ...s,
        members: s.members.filter((x) => x.id !== id),
        tasks: s.tasks.filter((t) => t.assigneeId !== id),
        reports: s.reports.filter((r) => r.memberId !== id),
        activity: m ? log(s, `${m.name} was removed from the team`, 'member') : s.activity,
      };
    });
  }, []);

  /** One report per colleague per day: submitting again replaces the earlier one. Task updates are applied to tasks. */
  const upsertReport = useCallback((input: ReportInput) => {
    setState((s) => {
      const existing = s.reports.find((r) => r.memberId === input.memberId && r.date === input.date);
      const saved: DailyReport = {
        managerNote: existing?.managerNote ?? '',
        rating: existing?.rating ?? 0,
        reviewed: false,
        ...input,
        id: existing?.id ?? uid(),
        createdAt: new Date().toISOString(),
      };
      const reports = existing ? s.reports.map((r) => (r.id === existing.id ? saved : r)) : [saved, ...s.reports];
      const tasks = s.tasks.map((t) => {
        const u = input.taskUpdates.find((x) => x.taskId === t.id);
        return u ? normalize(t, { ...t, progress: u.progress, status: u.status }) : t;
      });
      return { ...s, reports, tasks, activity: log(s, `${memberName(s, input.memberId)} submitted a daily report`, 'report') };
    });
  }, []);

  const updateReport = useCallback((id: string, patch: Partial<DailyReport>) => {
    setState((s) => ({ ...s, reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const replaceState = useCallback((next: AppState) => setState(next), []);
  const resetDemo = useCallback(() => setState((s) => ({ ...createSeed(), settings: s.settings })), []);
  const clearAll = useCallback(
    () => setState((s) => ({ members: [], tasks: [], reports: [], activity: [], settings: s.settings })),
    []
  );

  const value = useMemo<Store>(
    () => ({ state, addTask, updateTask, deleteTask, addNote, addMember, updateMember, deleteMember, upsertReport, updateReport, deleteReport, updateSettings, replaceState, resetDemo, clearAll }),
    [state, addTask, updateTask, deleteTask, addNote, addMember, updateMember, deleteMember, upsertReport, updateReport, deleteReport, updateSettings, replaceState, resetDemo, clearAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
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
