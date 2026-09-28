import { ArrowRight, CheckCircle2, ClipboardList, FileText, MessageSquare } from 'lucide-react';
import { useSheets } from '../components/Sheets';
import { TaskCard } from '../components/TaskCard';
import { CountUp, Empty, ProgressRing, SectionTitle, Stars, TiltCard } from '../components/ui';
import { navigate, useStore } from '../lib/store';
import { fmtDate, fmtLongDate, greeting, isOverdue, todayKey } from '../lib/utils';

/** Home screen for a colleague: their own work and today's report. */
export function MyDay() {
  const { state, session } = useStore();
  const sheets = useSheets();
  const today = todayKey();
  const mine = state.tasks.filter((t) => t.assigneeId === session.memberId);
  const open = mine.filter((t) => t.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const done = mine.length - open.length;
  const overdue = open.filter((t) => isOverdue(t)).length;
  const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
  const todays = state.reports.find((r) => r.memberId === session.memberId && r.date === today);
  const feedback = state.reports.filter((r) => r.memberId === session.memberId && (r.managerNote || r.rating)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">{fmtLongDate(today)}</p>
        <h1>
          {greeting()}, <span className="grad-text">{session.name.split(' ')[0]}</span>
        </h1>
        <p className="muted">Your work in {state.settings.teamName}.</p>
      </header>

      <TiltCard className="hero-card" intensity={10}>
        <div className="hc-glow" aria-hidden />
        <div className="hc-body">
          <ProgressRing value={pct} size={128} sub="of my tasks done" />
          <div className="hc-stats">
            <div>
              <strong>
                <CountUp value={open.length} />
              </strong>
              <span>Open</span>
            </div>
            <div>
              <strong>
                <CountUp value={done} />
              </strong>
              <span>Completed</span>
            </div>
            <div>
              <strong className={overdue ? 'danger' : ''}>
                <CountUp value={overdue} />
              </strong>
              <span>Overdue</span>
            </div>
          </div>
        </div>
        <button className="hc-cta" onClick={() => navigate('/reports?new=1')}>
          {todays ? (
            <>
              <span className="row gap-8">
                <CheckCircle2 size={16} className="ok-icon" /> Today’s report sent{todays.reviewed ? ' · reviewed' : ''}
              </span>
              <span className="muted small">Edit</span>
            </>
          ) : (
            <>
              Write today’s report <ArrowRight size={16} />
            </>
          )}
        </button>
      </TiltCard>

      <SectionTitle action={<button className="link" onClick={() => navigate('/tasks')}>All my tasks</button>}>Up next</SectionTitle>
      {open.length ? (
        <div className="stack gap-12 stagger">
          {open.slice(0, 4).map((t) => (
            <TaskCard key={t.id} task={t} onOpen={(x) => sheets.openTask(x.id)} showAssignee={false} />
          ))}
        </div>
      ) : (
        <Empty icon={ClipboardList} title="You’re all caught up" text="New tasks from your manager will show up here." />
      )}

      <SectionTitle>Manager feedback</SectionTitle>
      {feedback.length ? (
        <div className="stack gap-12">
          {feedback.map((r) => (
            <div key={r.id} className="glass card-pad stack gap-8">
              <div className="row gap-8">
                <FileText size={15} className="muted" />
                <span className="grow small muted">Report for {fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                {r.rating > 0 && <Stars value={r.rating} />}
              </div>
              {r.managerNote && (
                <p className="rc-note">
                  <MessageSquare size={13} /> {r.managerNote}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">Ratings and notes from your manager on your reports will appear here.</p>
      )}
    </div>
  );
}
