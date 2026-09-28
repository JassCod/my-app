import type { AppState, DailyReport, Task } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());
export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key: string, days: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
};
export const isoToKey = (iso: string) => toKey(new Date(iso));

export const fmtDate = (key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  fromKey(key).toLocaleDateString(undefined, opts);
export const fmtLongDate = (key: string) =>
  fromKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const relTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const dueLabel = (key: string) => {
  const t = todayKey();
  if (key === t) return 'Due today';
  if (key === addDays(t, 1)) return 'Due tomorrow';
  if (key < t) {
    const days = Math.round((fromKey(t).getTime() - fromKey(key).getTime()) / 86400000);
    return `${days}d overdue`;
  }
  return `Due ${fmtDate(key)}`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Whether a task was finished on or before the end of `dayKey`. */
export const doneBy = (t: Task, dayKey: string) => !!t.completedAt && isoToKey(t.completedAt) <= dayKey;
/** Whether a task existed on `dayKey`. */
export const existedOn = (t: Task, dayKey: string) => isoToKey(t.createdAt) <= dayKey;
export const isOverdue = (t: Task, dayKey = todayKey()) => t.status !== 'done' && t.dueDate < dayKey;

export interface DaySummary {
  date: string;
  completed: Task[];
  incomplete: Task[];
  overdue: Task[];
  carriedOver: Task[];
  reports: DailyReport[];
  missing: string[]; // member ids without a report
  rate: number; // 0..100 completion rate of work active that day
  hours: number;
}

/** The record of a single day: what got done, what is still open, who reported. */
export function summarizeDay(state: AppState, date: string): DaySummary {
  const active = state.tasks.filter((t) => existedOn(t, date) && (!t.completedAt || isoToKey(t.completedAt) >= date));
  const completed = active.filter((t) => t.completedAt && isoToKey(t.completedAt) === date);
  const incomplete = active.filter((t) => !doneBy(t, date));
  const overdue = incomplete.filter((t) => t.dueDate < date);
  const carriedOver = incomplete.filter((t) => isoToKey(t.createdAt) < date);
  const reports = state.reports.filter((r) => r.date === date);
  const reported = new Set(reports.map((r) => r.memberId));
  const missing = state.members.filter((m) => isoToKey(m.joinedAt) <= date && !reported.has(m.id)).map((m) => m.id);
  const total = completed.length + incomplete.length;
  return {
    date,
    completed,
    incomplete,
    overdue,
    carriedOver,
    reports,
    missing,
    rate: total ? Math.round((completed.length / total) * 100) : 0,
    hours: reports.reduce((s, r) => s + (Number(r.hours) || 0), 0),
  };
}

export const memberName = (state: AppState, id: string) => state.members.find((m) => m.id === id)?.name ?? 'Unassigned';

export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;
export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' } as const;
export const MOODS = ['😣', '😕', '😐', '🙂', '🤩'];

export const MEMBER_COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#a78bfa'];

/** Base64url-encode JSON so it can travel inside a share link. */
export const encodePayload = (data: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const decodePayload = <T,>(s: string): T | null => {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
};

/** Absolute URL to a route inside this app (works from any host / sub-path). */
export const appUrl = (route: string) => `${location.origin}${location.pathname}#${route}`;
