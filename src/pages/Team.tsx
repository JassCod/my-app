import { ArrowLeft, FileDown, Mail, Pencil, Phone, Plus, Send, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useSheets } from '../components/Sheets';
import { TaskCard } from '../components/TaskCard';
import { Avatar, Empty, MoodDot, ProgressBar, ProgressRing, SectionTitle, Segmented, TiltCard } from '../components/ui';
import { memberReportPdf, shareOrDownload } from '../lib/exporters';
import { navigate, useStore, useToast } from '../lib/store';
import { fmtDate, isOverdue, summarizeDay, todayKey } from '../lib/utils';

export function Team() {
  const { state, session } = useStore();
  const sheets = useSheets();
  const today = summarizeDay(state, todayKey());
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{state.settings.teamName}</p>
          <h1>Team</h1>
        </div>
        <button className="icon-btn primary" onClick={sheets.newMember} aria-label="Add colleague">
          <UserPlus size={19} />
        </button>
      </header>

      {state.members.length ? (
        <div className="stack gap-12 stagger">
          {state.members.map((m) => {
            const tasks = state.tasks.filter((t) => t.assigneeId === m.id);
            const done = tasks.filter((t) => t.status === 'done').length;
            const open = tasks.length - done;
            const overdue = tasks.filter((t) => isOverdue(t)).length;
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            const reported = !today.missing.includes(m.id);
            return (
              <TiltCard key={m.id} className="member-card" onClick={() => navigate(`/team/${m.id}`)} intensity={6}>
                <div className="mc-row">
                  <Avatar member={m} size={52} />
                  <div className="grow">
                    <h4>{m.name}</h4>
                    <p className="muted small">
                      {m.role}
                      {session.mode === 'cloud' && !m.uid && <span className="not-joined"> · not joined yet</span>}
                    </p>
                  </div>
                  <span className={`badge ${reported ? 'tone-good' : 'tone-warning'}`}>{reported ? 'Reported' : 'Pending'}</span>
                </div>
                <div className="mc-stats">
                  <span>
                    <b>{open}</b> open
                  </span>
                  <span>
                    <b>{done}</b> done
                  </span>
                  <span className={overdue ? 'danger' : ''}>
                    <b>{overdue}</b> overdue
                  </span>
                  <span className="grow" />
                  <span className="muted small">{pct}%</span>
                </div>
                <ProgressBar value={pct} color={`linear-gradient(90deg, ${m.color}, var(--accent-2))`} />
              </TiltCard>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Users}
          title="No colleagues yet"
          text="Add your team members to start assigning tasks and collecting daily reports."
          action={
            <button className="btn primary" onClick={sheets.newMember}>
              <Plus size={16} /> Add colleague
            </button>
          }
        />
      )}
    </div>
  );
}

export function MemberDetail({ id }: { id: string }) {
  const { state, deleteMember, session, setAccess } = useStore();
  const sheets = useSheets();
  const { toast } = useToast();
  const [tab, setTab] = useState<'open' | 'done' | 'reports'>('open');
  const [confirm, setConfirm] = useState(false);
  const m = state.members.find((x) => x.id === id);
  const cloud = session.mode === 'cloud';
  const account = m?.uid ? state.users?.find((u) => u.uid === m.uid) : undefined;
  if (!m)
    return (
      <div className="page">
        <Empty icon={Users} title="Colleague not found" text="They may have been removed." action={<button className="btn primary" onClick={() => navigate('/team')}>Back to team</button>} />
      </div>
    );
  const tasks = state.tasks.filter((t) => t.assigneeId === m.id);
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const reports = state.reports.filter((r) => r.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date));
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const avgHours = reports.length ? (reports.reduce((s, r) => s + r.hours, 0) / reports.length).toFixed(1) : '—';

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn glass" onClick={() => navigate('/team')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="row gap-8">
          <button className="icon-btn glass" onClick={() => sheets.editMember(m.id)} aria-label="Edit colleague">
            <Pencil size={17} />
          </button>
          <button
            className="icon-btn glass"
            aria-label="Download colleague report"
            onClick={async () => {
              const res = await shareOrDownload(await memberReportPdf(state, m), `${m.name.replace(/\s+/g, '-').toLowerCase()}-report.pdf`, `${m.name} — report`);
              if (res !== 'cancelled') toast(res === 'shared' ? 'Shared' : 'PDF downloaded');
            }}
          >
            <FileDown size={17} />
          </button>
        </div>
      </header>

      <TiltCard className="profile-card" intensity={8}>
        <div className="pc-aura" style={{ background: `radial-gradient(circle at 30% 20%, ${m.color}, transparent 65%)` }} aria-hidden />
        <div className="pc-top">
          <Avatar member={m} size={76} />
          <div className="grow">
            <h2>{m.name}</h2>
            <p className="muted">{m.role}</p>
            <div className="row gap-8 wrap">
              {m.email && (
                <a className="pill" href={`mailto:${m.email}`}>
                  <Mail size={13} /> Email
                </a>
              )}
              {m.phone && (
                <a className="pill" href={`tel:${m.phone}`}>
                  <Phone size={13} /> Call
                </a>
              )}
            </div>
          </div>
          <ProgressRing value={pct} size={74} stroke={7} sub="done" />
        </div>
        <div className="pc-stats">
          <div>
            <strong>{open.length}</strong>
            <span>Open</span>
          </div>
          <div>
            <strong>{done.length}</strong>
            <span>Done</span>
          </div>
          <div>
            <strong>{reports.length}</strong>
            <span>Reports</span>
          </div>
          <div>
            <strong>{avgHours}</strong>
            <span>Avg hrs</span>
          </div>
        </div>
      </TiltCard>

      <div className="row gap-8">
        <button className="btn primary grow" onClick={() => sheets.newTask(m.id)}>
          <Plus size={16} /> Assign task
        </button>
        <button className="btn ghost grow" onClick={() => sheets.requestReport(m.id)}>
          <Send size={16} /> {cloud && !m.uid ? 'Invite to app' : 'Request report'}
        </button>
      </div>

      {cloud && (
        <div className="glass card-pad stack gap-12 access-card">
          <div className="row gap-8">
            <ShieldCheck size={18} className="accent-icon" />
            <strong className="grow">App access</strong>
            <span className={`badge ${m.uid ? 'tone-good' : 'tone-warning'}`}>{m.uid ? 'Joined' : 'Not joined'}</span>
          </div>
          {m.uid && account ? (
            <>
              <p className="muted small">
                Signs in as <b>{account.email}</b>.
              </p>
              <Segmented
                value={account.role}
                onChange={(role) => {
                  if (role === account.role || !setAccess) return;
                  setAccess(account.uid, role);
                  toast(role === 'manager' ? `${m.name.split(' ')[0]} now has full manager access` : `${m.name.split(' ')[0]} now sees only their own work`);
                }}
                options={[
                  { value: 'member', label: 'Colleague' },
                  { value: 'manager', label: 'Manager' },
                ]}
              />
              <p className="muted tiny">
                {account.role === 'manager' ? 'Full access: sees and manages the whole team.' : 'Sees only their own tasks and reports; updates progress, adds notes, sends reports.'}
              </p>
            </>
          ) : (
            <p className="muted small">
              {m.email ? (
                <>Send an invite to <b>{m.email}</b>. Once they join they can update their tasks and send daily reports from their own phone.</>
              ) : (
                <>Add an email address (Edit) to invite {m.name.split(' ')[0]} to the app.</>
              )}
            </p>
          )}
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Incomplete', count: open.length },
          { value: 'done', label: 'Completed', count: done.length },
          { value: 'reports', label: 'Reports', count: reports.length },
        ]}
      />

      {tab !== 'reports' && (
        <div className="stack gap-12 stagger">
          {(tab === 'open' ? open : done).map((t) => (
            <TaskCard key={t.id} task={t} onOpen={(x) => sheets.openTask(x.id)} showAssignee={false} />
          ))}
          {!(tab === 'open' ? open : done).length && <Empty icon={Users} title={tab === 'open' ? 'Nothing pending' : 'Nothing completed yet'} text={tab === 'open' ? `${m.name.split(' ')[0]} has no incomplete work.` : 'Completed tasks will appear here.'} />}
        </div>
      )}

      {tab === 'reports' && (
        <div className="stack gap-12 stagger">
          <button className="btn ghost block" onClick={() => sheets.newReport(m.id)}>
            <Plus size={16} /> Record a report for {m.name.split(' ')[0]}
          </button>
          {reports.map((r) => (
            <button key={r.id} className="report-row glass pressable" onClick={() => sheets.openReport(r.id)}>
              <div className="rr-date">
                <strong>{fmtDate(r.date, { day: 'numeric' })}</strong>
                <small>{fmtDate(r.date, { month: 'short' })}</small>
              </div>
              <div className="grow">
                <p className="clamp-2">{r.accomplished}</p>
                <small className="muted">
                  {r.hours}h · {r.reviewed ? 'Reviewed' : 'Awaiting review'}
                  {r.blockers ? ' · has blockers' : ''}
                </small>
              </div>
              <MoodDot mood={r.mood} />
            </button>
          ))}
          {!reports.length && <Empty icon={Users} title="No reports yet" text="Request a report or record one on their behalf." />}
        </div>
      )}

      <SectionTitle>Danger zone</SectionTitle>
      {confirm ? (
        <div className="glass card-pad stack gap-8">
          <p className="small">
            Remove <b>{m.name}</b> along with their {tasks.length} tasks and {reports.length} reports?{cloud && m.uid ? ' They will lose access to the app.' : ''} This can’t be undone.
          </p>
          <div className="row gap-8">
            <button className="btn ghost grow" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button
              className="btn danger grow"
              onClick={() => {
                deleteMember(m.id);
                toast(`${m.name} removed`, 'info');
                navigate('/team');
              }}
            >
              <Trash2 size={16} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button className="btn ghost danger-text block" onClick={() => setConfirm(true)}>
          <Trash2 size={16} /> Remove from team
        </button>
      )}
    </div>
  );
}
