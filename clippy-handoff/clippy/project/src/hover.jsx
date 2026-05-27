// Single hovered card showing the "Send to phone" affordance + actions.
function HoverActionCard({ mode = 'dark', width = 200, height = 240 }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const clip = SAMPLE_CLIPS[7]; // the SQL dump file

  return (
    <div style={{ position: 'relative', width, height, flexShrink: 0 }}>
      <ClipCard clip={clip} mode={mode} width={width} height={height} state="hover" />
      {/* hover quick-actions overlay (top right) */}
      <div style={{
        position: 'absolute', top: 6, right: 6,
        display: 'flex', gap: 2,
        background: mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: 9, padding: 3,
      }}>
        <ActionBtn mode={mode} title="Send to phone" highlight><I.smartphone size={13} /></ActionBtn>
        <ActionBtn mode={mode} title="Favorite"><I.star size={13} /></ActionBtn>
        <ActionBtn mode={mode} title="Pin"><I.pin size={13} /></ActionBtn>
        <ActionBtn mode={mode} title="Delete"><I.trash size={13} /></ActionBtn>
      </div>
      {/* a tiny "Send to phone" badge that animates in on hover */}
      <div style={{
        position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 9px', borderRadius: 8,
        background: accent, color: '#fff',
        fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
        boxShadow: `0 6px 14px ${accent}55`, whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}>
        <I.send size={10} />Send to Pixel 7
      </div>
    </div>
  );
}

function ActionBtn({ children, mode, highlight, title }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div title={title} style={{
      width: 22, height: 22, borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: highlight ? accent : 'transparent',
      color: highlight ? '#fff' : T.textSecondary,
      cursor: 'pointer',
    }}>{children}</div>
  );
}

// File transfer in-progress card (progress arc)
function TransferCard({ mode = 'dark' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const progress = 0.42;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div style={{
      width: 200, height: 240,
      background: T.surface,
      border: `1px solid ${accent}55`,
      borderRadius: 14, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <TypeBadge type="file" mode={mode} label="SENDING" />
        <I.smartphone size={14} color={accent} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={r} fill="none" stroke={T.surfaceRaised} strokeWidth="3" />
            <circle cx="28" cy="28" r={r} fill="none" stroke={accent} strokeWidth="3"
              strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
              transform="rotate(-90 28 28)" strokeLinecap="round" />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: T.text, fontFamily: 'Geist Mono, ui-monospace, monospace',
          }}>{Math.round(progress * 100)}%</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11.5, color: T.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>staging-dump.sql.gz</div>
          <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>10.2 / 24.3 MB · 8.4 MB/s</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>now</span>
        <span style={{ fontSize: 10, color: T.textSecondary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>1.7s left</span>
      </div>
    </div>
  );
}

window.HoverActionCard = HoverActionCard;
window.TransferCard = TransferCard;
