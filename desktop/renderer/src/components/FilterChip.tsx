import type { ReactNode } from 'react';

export function FilterChip({
  label,
  active = false,
  icon,
  count = null,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  count?: number | null;
  onClick: () => void;
}) {
  return (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick} type="button">
      {icon && <span className="icon">{icon}</span>}
      <span>{label}</span>
      {count !== null && <span className="count">{count}</span>}
      <style>{chipCss}</style>
    </button>
  );
}

const chipCss = `
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    height: 28px; padding: 0 11px;
    background: transparent; color: var(--cm-text-secondary);
    border: 1px solid var(--cm-border-subtle); border-radius: 14px;
    font-size: 12px; font-weight: 500; font-family: inherit;
    white-space: nowrap; cursor: pointer;
  }
  .chip.active {
    background: var(--cm-surface-raised); color: var(--cm-text);
    border-color: var(--cm-border-strong);
  }
  .chip .icon { display: inline-flex; align-items: center; }
  .chip .count {
    font-size: 10px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
`;
