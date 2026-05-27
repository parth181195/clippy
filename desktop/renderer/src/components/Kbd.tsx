import type { ReactNode } from 'react';

export function Kbd({ children, size = 'sm' }: { children: ReactNode; size?: 'xs' | 'sm' }) {
  return (
    <>
      <span className={`cm-kbd cm-kbd-${size}`}>{children}</span>
      <style>{css}</style>
    </>
  );
}

const css = `
  .cm-kbd {
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 4px;
    background: color-mix(in srgb, var(--cm-text) 6%, transparent);
    color: var(--cm-text-secondary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-weight: 600; line-height: 1;
  }
  .cm-kbd-xs { min-width: 14px; height: 15px; padding: 1px 5px; font-size: 9.5px; }
  .cm-kbd-sm { min-width: 18px; height: 18px; padding: 2px 6px; font-size: 10.5px; }
`;
