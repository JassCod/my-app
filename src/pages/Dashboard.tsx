import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, FileText, ListTodo, Plus, Sparkles, UserPlus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSheets } from '../components/Sheets';
import { TaskCard } from '../components/TaskCard';
import { Avatar, AvatarStack, CountUp, Empty, ProgressRing, SectionTitle, TiltCard } from '../components/ui';
import { WeekChart } from '../components/WeekChart';
import { navigate, useStore } from '../lib/store';
import { addDays, fmtDate, fmtLongDate, greeting, isOverdue, isoToKey, relTime, summarizeDay, todayKey } from '../lib/utils';

export function Dashboard() {
  const { state } = useStore();
  const sheets = useSheets();
  const today = todayKey();
  const sum = useMemo(() => summarizeDay(state, today), [state, today]);
  const open = state.tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => isOverdue(t));
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = addDays(today, i - 6);
        const n = state.tasks.filter((t) => t.completedAt && isoToKey(t.completedAt) === key).length;
        const reports = state.reports.filter((r) => r.date === key).length;
        return { key, label: fmtDate(key, { weekday: 'narrow' }), value: n, sub: `${reports} report${reports === 1 ? '' : 's'}` };
      }),
    [state, today]
  );
  const focus = [...overdue, ...open.filter((t) => !isOverdue(t) && t.priority === 'high')].slice(0, 3);
  const missing = state.members.filter((m) => sum.missing.includes(m.id));

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">{fmtLongDate(today)}</p>
        <h1>
          {greeting()}, <span className="grad-text">{state.settings.managerName.split(' ')[0]}</span>
        </h1>
        <p className="muted">Here’s how {state.settings.teamName} is doing today.</p>
      </header>

      <TiltCard className="hero-card" intensity={10}>
        <div className="hc-glow" aria-hidden />
        <div className="hc-body">
          <ProgressRing value={sum.rate} size={128} label={`${sum.rate}%`} sub="done today" />
          <div className="hc-stats">
            <div>
              <strong>
                <CountUp value={sum.completed.length} />
              </strong>
              <span>Completed today</span>
            </div>
            <div>
              <strong>
                <CountUp value={sum.incomplete.length} />
              </strong>
              <span>Incomplete</span>
            </div>
            <div>
              <strong>
                <CountUp value={sum.reports.length} />
                <small>/{state.members.length}</small>
              </strong>
              <span>Reports in</span>
            </div>
          </div>
        </div>
        <button className="hc-cta" onClick={() => navigate('/reports')}>
          Open today’s report <ArrowRight size={16} />
        </button>
      </TiltCard>

      <div className="stat-grid">
        <TiltCard className="stat" onClick={() => navigate('/tasks?f=all')}>
          <span className="stat-icon i-violet">
            <ListTodo size={18} />
          </span>
          <strong>
            <CountUp value={state.tasks.length} />
          </strong>
          <span>Total tasks</span>
        </TiltCard>
        <TiltCard className="stat" onClick={() => navigate('/tasks?f=in_progress')}>
          <span className="stat-icon i-cyan">
            <Sparkles size={18} />
          </span>
          <strong>
            <CountUp value={open.length} />
          </strong>
          <span>Open tasks</span>
        </TiltCard>
        <TiltCard className="stat" onClick={() => navigate('/tasks?f=overdue')}>
          <span className="stat-icon i-rose">
            <AlertTriangle size={18} />
          </span>
          <strong>
            <CountUp value={overdue.length} />
          </strong>
          <span>Overdue</span>
        </TiltCard>
        <TiltCard className="stat" onClick={() => navigate('/team')}>
          <span className="stat-icon i-green">
            <Users size={18} />
          </span>
          <strong>
            <CountUp value={state.members.length} />
          </strong>
          <span>Colleagues</span>
        </TiltCard>
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="quick">
        <button className="quick-btn" onClick={() => sheets.newTask()}>
          <span className="q-orb g1">
            <Plus size={20} />
          </span>
          Assign task
        </button>
        <button className="quick-btn" onClick={() => sheets.newReport()}>
          <span className="q-orb g2">
            <FileText size={20} />
          </span>
          Add report
        </button>
        <button className="quick-btn" onClick={() => navigate('/reports')}>
          <span className="q-orb g3">
            <ClipboardList size={20} />
          </span>
          Daily log
        </button>
        <button className="quick-btn" onClick={() => sheets.newMember()}>
          <span className="q-orb g4">
            <UserPlus size={20} />
          </span>
          Add colleague
        </button>
      </div>

      <SectionTitle action={<span className="muted small">Tap a bar</span>}>Tasks completed · last 7 days</SectionTitle>
      <div className="glass card-pad">
        <WeekChart bars={week} onPick={(key) => navigate(`/reports?d=${key}`)} selected={today} />
      </div>

      {missing.length > 0 && (
        <>
          <SectionTitle>Waiting for today’s report</SectionTitle>
          <div className="glass card-pad pending-reports">
            <AvatarStack members={missing} />
            <p className="grow small">
              <b>{missing.length}</b> colleague{missing.length > 1 ? 's have' : ' has'} not reported yet
            </p>
            <button className="btn small primary" onClick={() => sheets.requestReport(missing[0].id)}>
              Request
            </button>
          </div>
        </>
      )}

      <SectionTitle action={<button className="link" onClick={() => navigate('/tasks?f=overdue')}>See all</button>}>Needs attention</SectionTitle>
      {focus.length ? (
        <div className="stack gap-12">
          {focus.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={(x) => sheets.openTask(x.id)} />
          ))}
        </div>
      ) : (
        <Empty icon={CheckCircle2} title="All clear" text="Nothing overdue or high priority right now." />
      )}

      <SectionTitle>Recent activity</SectionTitle>
      <div className="glass timeline">
        {state.activity.slice(0, 6).map((a) => (
          <div key={a.id} className={`tl-item k-${a.kind}`}>
            <span className="tl-dot" />
            <div>
              <p>{a.text}</p>
              <small>{relTime(a.at)}</small>
            </div>
          </div>
        ))}
        {!state.activity.length && <p className="muted small pad">No activity yet.</p>}
      </div>

      {state.members.length > 0 && (
        <>
          <SectionTitle action={<button className="link" onClick={() => navigate('/team')}>Team</button>}>Team pulse</SectionTitle>
          <div className="h-scroll">
            {state.members.map((m) => {
              const mine = state.tasks.filter((t) => t.assigneeId === m.id);
              const done = mine.filter((t) => t.status === 'done').length;
              const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
              const reported = !sum.missing.includes(m.id);
              return (
                <TiltCard key={m.id} className="pulse-card" onClick={() => navigate(`/team/${m.id}`)}>
                  <Avatar member={m} size={44} />
                  <strong>{m.name.split(' ')[0]}</strong>
                  <small className="muted">{m.role}</small>
                  <ProgressRing value={pct} size={56} stroke={6} label={`${pct}%`} />
                  <span className={`badge ${reported ? 'tone-good' : 'tone-warning'}`}>{reported ? 'Reported' : 'Pending'}</span>
                </TiltCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
