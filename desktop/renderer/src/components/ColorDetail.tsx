import { Copy } from 'lucide-react';
import type { ClipDto } from '../../../electron/ipc-types';

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([\da-f]{6})$/i) || hex.trim().match(/^#?([\da-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function toFormats(hex: string) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const hsl = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  const oklch = `oklch(${(l * 0.85 + 0.1).toFixed(2)} ${(s * 0.18).toFixed(3)} ${Math.round(h)})`;
  return {
    rgb,
    list: [
      { label: 'HEX', value: hex.toUpperCase() },
      { label: 'RGB', value: `rgb(${r}, ${g}, ${b})` },
      { label: 'HSL', value: hsl },
      { label: 'OKLCH', value: oklch },
    ],
  };
}

export function ColorDetail({
  clip,
  onCopied,
  onBack,
}: {
  clip: ClipDto;
  onCopied?: (label: string) => void;
  onBack: () => void;
}) {
  const hex = clip.preview.trim();
  const parsed = toFormats(hex);
  if (!parsed) {
    return (
      <div className="color-detail-empty">
        Not a recognizable color: {hex}
        <button onClick={onBack} type="button">Back</button>
        <style>{css}</style>
      </div>
    );
  }
  const { r, g, b } = parsed.rgb;

  const copy = async (value: string, label: string) => {
    await window.clippy.copyText(value);
    onCopied?.(label);
  };

  return (
    <div className="color-detail">
      <div className="cd-swatch" style={{ background: hex }}>
        <div className="cd-gloss" />
        <div className="cd-hex">{hex.toUpperCase()}</div>
      </div>
      <div className="cd-body">
        <div className="cd-formats">
          {parsed.list.map((f, i) => (
            <button key={f.label} className={`cd-row ${i === 0 ? 'primary' : ''}`} onClick={() => copy(f.value, f.label)} type="button">
              <span className="cd-label">{f.label}</span>
              <span className="cd-value">{f.value}</span>
              <Copy size={13} />
            </button>
          ))}
        </div>
        <div className="cd-shades-label">SHADES</div>
        <div className="cd-shades">
          {[0.2, 0.35, 0.5, 0.65, 0.8, 1, 1.15, 1.3, 1.45].map((mult, i) => {
            const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c * mult)));
            const shade = `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
            const shadeHex = '#' + [adj(r), adj(g), adj(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
            return (
              <button
                key={i}
                className={`cd-shade ${mult === 1 ? 'current' : ''}`}
                style={{ background: shade }}
                onClick={() => copy(shadeHex.toUpperCase(), 'shade')}
                title={shadeHex.toUpperCase()}
                type="button"
              />
            );
          })}
        </div>
      </div>
      <style>{css}</style>
    </div>
  );
}

const css = `
  .color-detail { display: flex; height: 100%; font-family: inherit; }
  .color-detail-empty { padding: 40px; color: var(--cm-text-secondary); display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .cd-swatch { width: 280px; flex-shrink: 0; position: relative; overflow: hidden; }
  .cd-gloss { position: absolute; top: 0; left: 0; right: 0; height: 40%; background: linear-gradient(180deg, rgba(255,255,255,.12), transparent); }
  .cd-hex {
    position: absolute; bottom: 16px; left: 20px; right: 20px;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 26px; font-weight: 600; letter-spacing: 1px;
    color: #fff; mix-blend-mode: difference;
  }
  .cd-body { flex: 1; padding: 20px 24px; display: flex; flex-direction: column; min-width: 0; }
  .cd-formats { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .cd-row {
    display: flex; align-items: center; gap: 14px;
    padding: 11px 14px; border-radius: 9px;
    background: transparent; border: 1px solid var(--cm-border-subtle);
    cursor: pointer; color: var(--cm-text); text-align: left; font-family: inherit;
  }
  .cd-row.primary { background: var(--cm-surface-raised); border-color: color-mix(in srgb, var(--cm-accent) 40%, transparent); }
  .cd-row:hover { background: var(--cm-surface-raised); }
  .cd-row svg { color: var(--cm-text-secondary); flex-shrink: 0; }
  .cd-label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; color: var(--cm-text-tertiary); width: 48px; font-family: 'Geist Mono', ui-monospace, monospace; }
  .cd-value { flex: 1; font-size: 13px; font-family: 'Geist Mono', ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cd-shades-label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; color: var(--cm-text-tertiary); margin: 16px 0 8px; font-family: 'Geist Mono', ui-monospace, monospace; }
  .cd-shades { display: flex; gap: 4px; height: 40px; }
  .cd-shade { flex: 1; border-radius: 5px; border: 1px solid var(--cm-border-subtle); cursor: pointer; }
  .cd-shade.current { border: 2px solid var(--cm-text); }
`;
