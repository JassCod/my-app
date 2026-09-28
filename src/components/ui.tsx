import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, ArrowUp, CheckCircle2, Circle, Clock3, Minus, X, type LucideIcon } from 'lucide-react';
import type { Member, Priority, TaskStatus } from '../lib/types';
import { PRIORITY_LABEL, STATUS_LABEL, initials } from '../lib/utils';

/** Card that tilts in 3D towards the pointer with a moving light glare — the "illusion" surface. */
export function TiltCard({ children, className = '', style, onClick, intensity = 8 }: { children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // Mouse/pen: follow the pointer. Touch: tilt once where the finger lands (a moving finger is scrolling).
  const move = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && e.type === 'pointermove') return;
    const el = ref.current;
    if (!el || document.documentElement.dataset.effects === 'off') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * intensity}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * intensity}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div
      ref={ref}
      className={`tilt glass ${onClick ? 'pressable' : ''} ${className}`}
      style={style}
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={leave}
      onPointerUp={leave}
      onPointerCancel={leave}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
    >
      <span className="glare" aria-hidden />
      {children}
    </div>
  );
}

export function Avatar({ member, size = 40 }: { member?: Pick<Member, 'name' | 'color'>; size?: number }) {
  const color = member?.color ?? '#64748b';
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, #0b0b1a))`, boxShadow: `0 6px 18px -6px ${color}` }}
      aria-hidden
    >
      {initials(member?.name ?? '?')}
    </span>
  );
}

export function AvatarStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  return (
    <span className="avatar-stack">
      {members.slice(0, max).map((m) => (
        <Avatar key={m.id} member={m} size={30} />
      ))}
      {members.length > max && <span className="avatar more">+{members.length - max}</span>}
    </span>
  );
}

const STATUS_ICON: Record<TaskStatus, LucideIcon> = { todo: Circle, in_progress: Clock3, done: CheckCircle2 };
export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue)
    return (
      <span className="badge tone-critical">
        <AlertTriangle size={12} /> Overdue
      </span>
    );
  const Icon = STATUS_ICON[status];
  return (
    <span className={`badge status-${status}`}>
      <Icon size={12} /> {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_ICON: Record<Priority, LucideIcon> = { low: Minus, medium: ArrowUp, high: AlertTriangle };
export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span className={`badge prio-${priority}`}>
      <Icon size={12} /> {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

/** Animated circular gauge. */
export function ProgressRing({ value, size = 120, stroke = 11, label, sub }: { value: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">
        <strong>{label ?? `${value}%`}</strong>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

/** Counts up to a number for a lively stat tile. */
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

/** Bottom sheet modal used for every form and detail view. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass-strong" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-orb">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={`chip ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {action}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n === value ? 0 : n)} aria-label={`${n} star`}>
          ★
        </button>
      ))}
    </span>
  );
}

export function MoodDot({ mood }: { mood: number }) {
  const labels = ['Struggling', 'Low', 'Okay', 'Good', 'Great'];
  return (
    <span className="mood-dot" title={`Mood: ${labels[mood - 1] ?? 'n/a'}`} aria-label={`Mood: ${labels[mood - 1] ?? 'n/a'}`}>
      {['😣', '😕', '😐', '🙂', '🤩'][mood - 1] ?? '·'}
    </span>
  );
}
