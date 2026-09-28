import type { Activity, AppState, DailyReport, Member, Note, Session, Task } from './types';
import { memberName, uid } from './utils';

/** One document write. `doc: null` deletes. Both the local and the cloud store apply lists of these. */
export interface Change {
  coll: 'members' | 'tasks' | 'reports' | 'activity' | 'users' | 'invites' | 'meta';
  id: string;
  doc: Record<string, unknown> | null;
  merge?: boolean;
  /** The document before this change: lets the cloud store send only the fields that changed. */
  prev?: object;
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'notes' | 'completedAt'>;
export type ReportInput = Omit<DailyReport, 'id' | 'createdAt' | 'managerNote' | 'rating' | 'reviewed'> &
  Partial<Pick<DailyReport, 'managerNote' | 'rating' | 'reviewed'>>;

/** One report per colleague per day, so the id is derived from both. */
export const reportId = (memberId: string, date: string) => `${memberId}_${date}`;

/** Keep status, progress and completedAt consistent whichever one changed. */
export function normalizeTask(prev: Task | undefined, next: Task): Task {
  const t: Task = { ...next, progress: Math.max(0, Math.min(100, Math.round(next.progress))) };
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
}

const activity = (text: string, kind: Activity['kind']): Change => {
  const a: Activity = { id: uid(), at: new Date().toISOString(), text, kind };
  return { coll: 'activity', id: a.id, doc: { ...a } };
};

const asDoc = (x: object) => ({ ...x }) as Record<string, unknown>;

/**
 * Every mutation in the app, expressed as document changes. `get` returns the latest state,
 * `apply` persists (locally or to Firestore). Permissions are enforced again by the server rules.
 */
export function createOps(get: () => AppState, session: () => Session, apply: (changes: Change[]) => void) {
  const actor = () => (session().role === 'manager' ? 'You' : session().name || 'A colleague');

  return {
    addTask(input: TaskInput): Task {
      const task = normalizeTask(undefined, { ...input, id: uid(), createdAt: new Date().toISOString(), notes: [] });
      apply([{ coll: 'tasks', id: task.id, doc: asDoc(task) }, activity(`Assigned “${task.title}” to ${memberName(get(), task.assigneeId)}`, 'task')]);
      return task;
    },

    updateTask(id: string, patch: Partial<Task>) {
      const s = get();
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return;
      const next = normalizeTask(t, { ...t, ...patch });
      const changes: Change[] = [{ coll: 'tasks', id, doc: asDoc(next), prev: t }];
      if (next.status === 'done' && t.status !== 'done') changes.push(activity(`${memberName(s, t.assigneeId)} completed “${t.title}”`, 'task'));
      else if (patch.assigneeId && patch.assigneeId !== t.assigneeId) changes.push(activity(`Reassigned “${t.title}” to ${memberName(s, patch.assigneeId)}`, 'task'));
      apply(changes);
    },

    deleteTask(id: string) {
      const t = get().tasks.find((x) => x.id === id);
      apply([{ coll: 'tasks', id, doc: null }, ...(t ? [activity(`Deleted task “${t.title}”`, 'task')] : [])]);
    },

    addNote(taskId: string, text: string) {
      const t = get().tasks.find((x) => x.id === taskId);
      if (!t) return;
      const author: Note['author'] = session().role === 'manager' ? 'manager' : 'member';
      const note: Note = { id: uid(), text, at: new Date().toISOString(), author };
      apply([{ coll: 'tasks', id: taskId, doc: asDoc({ ...t, notes: [...t.notes, note] }), prev: t }, activity(`${actor()} added a note on “${t.title}”`, 'note')]);
    },

    addMember(m: Omit<Member, 'id' | 'joinedAt'>): Member {
      const member: Member = { ...m, email: m.email.trim().toLowerCase(), id: uid(), joinedAt: new Date().toISOString() };
      apply([{ coll: 'members', id: member.id, doc: asDoc(member) }, activity(`${member.name} joined the team`, 'member')]);
      return member;
    },

    updateMember(id: string, patch: Partial<Member>) {
      const m = get().members.find((x) => x.id === id);
      if (!m) return;
      const next = { ...m, ...patch };
      if (patch.email !== undefined) next.email = patch.email.trim().toLowerCase();
      apply([{ coll: 'members', id, doc: asDoc(next), prev: m }]);
    },

    /** Removes the colleague with their tasks and reports (and, in the cloud, their access). */
    deleteMember(id: string, extra: Change[] = []) {
      const s = get();
      const m = s.members.find((x) => x.id === id);
      apply([
        { coll: 'members', id, doc: null },
        ...s.tasks.filter((t) => t.assigneeId === id).map((t): Change => ({ coll: 'tasks', id: t.id, doc: null })),
        ...s.reports.filter((r) => r.memberId === id).map((r): Change => ({ coll: 'reports', id: r.id, doc: null })),
        ...extra,
        ...(m ? [activity(`${m.name} was removed from the team`, 'member')] : []),
      ]);
    },

    /** Submitting again for the same day replaces the earlier report. Task progress in the report is applied to the tasks. */
    upsertReport(input: ReportInput) {
      const s = get();
      const id = reportId(input.memberId, input.date);
      const existing = s.reports.find((r) => r.id === id) ?? s.reports.find((r) => r.memberId === input.memberId && r.date === input.date);
      const byManager = session().role === 'manager';
      const saved: DailyReport = {
        ...input,
        managerNote: byManager ? input.managerNote ?? existing?.managerNote ?? '' : existing?.managerNote ?? '',
        rating: byManager ? input.rating ?? existing?.rating ?? 0 : existing?.rating ?? 0,
        reviewed: false,
        id: existing?.id ?? id,
        createdAt: new Date().toISOString(),
      };
      const taskChanges = s.tasks.flatMap((t): Change[] => {
        const u = input.taskUpdates.find((x) => x.taskId === t.id);
        return u ? [{ coll: 'tasks', id: t.id, doc: asDoc(normalizeTask(t, { ...t, progress: u.progress, status: u.status })), prev: t }] : [];
      });
      apply([{ coll: 'reports', id: saved.id, doc: asDoc(saved), prev: existing }, ...taskChanges, activity(`${memberName(s, input.memberId)} submitted a daily report`, 'report')]);
    },

    updateReport(id: string, patch: Partial<DailyReport>) {
      const r = get().reports.find((x) => x.id === id);
      if (r) apply([{ coll: 'reports', id, doc: asDoc({ ...r, ...patch }), prev: r }]);
    },

    deleteReport(id: string) {
      apply([{ coll: 'reports', id, doc: null }]);
    },
  };
}

export type Ops = ReturnType<typeof createOps>;
