import { ClipboardList, FileText, Home, Plus, Send, Settings as SettingsIcon, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SheetsProvider, useSheets } from './components/Sheets';
import { navigate, useRoute, useStore, useToast } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { Import } from './pages/Import';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Submit } from './pages/Submit';
import { MemberDetail, Team } from './pages/Team';
import { Tasks } from './pages/Tasks';

const TABS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: ClipboardList },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/team', label: 'Team', icon: Users },
];

export default function App() {
  const { state } = useStore();
  const route = useRoute();
  const { theme, effects } = state.settings;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.effects = effects ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0b1a' : '#f4f3ff');
  }, [theme, effects]);

  useEffect(() => window.scrollTo({ top: 0 }), [route.path]);

  const [first, second] = route.parts;
  const solo = first === 'submit';

  let page;
  if (first === 'submit') page = <Submit token={second ?? ''} />;
  else if (first === 'import') page = <Import token={second ?? ''} />;
  else if (first === 'tasks') page = <Tasks />;
  else if (first === 'reports') page = <Reports />;
  else if (first === 'team' && second) page = <MemberDetail id={second} />;
  else if (first === 'team') page = <Team />;
  else if (first === 'settings') page = <Settings />;
  else page = <Dashboard />;

  return (
    <SheetsProvider>
      <Backdrop />
      <div className={`app ${solo ? 'solo' : ''}`}>
        <main key={route.path} className="view">
          {page}
        </main>
        {!solo && <BottomNav active={'/' + (first ?? '')} />}
        <Toasts />
      </div>
    </SheetsProvider>
  );
}

/** Animated aurora blobs + grain + floating particles: the depth illusion behind the glass. */
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
      <div className="particles">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${14 + (i % 5) * 3}s` }} />
        ))}
      </div>
      <div className="grid-floor" />
      <div className="grain" />
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const sheets = useSheets();
  const { state } = useStore();
  const [fab, setFab] = useState(false);
  const act = (fn: () => void) => () => {
    setFab(false);
    fn();
  };
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const Tab = ({ t }: { t: (typeof TABS)[number] }) => {
    const on = active === t.path;
    return (
      <button className={`nav-tab ${on ? 'active' : ''}`} onClick={() => navigate(t.path)} aria-current={on ? 'page' : undefined}>
        <t.icon size={21} />
        <span>{t.label}</span>
      </button>
    );
  };
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
          <button onClick={act(() => (state.members[0] ? sheets.requestReport(state.members[0].id) : sheets.newMember()))} style={{ ['--i' as string]: 2 }}>
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
      <nav className="bottom-nav glass-strong" aria-label="Main">
        {left.map((t) => (
          <Tab key={t.path} t={t} />
        ))}
        <button className={`fab ${fab ? 'open' : ''}`} onClick={() => setFab((o) => !o)} aria-label={fab ? 'Close quick actions' : 'Quick actions'} aria-expanded={fab}>
          {fab ? <X size={24} /> : <Plus size={26} />}
        </button>
        {right.map((t) => (
          <Tab key={t.path} t={t} />
        ))}
        <button className={`nav-tab ${active === '/settings' ? 'active' : ''}`} onClick={() => navigate('/settings')} aria-current={active === '/settings' ? 'page' : undefined}>
          <SettingsIcon size={21} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

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
