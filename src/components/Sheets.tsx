import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, Link2, Pencil, Send, Share2, Trash2 } from 'lucide-react';
import { useStore, useToast } from '../lib/store';
import { shareText } from '../lib/exporters';
import type { DailyReport, Member, Priority, Task, TaskStatus, TaskUpdate } from '../lib/types';
import { MEMBER_COLORS, MOODS, STATUS_LABEL, addDays, appUrl, dueLabel, encodePayload, fmtDate, fmtLongDate, isOverdue, memberName, relTime, todayKey } from '../lib/utils';
import { Avatar, Field, PriorityBadge, ProgressBar, Segmented, Sheet, StatusBadge, Stars } from './ui';

type Open =
  | { kind: 'task'; id: string }
  | { kind: 'taskForm'; id?: string; assigneeId?: string }
  | { kind: 'report'; id: string }
  | { kind: 'reportForm'; memberId?: string; date?: string }
  | { kind: 'memberForm'; id?: string }
  | { kind: 'request'; memberId: string }
  | null;

interface SheetApi {
  openTask: (id: string) => void;
  newTask: (assigneeId?: string) => void;
  editTask: (id: string) => void;
  openReport: (id: string) => void;
  newReport: (memberId?: string, date?: string) => void;
  newMember: () => void;
  editMember: (id: string) => void;
  requestReport: (memberId: string) => void;
}

const Ctx = createContext<SheetApi | null>(null);
export const useSheets = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSheets outside provider');
  return c;
};

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [close]);
  const api = useMemo<SheetApi>(
    () => ({
      openTask: (id) => setOpen({ kind: 'task', id }),
      newTask: (assigneeId) => setOpen({ kind: 'taskForm', assigneeId }),
      editTask: (id) => setOpen({ kind: 'taskForm', id }),
      openReport: (id) => setOpen({ kind: 'report', id }),
      newReport: (memberId, date) => setOpen({ kind: 'reportForm', memberId, date }),
      newMember: () => setOpen({ kind: 'memberForm' }),
      editMember: (id) => setOpen({ kind: 'memberForm', id }),
      requestReport: (memberId) => setOpen({ kind: 'request', memberId }),
    }),
    []
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      {open?.kind === 'task' && <TaskDetail id={open.id} onClose={close} api={api} />}
      {open?.kind === 'taskForm' && <TaskForm id={open.id} assigneeId={open.assigneeId} onClose={close} api={api} />}
      {open?.kind === 'report' && <ReportDetail id={open.id} onClose={close} api={api} />}
      {open?.kind === 'reportForm' && <ReportForm memberId={open.memberId} date={open.date} onClose={close} />}
      {open?.kind === 'memberForm' && <MemberForm id={open.id} onClose={close} />}
      {open?.kind === 'request' && <RequestReport memberId={open.memberId} onClose={close} />}
    </Ctx.Provider>
  );
}

/* ---------------- Task detail: status, progress, manager add-ons ---------------- */

