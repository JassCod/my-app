import { CheckCircle2, Copy, Send, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ReportFields, emptyDraft, type ReportDraft, type SubmitPayload } from '../components/Sheets';
import { Avatar, Empty, TiltCard } from '../components/ui';
import { shareText } from '../lib/exporters';
import { useToast } from '../lib/store';
import { appUrl, decodePayload, encodePayload, fmtLongDate, todayKey } from '../lib/utils';

export interface ImportPayload {
  v: 1;
  memberId: string;
  name: string;
  date: string;
  draft: ReportDraft;
}

/** Colleague-facing page opened from a manager's request link. Needs no account or backend. */
export function Submit({ token }: { token: string }) {
  const { toast } = useToast();
  const payload = useMemo(() => decodePayload<SubmitPayload>(token), [token]);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);
  const [link, setLink] = useState('');

  if (!payload || payload.v !== 1)
    return (
      <div className="page solo">
        <Empty icon={ShieldAlert} title="Link not valid" text="This report link is incomplete. Ask your manager to send it again." />
      </div>
    );

  const date = todayKey();
  const send = async () => {
    const out: ImportPayload = { v: 1, memberId: payload.memberId, name: payload.name, date, draft };
    const url = appUrl(`/import/${encodePayload(out)}`);
    setLink(url);
    const res = await shareText(`Daily report — ${payload.name}`, `📋 Daily report from ${payload.name} (${fmtLongDate(date)}). Open to add it to TeamPulse:`, url);
    if (res === 'copied') toast('Report link copied — paste it to your manager');
  };

  return (
    <div className="page solo">
      <header className="hero">
        <p className="eyebrow">{payload.team} · requested by {payload.manager}</p>
        <h1>
          Daily report <span className="grad-text">✦</span>
        </h1>
        <p className="muted">{fmtLongDate(date)}</p>
      </header>

      <TiltCard className="card-pad row gap-12">
        <Avatar member={{ name: payload.name, color: '#7c5cff' }} size={48} />
        <div>
          <strong>{payload.name}</strong>
          <p className="muted small">{payload.tasks.length} open task{payload.tasks.length === 1 ? '' : 's'} assigned to you</p>
        </div>
      </TiltCard>

      {link ? (
        <div className="glass card-pad stack gap-12 center">
          <CheckCircle2 size={44} className="ok-icon mx-auto" />
          <h3>Report ready to send</h3>
          <p className="muted small">If the share sheet didn’t open, copy the link below and send it to your manager on WhatsApp, Slack or email.</p>
          <div className="link-box">
            <span>{link}</span>
          </div>
          <button className="btn primary block" onClick={send}>
            <Send size={16} /> Share again
          </button>
          <button
            className="btn ghost block"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast('Copied');
              } catch {
                toast('Long-press the link to copy it', 'warn');
              }
            }}
          >
            <Copy size={16} /> Copy link
          </button>
          <button className="btn ghost block" onClick={() => setLink('')}>
            Edit report
          </button>
        </div>
      ) : (
        <div className="glass card-pad stack gap-12">
          <ReportFields tasks={payload.tasks} value={draft} onChange={setDraft} />
          <button className="btn primary block" disabled={!draft.accomplished.trim()} onClick={send}>
            <Send size={16} /> Send to manager
          </button>
        </div>
      )}
    </div>
  );
}
