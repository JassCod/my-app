import { useEffect } from 'react';
import type { Settings } from '../lib/types';

/** Animated aurora blobs + grain + floating particles: the depth illusion behind the glass. */
export function Backdrop() {
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

/** Apply theme + motion preference to the document (also used on the sign-in screens). */
export function useThemeAttrs({ theme, effects }: Pick<Settings, 'theme' | 'effects'>) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.effects = effects ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0b1a' : '#f4f3ff');
  }, [theme, effects]);
}

export function Splash({ text }: { text?: string }) {
  return (
    <div className="splash">
      <div className="splash-logo">
        <svg viewBox="0 0 512 512" width="44" height="44" aria-hidden>
          <path d="M96 276h78l40-96 58 172 44-116 26 40h74" fill="none" stroke="#fff" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="muted small">{text ?? 'Loading TeamPulse…'}</p>
    </div>
  );
}