function TaskDetail({ id, onClose, api }: { id: string; onClose: () => void; api: SheetApi }) {
  const { state, updateTask, deleteTask, addNote } = useStore();
  const { toast } = useToast();
  const task = state.tasks.find((t) => t.id === id);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!task) return null;
  const member = state.members.find((m) => m.id === task.assigneeId);

  const share = async () => {
    const text = `📌 Task for ${member?.name ?? 'you'}: ${task.title}\n${task.description ? task.description + '\n' : ''}Priority: ${task.priority} · ${dueLabel(task.dueDate)} · Progress ${task.progress}%\n\nSend your daily report here:`;
    const res = await shareText(task.title, text, reportLink(state, task.assigneeId));
    if (res === 'copied') toast('Task details copied to clipboard');
    if (res === 'failed') toast('Could not share on this device', 'warn');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Task details"
      footer={
        <>
          <button className="btn ghost" onClick={share}>
            <Share2 size={16} /> Share
          </button>
          <button className="btn ghost" onClick={() => api.editTask(task.id)}>
            <Pencil size={16} /> Edit
          </button>
          {confirm ? (
            <button
              className="btn danger"
              onClick={() => {
                deleteTask(task.id);
                toast('Task deleted', 'info');
                onClose();
              }}
            >
              <Trash2 size={16} /> Confirm
            </button>
          ) : (
            <button className="btn ghost danger-text" onClick={() => setConfirm(true)} aria-label="Delete task">
              <Trash2 size={16} />
            </button>
          )}
        </>
      }
    >
      <div className="td-head">
        <div className="tc-top">
          <StatusBadge status={task.status} overdue={isOverdue(task)} />
          <PriorityBadge priority={task.priority} />
        </div>
        <h3 className="td-title">{task.title}</h3>
        {task.description && <p className="muted">{task.description}</p>}
        <div className="td-facts">
          <div>
            <small>Assigned to</small>
            <span className="row gap-6">
              <Avatar member={member} size={22} /> {member?.name ?? 'Unassigned'}
            </span>
          </div>
          <div>
            <small>Due</small>
            <span className={isOverdue(task) ? 'danger' : ''}>{fmtDate(task.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <div>
            <small>Created</small>
            <span>{relTime(task.createdAt)}</span>
          </div>
        </div>
      </div>

      <Field label="Status">
        <Segmented<TaskStatus>
          value={task.status}
          onChange={(status) => updateTask(task.id, { status })}
          options={(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
      </Field>

      <Field label={`Progress · ${task.progress}%`}>
        <input className="range" type="range" min={0} max={100} step={5} value={task.progress} onChange={(e) => updateTask(task.id, { progress: Number(e.target.value) })} style={{ ['--val' as string]: `${task.progress}%` }} />
      </Field>

      <div className="field">
        <span className="field-label">Notes & add-ons ({task.notes.length})</span>
        <div className="notes">
          {task.notes.length === 0 && <p className="muted small">No notes yet. Add instructions, feedback or extra work for this task.</p>}
          {task.notes.map((n) => (
            <div key={n.id} className={`note ${n.author}`}>
              <div className="note-meta">
                {n.author === 'manager' ? state.settings.managerName : member?.name ?? 'Colleague'} · {relTime(n.at)}
              </div>
              {n.text}
            </div>
          ))}
        </div>
        <form
          className="note-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            addNote(task.id, note.trim());
            setNote('');
            toast('Note added');
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or extra instruction…" />
          <button className="btn primary icon" aria-label="Add note" disabled={!note.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </Sheet>
  );
}

/* ---------------- Task create / edit ---------------- */

function TaskForm({ id, assigneeId, onClose, api }: { id?: string; assigneeId?: string; onClose: () => void; api: SheetApi }) {
  const { state, addTask, updateTask } = useStore();
  const { toast } = useToast();
  const existing = id ? state.tasks.find((t) => t.id === id) : undefined;
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    assigneeId: existing?.assigneeId ?? assigneeId ?? state.members[0]?.id ?? '',
    priority: existing?.priority ?? ('medium' as Priority),
    dueDate: existing?.dueDate ?? addDays(todayKey(), 1),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.assigneeId && form.dueDate;

  const save = () => {
    if (!valid) return;
    if (existing) {
      updateTask(existing.id, { ...form, title: form.title.trim() });
      toast('Task updated');
      api.openTask(existing.id);
    } else {
      addTask({ ...form, title: form.title.trim(), status: 'todo', progress: 0 });
      toast(`Task assigned to ${memberName(state, form.assigneeId)}`);
      onClose();
    }
  };

  if (!state.members.length)
    return (
      <Sheet open onClose={onClose} title="Assign a task">
        <p className="muted">Add a colleague to your team first, then you can assign tasks to them.</p>
        <button className="btn primary block" onClick={api.newMember}>
          Add colleague
        </button>
      </Sheet>
    );

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Edit task' : 'Assign a new task'}
      footer={
        <button className="btn primary block" disabled={!valid} onClick={save}>
          <Check size={16} /> {existing ? 'Save changes' : 'Assign task'}
        </button>
      }
    >
      <Field label="Title">
        <input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Prepare weekly sales summary" />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Details, links, acceptance criteria…" />
      </Field>
      <div className="field">
        <span className="field-label">Assign to</span>
        <div className="assignee-pick">
          {state.members.map((m) => (
            <button type="button" key={m.id} className={`assignee ${form.assigneeId === m.id ? 'active' : ''}`} onClick={() => set('assigneeId', m.id)}>
              <Avatar member={m} size={38} />
              <span>{m.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
      <Field label="Priority">
        <Segmented<Priority>
          value={form.priority}
          onChange={(v) => set('priority', v)}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Field>
      <Field label="Due date">
        <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
      </Field>
    </Sheet>
  );
}

/* ---------------- Report detail: manager review & add-on ---------------- */

function ReportDetail({ id, onClose, api }: { id: string; onClose: () => void; api: SheetApi }) {
  const { state, updateReport, deleteReport } = useStore();
  const { toast } = useToast();
  const report = state.reports.find((r) => r.id === id);
  const [note, setNote] = useState(report?.managerNote ?? '');
  const [confirm, setConfirm] = useState(false);
  if (!report) return null;
  const member = state.members.find((m) => m.id === report.memberId);
  const openTasks = state.tasks.filter((t) => t.assigneeId === report.memberId && t.status !== 'done');

  return (
    <Sheet
      open
      onClose={onClose}
      title="Daily report"
      footer={
        <>
          {confirm ? (
            <button
              className="btn danger"
              onClick={() => {
                deleteReport(report.id);
                toast('Report deleted', 'info');
                onClose();
              }}
            >
              <Trash2 size={16} /> Confirm
            </button>
          ) : (
            <button className="btn ghost danger-text" onClick={() => setConfirm(true)} aria-label="Delete report">
              <Trash2 size={16} />
            </button>
          )}
          <button
            className="btn primary grow"
            onClick={() => {
              updateReport(report.id, { managerNote: note.trim(), reviewed: true });
              toast('Report reviewed');
              onClose();
            }}
          >
            <Check size={16} /> Save & mark reviewed
          </button>
        </>
      }
    >
      <div className="rd-head">
        <Avatar member={member} size={48} />
        <div>
          <h3>{member?.name ?? 'Former colleague'}</h3>
          <p className="muted small">
            {fmtLongDate(report.date)} · {report.source === 'colleague' ? 'Submitted by colleague' : 'Recorded by you'}
          </p>
        </div>
        <span className="mood-big" title={`Mood ${report.mood}/5`}>
          {MOODS[report.mood - 1]}
        </span>
      </div>
      <div className="rd-grid">
        <div className="rd-block ok">
          <small>Accomplished</small>
          <p>{report.accomplished || '—'}</p>
        </div>
        <div className={`rd-block ${report.blockers ? 'warn' : ''}`}>
          <small>Blockers</small>
          <p>{report.blockers || 'None reported'}</p>
        </div>
        <div className="rd-block">
          <small>Plan for next day</small>
          <p>{report.tomorrow || '—'}</p>
        </div>
        <div className="rd-block">
          <small>Hours worked</small>
          <p className="big">{report.hours}h</p>
        </div>
      </div>
      {report.taskUpdates.length > 0 && (
        <div className="field">
          <span className="field-label">Task updates in this report</span>
          {report.taskUpdates.map((u) => {
            const t = state.tasks.find((x) => x.id === u.taskId);
            return (
              <div key={u.taskId} className="mini-row">
                <span className="grow">{t?.title ?? 'Removed task'}</span>
                <span className="muted small">{STATUS_LABEL[u.status]}</span>
                <strong>{u.progress}%</strong>
              </div>
            );
          })}
        </div>
      )}
      {openTasks.length > 0 && (
        <div className="field">
          <span className="field-label">Still incomplete for {member?.name.split(' ')[0]}</span>
          {openTasks.map((t) => (
            <button key={t.id} className="mini-row pressable" onClick={() => api.openTask(t.id)}>
              <span className="grow">{t.title}</span>
              <span className={`small ${isOverdue(t) ? 'danger' : 'muted'}`}>{dueLabel(t.dueDate)}</span>
              <span className="mini-progress">
                <ProgressBar value={t.progress} />
              </span>
            </button>
          ))}
        </div>
      )}
      <Field label="Your rating">
        <Stars value={report.rating} onChange={(rating) => updateReport(report.id, { rating })} />
      </Field>
      <Field label="Manager note / add-on">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feedback, extra instructions or follow-ups…" />
      </Field>
    </Sheet>
  );
}

/* ---------------- Report create (manager records on behalf) ---------------- */

export function ReportFields({
  tasks,
  value,
  onChange,
}: {
  tasks: Pick<Task, 'id' | 'title' | 'progress' | 'status'>[];
  value: ReportDraft;
  onChange: (v: ReportDraft) => void;
}) {
  const set = <K extends keyof ReportDraft>(k: K, v: ReportDraft[K]) => onChange({ ...value, [k]: v });
  const setUpdate = (taskId: string, progress: number) => {
    const others = value.taskUpdates.filter((u) => u.taskId !== taskId);
    const status: TaskStatus = progress >= 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo';
    onChange({ ...value, taskUpdates: [...others, { taskId, progress, status }] });
  };
  return (
    <>
      <Field label="What was accomplished?">
        <textarea rows={3} value={value.accomplished} onChange={(e) => set('accomplished', e.target.value)} placeholder="Work completed today…" />
      </Field>
      <Field label="Blockers / issues">
        <textarea rows={2} value={value.blockers} onChange={(e) => set('blockers', e.target.value)} placeholder="Anything slowing you down? (optional)" />
      </Field>
      <Field label="Plan for tomorrow">
        <textarea rows={2} value={value.tomorrow} onChange={(e) => set('tomorrow', e.target.value)} placeholder="Next steps…" />
      </Field>
      <div className="row gap-12">
        <Field label="Hours">
          <input type="number" min={0} max={24} step={0.5} value={value.hours} onChange={(e) => set('hours', Number(e.target.value))} />
        </Field>
        <div className="field grow">
          <span className="field-label">Mood</span>
          <div className="moods">
            {MOODS.map((m, i) => (
              <button type="button" key={m} className={value.mood === i + 1 ? 'active' : ''} onClick={() => set('mood', i + 1)} aria-label={`Mood ${i + 1}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tasks.length > 0 && (
        <div className="field">
          <span className="field-label">Update task progress</span>
          {tasks.map((t) => {
            const p = value.taskUpdates.find((u) => u.taskId === t.id)?.progress ?? t.progress;
            return (
              <div key={t.id} className="task-slider">
                <div className="row">
                  <span className="grow">{t.title}</span>
                  <strong>{p}%</strong>
                </div>
                <input className="range" type="range" min={0} max={100} step={5} value={p} onChange={(e) => setUpdate(t.id, Number(e.target.value))} style={{ ['--val' as string]: `${p}%` }} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export interface ReportDraft {
  accomplished: string;
  blockers: string;
  tomorrow: string;
  hours: number;
  mood: number;
  taskUpdates: TaskUpdate[];
}
export const emptyDraft = (): ReportDraft => ({ accomplished: '', blockers: '', tomorrow: '', hours: 8, mood: 4, taskUpdates: [] });

function ReportForm({ memberId, date, onClose }: { memberId?: string; date?: string; onClose: () => void }) {
  const { state, upsertReport } = useStore();
  const { toast } = useToast();
  const [who, setWho] = useState(memberId ?? state.members[0]?.id ?? '');
  const [day, setDay] = useState(date ?? todayKey());
  const existing = state.reports.find((r) => r.memberId === who && r.date === day);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);
  useEffect(() => {
    setDraft(existing ? { accomplished: existing.accomplished, blockers: existing.blockers, tomorrow: existing.tomorrow, hours: existing.hours, mood: existing.mood, taskUpdates: [] } : emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, day]);
  const tasks = state.tasks.filter((t) => t.assigneeId === who && t.status !== 'done');

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Edit daily report' : 'Record daily report'}
      footer={
        <button
          className="btn primary block"
          disabled={!who || !draft.accomplished.trim()}
          onClick={() => {
            upsertReport({ ...draft, memberId: who, date: day, source: existing?.source ?? 'manager' });
            toast('Report saved');
            onClose();
          }}
        >
          <Check size={16} /> Save report
        </button>
      }
    >
      <div className="row gap-12">
        <Field label="Colleague">
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
      </div>
      {existing && <p className="hint-box">A report already exists for this day — saving replaces it.</p>}
      <ReportFields tasks={tasks} value={draft} onChange={setDraft} />
    </Sheet>
  );
}

/* ---------------- Member create / edit ---------------- */

function MemberForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const { state, addMember, updateMember } = useStore();
  const { toast } = useToast();
  const existing = id ? state.members.find((m) => m.id === id) : undefined;
  const [form, setForm] = useState<Omit<Member, 'id' | 'joinedAt'>>({
    name: existing?.name ?? '',
    role: existing?.role ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    color: existing?.color ?? MEMBER_COLORS[state.members.length % MEMBER_COLORS.length],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim().length > 1;
  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Edit colleague' : 'Add colleague'}
      footer={
        <button
          className="btn primary block"
          disabled={!valid}
          onClick={() => {
            const clean = { ...form, name: form.name.trim(), role: form.role.trim() || 'Team member' };
            if (existing) updateMember(existing.id, clean);
            else addMember(clean);
            toast(existing ? 'Colleague updated' : `${clean.name} added to the team`);
            onClose();
          }}
        >
          <Check size={16} /> {existing ? 'Save' : 'Add to team'}
        </button>
      }
    >
      <div className="member-preview">
        <Avatar member={{ name: form.name || '?', color: form.color }} size={72} />
      </div>
      <Field label="Full name">
        <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Neha Verma" />
      </Field>
      <Field label="Role">
        <input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Sales Executive" />
      </Field>
      <div className="row gap-12">
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" />
        </Field>
      </div>
      <div className="field">
        <span className="field-label">Colour</span>
        <div className="swatches">
          {MEMBER_COLORS.map((c) => (
            <button type="button" key={c} className={form.color === c ? 'active' : ''} style={{ background: c }} onClick={() => set('color', c)} aria-label={`Colour ${c}`} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- Request a report from a colleague via link ---------------- */

export interface SubmitPayload {
  v: 1;
  memberId: string;
  name: string;
  team: string;
  manager: string;
  tasks: { id: string; title: string; progress: number; status: TaskStatus; dueDate: string }[];
}

export function reportLink(state: ReturnType<typeof useStore>['state'], memberId: string) {
  const m = state.members.find((x) => x.id === memberId);
  const payload: SubmitPayload = {
    v: 1,
    memberId,
    name: m?.name ?? '',
    team: state.settings.teamName,
    manager: state.settings.managerName,
    tasks: state.tasks.filter((t) => t.assigneeId === memberId && t.status !== 'done').map((t) => ({ id: t.id, title: t.title, progress: t.progress, status: t.status, dueDate: t.dueDate })),
  };
  return appUrl(`/submit/${encodePayload(payload)}`);
}

function RequestReport({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { state } = useStore();
  const { toast } = useToast();
  const member = state.members.find((m) => m.id === memberId);
  const link = reportLink(state, memberId);
  const message = `Hi ${member?.name.split(' ')[0] ?? ''}, please submit your daily report for ${fmtDate(todayKey(), { weekday: 'long', day: 'numeric', month: 'short' })} using this link. It also shows your open tasks so you can update progress.`;
  return (
    <Sheet open onClose={onClose} title="Request daily report">
      <div className="rd-head">
        <Avatar member={member} size={48} />
        <div>
          <h3>{member?.name}</h3>
          <p className="muted small">{member?.role}</p>
        </div>
      </div>
      <p className="muted">
        Send this personal link to your colleague. They fill in the report on their phone, then tap <b>Send to manager</b> — you open the link they send back and the report is added here automatically.
      </p>
      <div className="link-box">
        <Link2 size={16} />
        <span>{link}</span>
      </div>
      <div className="stack gap-8">
        <button
          className="btn primary block"
          onClick={async () => {
            const res = await shareText('Daily report request', message, link);
            if (res === 'copied') toast('Request copied — paste it in WhatsApp, Slack or email');
            if (res === 'failed') toast('Could not share on this device', 'warn');
          }}
        >
          <Share2 size={16} /> Share request
        </button>
        {member?.email && (
          <a className="btn ghost block" href={`mailto:${member.email}?subject=${encodeURIComponent('Daily report request')}&body=${encodeURIComponent(message + '\n\n' + link)}`}>
            <Send size={16} /> Send by email
          </a>
        )}
        {member?.phone && (
          <a className="btn ghost block" href={`https://wa.me/${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message + '\n' + link)}`} target="_blank" rel="noreferrer">
            <Send size={16} /> Send on WhatsApp
          </a>
        )}
        <button
          className="btn ghost block"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast('Link copied');
            } catch {
              toast('Copy failed — long-press the link to copy', 'warn');
            }
          }}
        >
          <Copy size={16} /> Copy link only
        </button>
      </div>
    </Sheet>
  );
}

export type { DailyReport };
