'use client';

import { ALPACA_SETUP_STEPS } from './alpaca-setup-data';

interface AlpacaSetupGuideProps {
  compact?: boolean;
}

export function AlpacaSetupGuide({ compact = false }: AlpacaSetupGuideProps) {
  return (
    <ol className={`alpaca-guide-steps${compact ? ' alpaca-guide-steps--compact' : ''}`}>
      {ALPACA_SETUP_STEPS.map((s) => (
        <li key={s.step} className="alpaca-guide-step">
          <span className="alpaca-guide-step-num" aria-hidden>
            {String(s.step).padStart(2, '0')}
          </span>
          <div className="alpaca-guide-step-body">
            <h3 className="alpaca-guide-step-title">{s.title}</h3>
            <p className="alpaca-guide-step-desc">{s.body}</p>
            {'link' in s && s.link && (
              <a
                href={s.link.href}
                target="_blank"
                rel="noreferrer"
                className="alpaca-guide-link"
              >
                {s.link.label} →
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
