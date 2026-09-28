import { Database, Download, FileJson, Moon, RotateCcw, Share2, Smartphone, Sparkles, Sun, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Field, SectionTitle } from '../components/ui';
import { backupJson, downloadBlob, reportsCsv, shareText, tasksCsv, tasksPdf } from '../lib/exporters';
import { useStore, useToast } from '../lib/store';
import type { AppState } from '../lib/types';
import { todayKey } from '../lib/utils';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function Settings() {
  const { state, updateSettings, replaceState, resetDemo, clearAll } = useStore();
  const { toast } = useToast();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(data.members) || !Array.isArray(data.tasks) || !Array.isArray(data.reports)) throw new Error('bad');
      replaceState({ ...data, activity: data.activity ?? [], settings: { ...state.settings, ...data.settings } });
      toast('Backup restored');
    } catch {
      toast('That file is not a TeamPulse backup', 'warn');
    }
  };

  const stamp = todayKey();
  const s = state.settings;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="glass card-pad profile-mini">
        <Avatar member={{ name: s.managerName, color: '#7c5cff' }} size={56} />
        <div className="grow">
          <strong>{s.managerName}</strong>
          <p className="muted small">Manager · {s.teamName}</p>
        </div>
      </div>

      <SectionTitle>Profile</SectionTitle>
      <div className="glass card-pad stack gap-12">
        <Field label="Your name">
          <input value={s.managerName} onChange={(e) => updateSettings({ managerName: e.target.value })} />
        </Field>
        <Field label="Team name">
          <input value={s.teamName} onChange={(e) => updateSettings({ teamName: e.target.value })} />
        </Field>
      </div>

      <SectionTitle>Appearance</SectionTitle>
      <div className="glass list">
        <div className="list-row">
          <span className="lr-icon">{s.theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}</span>
          <span className="grow">Dark mode</span>
          <Toggle on={s.theme === 'dark'} onChange={(on) => updateSettings({ theme: on ? 'dark' : 'light' })} label="Dark mode" />
        </div>
        <div className="list-row">
          <span className="lr-icon">
            <Sparkles size={17} />
          </span>
          <span className="grow">
            Motion & 3D effects
            <small className="muted block">Floating lights, tilt and glow</small>
          </span>
          <Toggle on={s.effects} onChange={(effects) => updateSettings({ effects })} label="Motion effects" />
        </div>
      </div>

      <SectionTitle>Share & download</SectionTitle>
      <div className="glass list">
        <button className="list-row" onClick={() => tasksPdf(state).then((b) => downloadBlob(b, `tasks-${stamp}.pdf`))}>
          <span className="lr-icon">
            <Download size={17} />
          </span>
          <span className="grow">Task register (PDF)</span>
        </button>
        <button className="list-row" onClick={() => downloadBlob(tasksCsv(state), `tasks-${stamp}.csv`)}>
          <span className="lr-icon">
            <Download size={17} />
          </span>
          <span className="grow">Tasks (CSV / Excel)</span>
        </button>
        <button className="list-row" onClick={() => downloadBlob(reportsCsv(state), `reports-${stamp}.csv`)}>
          <span className="lr-icon">
            <Download size={17} />
          </span>
          <span className="grow">All daily reports (CSV / Excel)</span>
        </button>
        <button
          className="list-row"
          onClick={async () => {
            const res = await shareText('TeamPulse', 'TeamPulse — manage team tasks and daily reports from your phone. Open and tap “Add to Home Screen” to install:', location.origin + location.pathname);
            if (res === 'copied') toast('App link copied');
          }}
        >
          <span className="lr-icon">
            <Share2 size={17} />
          </span>
          <span className="grow">Share the app</span>
        </button>
        {!standalone && (
          <button
            className="list-row"
            onClick={async () => {
              if (install) {
                await install.prompt();
                setInstall(null);
              } else toast('Use your browser menu → “Add to Home Screen” to install', 'info');
            }}
          >
            <span className="lr-icon">
              <Smartphone size={17} />
            </span>
            <span className="grow">
              Install on this phone
              <small className="muted block">Works offline like a native app</small>
            </span>
          </button>
        )}
      </div>

      <SectionTitle>Data</SectionTitle>
      <div className="glass list">
        <button
          className="list-row"
          onClick={() => {
            downloadBlob(backupJson(state), `teampulse-backup-${stamp}.json`);
            toast('Backup downloaded');
          }}
        >
          <span className="lr-icon">
            <FileJson size={17} />
          </span>
          <span className="grow">
            Back up all data
            <small className="muted block">
              {state.members.length} colleagues · {state.tasks.length} tasks · {state.reports.length} reports
            </small>
          </span>
        </button>
        <button className="list-row" onClick={() => fileRef.current?.click()}>
          <span className="lr-icon">
            <Upload size={17} />
          </span>
          <span className="grow">Restore from backup</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restore(f);
            e.target.value = '';
          }}
        />
        <button className="list-row" onClick={() => (confirm === 'reset' ? (resetDemo(), setConfirm(null), toast('Demo data loaded')) : setConfirm('reset'))}>
          <span className="lr-icon">
            <RotateCcw size={17} />
          </span>
          <span className="grow">{confirm === 'reset' ? 'Tap again to replace everything with demo data' : 'Load demo data'}</span>
        </button>
        <button className="list-row danger-text" onClick={() => (confirm === 'clear' ? (clearAll(), setConfirm(null), toast('Workspace cleared', 'info')) : setConfirm('clear'))}>
          <span className="lr-icon">
            <Trash2 size={17} />
          </span>
          <span className="grow">{confirm === 'clear' ? 'Tap again to erase all data' : 'Start fresh (erase all)'}</span>
        </button>
      </div>

      <p className="muted tiny center about">
        <Database size={12} /> Data is stored privately on this device. Use backup to move it to another phone.
        <br />
        TeamPulse v1.0
      </p>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}
