import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Plus, Send, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSheets } from '../components/Sheets';
import { Avatar, CountUp, Empty, MoodDot, ProgressBar, ProgressRing, Segmented, TiltCard } from '../components/ui';
import { dailyReportPdf, downloadBlob, reportsCsv, shareOrDownload } from '../lib/exporters';
import { navigate, useRoute, useStore, useToast } from '../lib/store';
import { addDays, dueLabel, fmtDate, fmtLongDate, memberName, summarizeDay, todayKey } from '../lib/utils';

type Tab = 'reports' | 'incomplete' | 'completed';

export function Reports() {
  const { state, session } = useStore();
  const sheets = useSheets();
  const { toast } = useToast();
  const route = useRoute();
  const today = todayKey();
  const date = route.query.get('d') && route.query.get('d')! <= today ? route.query.get('d')! : today;
  const setDate = (d: string) => navigate(d === today ? '/reports' : `/reports?d=${d}`);
  const [tab, setTab] = useState<Tab>('reports');
  const [menu, setMenu] = useState(false);
  const s = useMemo(() => summarizeDay(state, date), [state, date]);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i - 20)), [today]);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current?.querySelector('.day.active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [date]);

  const pdfName = `team-report-${date}.pdf`;
  const exportPdf = async (mode: 'share' | 'download') => {
    setMenu(false);
    const blob = await dailyReportPdf(state, date);
    if (mode === 'download') {
      downloadBlob(blob, pdfName);
      toast('PDF downloaded');
    } else {
      const res = await shareOrDownload(blob, pdfName, `Team report — ${fmtLongDate(date)}`);
      if (res !== 'cancelled') toast(res === 'shared' ? 'Report shared' : 'Sharing not supported — PDF downloaded');
    }
  };

  const incompleteByMember = state.members
    .map((m) => ({ m, tasks: s.incomplete.filter((t) => t.assigneeId === m.id) }))
    .filter((g) => g.tasks.length);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Daily record</p>
          <h1>Reports</h1>
        </div>
        <div className="row gap-8">
          <label className="icon-btn glass date-jump" aria-label="Pick a date">
            <CalendarDays size={18} />
            <input type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <div className="menu-wrap">
            <button className="icon-btn primary" onClick={() => setMenu((o) => !o)} aria-label="Share or download report">
              <Share2 size={18} />
            </button>
            {menu && (
              <div className="menu glass-strong">
                <button onClick={() => exportPdf('share')}>
                  <Share2 size={15} /> Share PDF
                </button>
                <button onClick={() => exportPdf('download')}>
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    downloadBlob(reportsCsv(state), `all-reports-${today}.csv`);
                    toast('All reports exported as CSV');
                  }}
                >
                  <FileText size={15} /> All reports (CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="day-nav">
        <button className="icon-btn tiny glass" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <ChevronLeft size={16} />
        </button>
        <div className="day-strip" ref={stripRef}>
          {days.map((d) => {
            const n = state.reports.filter((r) => r.date === d).length;
            return (
              <button key={d} className={`day ${d === date ? 'active' : ''} ${d === today ? 'today' : ''}`} onClick={() => setDate(d)}>
                <small>{fmtDate(d, { weekday: 'short' })}</small>
                <strong>{fmtDate(d, { day: 'numeric' })}</strong>
                <span className={`day-dot ${n ? 'on' : ''}`} />
              </button>
            );
          })}
        </div>
        <button className="icon-btn tiny glass" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          <ChevronRight size={16} />
        </button>
      </div>

      <TiltCard className="summary-card" intensity={7}>
        <div className="sc-top">
          <div>
            <p className="eyebrow">{date === today ? 'Today' : fmtDate(date, { weekday: 'long' })}</p>
            <h3>{fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          </div>
          <ProgressRing value={s.rate} size={84} stroke={8} sub="complete" />
        </div>
        <div className="sc-grid">
          <div className="sc-cell good">
            <CheckCircle2 size={16} />
            <strong>
              <CountUp value={s.completed.length} />
            </strong>
            <span>Completed</span>
          </div>
          <div className="sc-cell warn">
            <FileText size={16} />
            <strong>
              <CountUp value={s.incomplete.length} />
            </strong>
            <span>Incomplete</span>
          </div>
          <div className="sc-cell bad">
            <AlertTriangle size={16} />
            <strong>
              <CountUp value={s.overdue.length} />
            </strong>
            <span>Overdue</span>
          </div>
          <div className="sc-cell">
            <Send size={16} />
            <strong>
              {s.reports.length}/{s.reports.length + s.missing.length}
            </strong>
            <span>Reports · {s.hours}h</span>
          </div>
        </div>
        {s.carriedOver.length > 0 && (
          <p className="small muted">
            ↻ {s.carriedOver.length} task{s.carriedOver.length > 1 ? 's' : ''} carried over from earlier days
          </p>
        )}
      </TiltCard>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'reports', label: 'Reports', count: s.reports.length },
          { value: 'incomplete', label: 'Incomplete', count: s.incomplete.length },
          { value: 'completed', label: 'Completed', count: s.completed.length },
        ]}
      />

      {tab === 'reports' && (
        <div className="stack gap-12 stagger">
          {s.reports.map((r) => {
            const m = state.members.find((x) => x.id === r.memberId);
            return (
              <button key={r.id} className="report-card glass pressable" onClick={() => sheets.openReport(r.id)}>
                <div className="row gap-12">
                  <Avatar member={m} size={40} />
                  <div className="grow left">
                    <strong>{m?.name ?? 'Former colleague'}</strong>
                    <small className="muted block">
                      {r.hours}h · {r.source === 'colleague' ? (session.mode === 'cloud' ? 'sent by them' : 'via link') : 'recorded by you'}
                    </small>
                  </div>
                  <MoodDot mood={r.mood} />
                  <span className={`badge ${r.reviewed ? 'tone-good' : 'tone-info'}`}>{r.reviewed ? 'Reviewed' : 'New'}</span>
                </div>
                <p className="rc-text clamp-3">{r.accomplished}</p>
                {r.blockers && (
                  <p className="rc-blocker">
                    <AlertTriangle size={13} /> {r.blockers}
                  </p>
                )}
                {r.managerNote && <p className="rc-note">💬 {r.managerNote}</p>}
              </button>
            );
          })}
          {s.missing.length > 0 && (
            <div className="glass card-pad">
              <p className="field-label">Not reported yet</p>
              {s.missing.map((id) => {
                const m = state.members.find((x) => x.id === id);
                return (
                  <div key={id} className="missing-row">
                    <Avatar member={m} size={32} />
                    <span className="grow">{m?.name}</span>
                    {date === today && (
                      <button className="btn small ghost" onClick={() => sheets.requestReport(id)}>
                        <Send size={14} /> Request
                      </button>
                    )}
                    <button className="btn small primary" onClick={() => sheets.newReport(id, date)}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!s.reports.length && !s.missing.length && <Empty icon={FileText} title="No reports" text="Add colleagues to start collecting daily reports." />}
        </div>
      )}

      {tab === 'incomplete' && (
        <div className="stack gap-12 stagger">
          {incompleteByMember.map(({ m, tasks }) => (
            <div key={m.id} className="glass card-pad">
              <div className="row gap-8 group-head">
                <Avatar member={m} size={28} />
                <strong className="grow">{m.name}</strong>
                <span className="badge tone-warning">{tasks.length} pending</span>
              </div>
              {tasks.map((t) => (
                <button key={t.id} className="mini-row pressable" onClick={() => sheets.openTask(t.id)}>
                  <span className="grow left">
                    {t.title}
                    <small className={`block ${t.dueDate < date ? 'danger' : 'muted'}`}>
                      {t.dueDate < date ? `Overdue since ${fmtDate(t.dueDate)}` : date === today ? dueLabel(t.dueDate) : `Due ${fmtDate(t.dueDate)}`}
                    </small>
                  </span>
                  <span className="mini-progress">
                    <ProgressBar value={t.progress} />
                  </span>
                  <strong className="small">{t.progress}%</strong>
                </button>
              ))}
            </div>
          ))}
          {!incompleteByMember.length && <Empty icon={CheckCircle2} title="Nothing incomplete" text="Every task active on this day was finished. 🎉" />}
        </div>
      )}

      {tab === 'completed' && (
        <div className="stack gap-8 stagger">
          {s.completed.map((t) => (
            <button key={t.id} className="mini-row glass pressable done-row" onClick={() => sheets.openTask(t.id)}>
              <CheckCircle2 size={18} className="ok-icon" />
              <span className="grow left">
                {t.title}
                <small className="muted block">{memberName(state, t.assigneeId)}</small>
              </span>
            </button>
          ))}
          {!s.completed.length && <Empty icon={CheckCircle2} title="Nothing completed" text="No tasks were marked done on this day." />}
        </div>
      )}

      <button className="btn ghost block" onClick={() => sheets.newReport(undefined, date)}>
        <Plus size={16} /> Record a report for {date === today ? 'today' : fmtDate(date)}
      </button>
    </div>
  );
}
