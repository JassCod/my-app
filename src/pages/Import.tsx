import { CheckCircle2, Inbox, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Empty, MoodDot, TiltCard } from '../components/ui';
import { navigate, useStore, useToast } from '../lib/store';
import { decodePayload, fmtLongDate } from '../lib/utils';
import type { ImportPayload } from './Submit';

/** Manager opens a colleague's "report link" and the report lands in the daily record. */
export function Import({ token }: { token: string }) {
  const { state, upsertReport } = useStore();
  const { toast } = useToast();
  const data = useMemo(() => decodePayload<ImportPayload>(token), [token]);
  const [done, setDone] = useState(false);

  if (!data || data.v !== 1 || !data.draft)
    return (
      <div className="page">
        <Empty icon={ShieldAlert} title="Invalid report link" text="This link could not be read. Ask your colleague to send it again." />
      </div>
    );

  const member = state.members.find((m) => m.id === data.memberId);
  const exists = state.reports.some((r) => r.memberId === data.memberId && r.date === data.date);
  const updates = data.draft.taskUpdates.filter((u) => state.tasks.some((t) => t.id === u.taskId));

  if (!member)
    return (
      <div className="page">
        <Empty icon={ShieldAlert} title="Unknown colleague" text={`${data.name} is not in your team on this device. Add them first or restore your backup.`} />
      </div>
    );

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Incoming report</p>
        <h1>
          <Inbox size={26} /> New daily report
        </h1>
      </header>
      <TiltCard className="card-pad stack gap-12">
        <div className="row gap-12">
          <Avatar member={member} size={48} />
          <div className="grow">
            <strong>{member.name}</strong>
            <p className="muted small">{fmtLongDate(data.date)}</p>
          </div>
          <MoodDot mood={data.draft.mood} />
        </div>
        <div className="rd-block ok">
          <small>Accomplished</small>
          <p>{data.draft.accomplished}</p>
        </div>
        {data.draft.blockers && (
          <div className="rd-block warn">
            <small>Blockers</small>
            <p>{data.draft.blockers}</p>
          </div>
        )}
        {data.draft.tomorrow && (
          <div className="rd-block">
            <small>Tomorrow</small>
            <p>{data.draft.tomorrow}</p>
          </div>
        )}
        <p className="small muted">
          {data.draft.hours}h worked · {updates.length} task progress update{updates.length === 1 ? '' : 's'}
        </p>
      </TiltCard>
      {exists && !done && <p className="hint-box">A report from {member.name.split(' ')[0]} for this day already exists — importing replaces it.</p>}
      {done ? (
        <div className="glass card-pad center stack gap-12">
          <CheckCircle2 size={40} className="ok-icon mx-auto" />
          <p>Report added to the daily record.</p>
          <button className="btn primary block" onClick={() => navigate(`/reports?d=${data.date}`)}>
            Open daily report
          </button>
        </div>
      ) : (
        <button
          className="btn primary block"
          onClick={() => {
            upsertReport({ ...data.draft, taskUpdates: updates, memberId: member.id, date: data.date, source: 'colleague' });
            setDone(true);
            toast('Report imported');
          }}
        >
          <CheckCircle2 size={16} /> Add to daily record
        </button>
      )}
    </div>
  );
}
