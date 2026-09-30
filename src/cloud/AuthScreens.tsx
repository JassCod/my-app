import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, KeyRound, LogIn, Rocket, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Avatar, Field } from '../components/ui';
import { auth, db } from '../lib/firebase';
import { navigate, useRoute } from '../lib/store';
import type { Invite } from '../lib/types';

type Pending = { kind: 'setup'; name: string; teamName: string } | { kind: 'join'; code: string };
const PENDING = 'teampulse.pending';
export const readPending = (): Pending | null => {
  try {
    return JSON.parse(localStorage.getItem(PENDING) || 'null');
  } catch {
    return null;
  }
};
const writePending = (p: Pending) => {
  try {
    localStorage.setItem(PENDING, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};
export const clearPending = () => {
  try {
    localStorage.removeItem(PENDING);
  } catch {
    /* ignore */
  }
};

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with this email.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/email-already-in-use': 'This email already has an account — sign in instead.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'join/has-account': 'You already have an account — enter its password to join.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};
const message = (e: unknown) => MESSAGES[(e as { code?: string }).code ?? ''] ?? 'Something went wrong. Please try again.';

export function AuthScreens() {
  const route = useRoute();
  const [workspace, setWorkspace] = useState<{ exists: boolean; teamName: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = (attempt: number) =>
      getDoc(doc(db, 'meta/workspace'))
        .then((s) => !cancelled && setWorkspace({ exists: s.exists(), teamName: (s.data()?.teamName as string) ?? '' }))
        .catch(() => {
          if (cancelled) return;
          if (attempt < 3) setTimeout(() => check(attempt + 1), 1500 * (attempt + 1));
          // Can't tell yet: still offer setup. The server refuses a second founder, so this is safe.
          else setWorkspace({ exists: false, teamName: '' });
        });
    check(0);
    return () => {
      cancelled = true;
    };
  }, []);

  const [first, second] = route.parts;
  if (first === 'join' && second) return <Join code={second} />;
  if (first === 'reset') return <Reset />;
  if (first === 'setup' && workspace && !workspace.exists) return <Setup />;
  return <SignIn workspace={workspace} />;
}

function Brand({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="hero auth-hero">
      <div className="splash-logo small">
        <svg viewBox="0 0 512 512" width="30" height="30" aria-hidden>
          <path d="M96 276h78l40-96 58 172 44-116 26 40h74" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="eyebrow">TeamPulse</p>
      <h1>{title}</h1>
      <p className="muted">{sub}</p>
    </header>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = (fn: () => Promise<unknown>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function SignIn({ workspace }: { workspace: { exists: boolean; teamName: string } | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit();
  return (
    <div className="page auth">
      <Brand title="Welcome back" sub={workspace?.teamName ? `Sign in to ${workspace.teamName}` : 'Sign in to your team workspace'} />
      <form className="glass card-pad stack gap-12" onSubmit={run(() => signInWithEmailAndPassword(auth, email.trim(), password))}>
        <Field label="Email">
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="link center" onClick={() => navigate('/reset')}>
          Forgot password?
        </button>
      </form>
      {workspace && !workspace.exists ? (
        <div className="glass card-pad stack gap-8 center">
          <p className="small muted">No team has been set up in this app yet.</p>
          <button className="btn ghost block" onClick={() => navigate('/setup')}>
            <Rocket size={16} /> Set up your team (manager)
          </button>
        </div>
      ) : (
        <p className="muted small center">New colleague? Open the invite link your manager sent you.</p>
      )}
    </div>
  );
}

function Setup() {
  const [form, setForm] = useState({ name: '', teamName: '', email: '', password: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const { busy, error, run } = useSubmit();
  return (
    <div className="page auth">
      <button className="icon-btn glass" onClick={() => navigate('/')} aria-label="Back">
        <ArrowLeft size={18} />
      </button>
      <Brand title="Set up your team" sub="You’ll be the manager, with full access. Then invite your colleagues." />
      <form
        className="glass card-pad stack gap-12"
        onSubmit={run(async () => {
          writePending({ kind: 'setup', name: form.name.trim(), teamName: form.teamName.trim() || 'My team' });
          await createUserWithEmailAndPassword(auth, form.email.trim().toLowerCase(), form.password);
        })}
      >
        <Field label="Your name">
          <input required value={form.name} onChange={set('name')} placeholder="e.g. Jaspreet Singh" />
        </Field>
        <Field label="Team name">
          <input required value={form.teamName} onChange={set('teamName')} placeholder="e.g. Sales Team" />
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <input type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={set('password')} />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          <Rocket size={16} /> {busy ? 'Creating…' : 'Create team'}
        </button>
      </form>
    </div>
  );
}

function Join({ code }: { code: string }) {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    getDoc(doc(db, 'invites', code))
      .then((s) => setInvite(s.exists() ? (s.data() as Invite) : null))
      .catch(() => setInvite(null));
  }, [code]);

  if (invite === undefined) return <p className="muted center pad">Checking your invite…</p>;
  if (!invite)
    return (
      <div className="page auth">
        <Brand title="Invite not found" sub="This link is invalid or was replaced. Ask your manager to send a new invite." />
        <button className="btn ghost block" onClick={() => navigate('/')}>
          Go to sign in
        </button>
      </div>
    );

  return (
    <div className="page auth">
      <Brand title={`Join ${invite.teamName || 'your team'}`} sub="Your manager invited you to TeamPulse to receive tasks and send daily reports." />
      <div className="glass card-pad row gap-12">
        <Avatar member={{ name: invite.name, color: '#7c5cff' }} size={46} />
        <div className="grow">
          <strong>{invite.name}</strong>
          <p className="muted small">{invite.email}</p>
        </div>
      </div>
      <form
        className="glass card-pad stack gap-12"
        onSubmit={run(async () => {
          writePending({ kind: 'join', code });
          try {
            if (mode === 'create') await createUserWithEmailAndPassword(auth, invite.email, password);
            else await signInWithEmailAndPassword(auth, invite.email, password);
          } catch (e) {
            if ((e as { code?: string }).code === 'auth/email-already-in-use') {
              setMode('signin');
              throw Object.assign(new Error(), { code: 'join/has-account' });
            }
            throw e;
          }
        })}
      >
        <Field label={mode === 'create' ? 'Choose a password' : 'Your password'} hint={mode === 'create' ? 'At least 6 characters' : undefined}>
          <input type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          <UserPlus size={16} /> {busy ? 'Joining…' : mode === 'create' ? 'Create account & join' : 'Sign in & join'}
        </button>
        <button type="button" className="link center" onClick={() => setMode(mode === 'create' ? 'signin' : 'create')}>
          {mode === 'create' ? 'I already have an account' : 'Create a new account instead'}
        </button>
      </form>
    </div>
  );
}

function Reset() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  return (
    <div className="page auth">
      <button className="icon-btn glass" onClick={() => navigate('/')} aria-label="Back">
        <ArrowLeft size={18} />
      </button>
      <Brand title="Reset password" sub="We’ll email you a link to choose a new password." />
      {sent ? (
        <div className="glass card-pad stack gap-12 center">
          <p>Check <b>{email}</b> for the reset link, then come back and sign in.</p>
          <button className="btn primary block" onClick={() => navigate('/')}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form
          className="glass card-pad stack gap-12"
          onSubmit={run(async () => {
            await sendPasswordResetEmail(auth, email.trim());
            setSent(true);
          })}
        >
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary block" disabled={busy}>
            <KeyRound size={16} /> Send reset link
          </button>
        </form>
      )}
    </div>
  );
}
