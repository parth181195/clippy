import * as RSwitch from '@radix-ui/react-switch';

export function Switch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <>
      <RSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cm-switch"
      >
        <RSwitch.Thumb className="cm-switch-thumb" />
      </RSwitch.Root>
      <style>{css}</style>
    </>
  );
}

const css = `
  .cm-switch {
    width: 34px; height: 20px; padding: 2px;
    background: var(--cm-surface-raised);
    border: 1px solid var(--cm-border-strong);
    border-radius: 999px; position: relative; cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .cm-switch[data-state="checked"] {
    background: var(--cm-accent); border-color: var(--cm-accent);
  }
  .cm-switch-thumb {
    display: block; width: 14px; height: 14px; border-radius: 50%;
    background: var(--cm-text); box-shadow: 0 1px 2px rgba(0,0,0,.4);
    transform: translateX(0); transition: transform 140ms ease;
    will-change: transform;
  }
  .cm-switch[data-state="checked"] .cm-switch-thumb {
    transform: translateX(14px); background: white;
  }
`;
