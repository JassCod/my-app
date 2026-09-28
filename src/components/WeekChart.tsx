import { useState } from 'react';
import { fmtDate } from '../lib/utils';

export interface Bar {
  key: string;
  label: string;
  value: number;
  sub?: string;
}

/** Single-series column chart (tasks completed per day) with a per-bar hover/tap tooltip. */
export function WeekChart({ bars, unit = 'completed', onPick, selected }: { bars: Bar[]; unit?: string; onPick?: (key: string) => void; selected?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const H = 120;
  return (
    <div className="week-chart" onPointerLeave={() => setHover(null)}>
      <div className="wc-grid" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="wc-bars">
        {bars.map((b, i) => {
          const h = Math.max(4, (b.value / max) * H);
          const active = hover === i || selected === b.key;
          return (
            <button
              key={b.key}
              className={`wc-col ${active ? 'active' : ''} ${selected === b.key ? 'selected' : ''}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => onPick?.(b.key)}
              aria-label={`${fmtDate(b.key)}: ${b.value} ${unit}`}
            >
              {hover === i && (
                <span className="wc-tip">
                  <strong>{b.value}</strong> {unit}
                  <small>{fmtDate(b.key, { weekday: 'short', day: 'numeric', month: 'short' })}</small>
                  {b.sub && <small>{b.sub}</small>}
                </span>
              )}
              <span className="wc-bar-wrap" style={{ height: H }}>
                <span className="wc-bar" style={{ height: h }} />
              </span>
              <span className="wc-label">{b.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
