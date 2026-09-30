import { ClipboardList, FileText, Home, Plus, Send, Settings as SettingsIcon, UserPlus, Users, X } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Backdrop, useThemeAttrs } from './components/Backdrop';
import { SheetsProvider, useSheets } from './components/Sheets';
import { navigate, useRoute, useStore, useToast } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { Import } from './pages/Import';
import { MyDay } from './pages/MyDay';
import { MyReports } from './pages/MyReports';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Submit } from './pages/Submit';
import { MemberDetail, Team } from './pages/Team';
import { Tasks } from './pages/Tasks';

type Tab = { path: string; label: string; icon: typeof Home };
const MANAGER_TABS: Tab[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: ClipboardList },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/team', label: 'Team', icon: Users },
  { path: '/settings', label: 'More', icon: SettingsIcon },
];
const COLLEAGUE_TABS: Tab[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/tasks', label: 'My tasks', icon: ClipboardList },
  { path: '/reports', label: 'My reports', icon: FileText },
  { path: '/settings', label: 'More', icon: SettingsIcon },
];

export default function App() {
  const { state, can, session } = useStore();
  const route = useRoute();
  useThemeAttrs(state.settings);
  // Braces matter: newer browsers return a Promise from scrollTo, and React would try to call it as a cleanup.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  const [first, second] = route.parts;
  const local = session.mode === 'local';
  const solo = first === 'submit' && local;

  let page;
  if (first === 'submit' && local) page = <Submit token={second ?? ''} />;
  else if (first === 'import' && local) page = <Import token={second ?? ''} />;
  else if (first === 'tasks') page = <Tasks />;
  else if (first === 'reports') page = can.manage ? <Reports /> : <MyReports />;
  else if (first === 'team' && second && can.manage) page = <MemberDetail id={second} />;
  else if (first === 'team' && can.manage) page = <Team />;
  else if (first === 'settings') page = <Settings />;
  else page = can.manage ? <Dashboard /> : <MyDay />;

  return (
    <SheetsProvider>
      <Backdrop />
      <div className={`app ${solo ? 'solo' : ''}`}>
        <main key={route.path} className="view">
          <ErrorBoundary resetKey={route.path}>{page}</ErrorBoundary>
        </main>
        {!solo && <BottomNav active={'/' + (first ?? '')} canManage={can.manage} firstMemberId={state.members[0]?.id} />}
        <Toasts />
      </div>
    </SheetsProvider>
  );
}

/** A tab keeps the same button element across renders, so a tap in progress is never lost. */
function TabBtn({ t, active }: { t: Tab; active: string }) {
  const on = active === t.path;
  return (
    <button className={`nav-tab ${on ? 'active' : ''}`} onClick={() => navigate(t.path)} aria-current={on ? 'page' : undefined}>
      <t.icon size={21} />
      <span>{t.label}</span>
    </button>
  );
}

/** Memoised: live data updates don't redraw the menu, only a page or role change does. */
const BottomNav = memo(function BottomNav({ active, canManage, firstMemberId }: { active: string; canManage: boolean; firstMemberId?: string }) {
  const sheets = useSheets();
  const can = { manage: canManage };
  const [fab, setFab] = useState(false);
  // Never leave the quick-action overlay covering a page after navigating away.
  useEffect(() => {
    setFab(false);
  }, [active]);
  const act = (fn: () => void) => () => {
    setFab(false);
    fn();
  };
  const tabs = can.manage ? MANAGER_TABS : COLLEAGUE_TABS;
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  return (
    <>
      {fab && <div className="fab-scrim" onClick={() => setFab(false)} />}
      {fab && (
        <div className="fab-menu">
          <button onClick={act(() => sheets.newTask())} style={{ ['--i' as string]: 0 }}>
            <span className="q-orb g1">
              <Plus size={18} />
            </span>
            Assign task
          </button>
          <button onClick={act(() => sheets.newReport())} style={{ ['--i' as string]: 1 }}>
            <span className="q-orb g2">
              <FileText size={18} />
            </span>
            Record report
          </button>
          <button onClick={act(() => (firstMemberId ? sheets.requestReport(firstMemberId) : sheets.newMember()))} style={{ ['--i' as string]: 2 }}>
            <span className="q-orb g3">
              <Send size={18} />
            </span>
            Request report
          </button>
          <button onClick={act(() => sheets.newMember())} style={{ ['--i' as string]: 3 }}>
            <span className="q-orb g4">
              <UserPlus size={18} />
            </span>
            Add colleague
          </button>
        </div>
      )}
      <nav className={`bottom-nav glass-strong ${can.manage ? '' : 'four'}`} aria-label="Main">
        {left.map((t) => (
          <TabBtn key={t.path} t={t} active={active} />
        ))}
        <button
          className={`fab ${fab ? 'open' : ''}`}
          onClick={() => (can.manage ? setFab((o) => !o) : navigate('/reports?new=1'))}
          aria-label={can.manage ? (fab ? 'Close quick actions' : 'Quick actions') : 'Write today’s report'}
          aria-expanded={can.manage ? fab : undefined}
        >
          {fab ? <X size={24} /> : <Plus size={26} />}
        </button>
        {right.map((t) => (
          <TabBtn key={t.path} t={t} active={active} />
        ))}
      </nav>
    </>
  );
});

function Toasts() {
  const { toasts } = useToast();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass-strong t-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
