import { Check, FileText, MessageSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ReportFields, emptyDraft, type ReportDraft } from '../components/Sheets';
import { Empty, MoodDot, SectionTitle, Stars } from '../components/ui';
import { useRoute, useStore, useToast } from '../lib/store';
import { fmtDate, fmtLongDate, todayKey } from '../lib/utils';

/** A colleague writes today's report here and sees their history with the manager's feedback. */
export function MyReports() {
  const { state, session, upsertReport } = useStore();
  const { toast } = useToast();
  const route = useRoute();
  const today = todayKey();
  const memberId = session.memberId ?? '';
  const mine = state.reports.filter((r) => r.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date));
  const todays = mine.find((r) => r.date === today);
  const openTasks = state.tasks.filter((t) => t.assigneeId === memberId && t.status !== 'done');
  const [draft, setDraft] = useState<ReportDraft>(() =>
    todays ? { accomplished: todays.accomplished, blockers: todays.blockers, tomorrow: todays.tomorrow, hours: todays.hours, mood: todays.mood, taskUpdates: [] } : emptyDraft()
  );
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (route.query.get('new')) formRef.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, [route.query]);

  const submit = () => {
    upsertReport({ ...draft, memberId, date: today, source: 'colleague' });
    setDraft((d) => ({ ...d, taskUpdates: [] }));
    toast(todays ? 'Report updated' : 'Report sent to your manager');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Daily report</p>
          <h1>My reports</h1>
        </div>
      </header>

      <div className="glass card-pad stack gap-12" ref={formRef}>
        <div className="row gap-8">
          <div className="grow">
            <strong>{fmtLongDate(today)}</strong>
            <p className="muted small">{todays ? (todays.reviewed ? 'Sent · reviewed by your manager' : 'Sent · you can still edit it today') : 'Not sent yet'}</p>
          </div>
          {todays && <span className={`badge ${todays.reviewed ? 'tone-good' : 'tone-info'}`}>{todays.reviewed ? 'Reviewed' : 'Sent'}</span>}
        </div>
        <ReportFields tasks={openTasks} value={draft} onChange={setDraft} />
        <button className="btn primary block" disabled={!draft.accomplished.trim()} onClick={submit}>
          {todays ? <Check size={16} /> : <Send size={16} />} {todays ? 'Update today’s report' : 'Send report to manager'}
        </button>
      </div>

      <SectionTitle>History</SectionTitle>
      {mine.filter((r) => r.date !== today).length ? (
        <div className="stack gap-12 stagger">
          {mine
            .filter((r) => r.date !== today)
            .map((r) => (
              <div key={r.id} className="report-card glass">
                <div className="row gap-12">
                  <div className="rr-date">
                    <strong>{fmtDate(r.date, { day: 'numeric' })}</strong>
                    <small>{fmtDate(r.date, { month: 'short' })}</small>
                  </div>
                  <div className="grow">
                    <p className="rc-text clamp-3">{r.accomplished}</p>
                    <small className="muted">{r.hours}h</small>
                  </div>
                  <MoodDot mood={r.mood} />
                </div>
                {(r.rating > 0 || r.managerNote) && (
                  <div className="stack gap-6">
                    {r.rating > 0 && <Stars value={r.rating} />}
                    {r.managerNote && (
                      <p className="rc-note">
                        <MessageSquare size={13} /> {r.managerNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <Empty icon={FileText} title="No earlier reports" text="Reports you send will be listed here with your manager’s feedback." />
      )}
    </div>
  );
}
