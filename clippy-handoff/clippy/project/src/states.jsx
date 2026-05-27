// Panel body overrides — settings, pairing, empty states, etc.

function SettingsView({ mode = 'dark', section = 'general' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'hotkeys', label: 'Hotkeys' },
    { id: 'exclusions', label: 'Exclusions' },
    { id: 'devices', label: 'Devices' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'Geist, system-ui, sans-serif' }}>
      {/* nav */}
      <div style={{ width: 180, borderRight: `1px solid ${T.borderSubtle}`, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sections.map((s) => (
          <div key={s.id} style={{
            padding: '7px 11px', borderRadius: 7,
            fontSize: 13, fontWeight: 500,
            color: s.id === section ? T.text : T.textSecondary,
            background: s.id === section ? T.surfaceRaised : 'transparent',
            cursor: 'pointer',
          }}>{s.label}</div>
        ))}
      </div>

      {/* content */}
      <div style={{ flex: 1, padding: '18px 28px', overflow: 'auto' }}>
        {section === 'general' && <GeneralSettings mode={mode} />}
        {section === 'devices' && <DevicesSettings mode={mode} />}
        {section === 'hotkeys' && <HotkeysSettings mode={mode} />}
      </div>
    </div>
  );
}

function Row({ label, hint, mode, control }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: `1px solid ${T.borderSubtle}`,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div>{control}</div>
    </div>
  );
}

function Toggle({ on, mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{
      width: 34, height: 20, borderRadius: 10,
      background: on ? accent : T.surfaceRaised,
      border: `1px solid ${on ? accent : T.borderStrong}`,
      position: 'relative', transition: 'background 150ms',
    }}>
      <div style={{
        position: 'absolute', top: 1, left: on ? 15 : 1,
        width: 16, height: 16, borderRadius: 8,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        transition: 'left 150ms cubic-bezier(.2,.9,.3,1)',
      }} />
    </div>
  );
}

function Kbd({ children, mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 20, height: 22, padding: '0 6px',
      borderRadius: 5,
      background: T.surfaceRaised,
      border: `1px solid ${T.borderStrong}`,
      borderBottomWidth: 2,
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: 11, fontWeight: 500,
      color: T.text,
    }}>{children}</span>
  );
}
window.Kbd = Kbd;

function GeneralSettings({ mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.2 }}>General</h3>
      <Row mode={mode} label="Launch at login" hint="Start ClipMate when you log in to your desktop." control={<Toggle on={true} mode={mode} />} />
      <Row mode={mode} label="History size" hint="Maximum clips to retain before old ones roll off." control={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, fontSize: 12, color: T.text, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>500 clips <I.chevronDown size={12} color={T.textSecondary}/></span>
      } />
      <Row mode={mode} label="Sync over LAN" hint="Mirror clips to paired devices on the same network." control={<Toggle on={true} mode={mode} />} />
      <Row mode={mode} label="Incognito hotkey timer" hint="Auto-disable incognito mode after this duration." control={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, fontSize: 12, color: T.text, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>15 min <I.chevronDown size={12} color={T.textSecondary}/></span>
      } />
    </div>
  );
}

function HotkeysSettings({ mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const rows = [
    ['Open panel', ['Super', '`']],
    ['Quick-paste last', ['Super', 'Shift', 'V']],
    ['Toggle incognito', ['Super', 'Shift', 'I']],
    ['Pin clip', ['P']],
    ['Delete clip', ['Backspace']],
  ];
  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.2 }}>Hotkeys</h3>
      {rows.map(([label, keys], i) => (
        <Row key={i} mode={mode} label={label} control={
          <div style={{ display: 'flex', gap: 4 }}>
            {keys.map((k, j) => <Kbd key={j} mode={mode}>{k}</Kbd>)}
          </div>
        } />
      ))}
    </div>
  );
}

function DevicesSettings({ mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.2 }}>Devices</h3>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 8,
          background: accent, color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}><I.plus size={13} />Add Device</button>
      </div>
      <DeviceRow mode={mode} name="Pixel 7" detail="Android 14 · paired Mar 12 · last sync 2s ago" connected />
      <DeviceRow mode={mode} name="iPad Pro" detail="iPadOS · paired Jan 8 · last sync 6h ago" />
    </div>
  );
}

function DeviceRow({ mode, name, detail, connected }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: `1px solid ${T.borderSubtle}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: T.surfaceRaised, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textSecondary,
      }}><I.smartphone size={16} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          {name}
          {connected && <span style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />}
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{detail}</div>
      </div>
      <I.more size={14} color={T.textTertiary} />
    </div>
  );
}

// ─── Pairing dialog ─────────────────────────────────────────
function PairingView({ mode = 'dark', paired = false, deviceName = 'Pixel 7' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', padding: '0 60px', gap: 48, fontFamily: 'Geist, system-ui, sans-serif' }}>
      <div style={{
        width: 200, height: 200, flexShrink: 0, borderRadius: 14,
        background: '#fff', padding: 14, position: 'relative',
      }}>
        {paired
          ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent, borderRadius: 10, color: '#fff' }}>
              <I.check size={72} strokeWidth={2} />
            </div>
          : <QRCode />
        }
      </div>
      <div style={{ flex: 1, maxWidth: 520 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: accent, letterSpacing: 1.2, marginBottom: 8 }}>PAIR A DEVICE</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: -0.4 }}>
          {paired ? `Paired with ${deviceName}` : 'Scan with your phone'}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: T.textSecondary, lineHeight: 1.55 }}>
          {paired
            ? 'Your clipboard now syncs across both devices. You can send files up to 100 MB either direction.'
            : 'Open ClipMate on your Android phone, tap Add Device, and point the camera at this code. Pairing happens over your local network — your clipboard never touches our servers.'}
        </p>
        {!paired && (
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'transparent', color: T.textSecondary,
              border: `1px solid ${T.borderSubtle}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}>Cancel</button>
            <button style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'transparent', color: T.text,
              border: `1px solid ${T.borderStrong}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>Use pairing code instead <I.chevronRight size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// Faux QR — random-ish module grid for the look
function QRCode({ size = 172 }) {
  // Deterministic pattern
  const seed = 'clipmate-qr';
  const cells = 25;
  const sq = size / cells;
  const isFinder = (x, y) =>
    (x < 7 && y < 7) ||
    (x > cells - 8 && y < 7) ||
    (x < 7 && y > cells - 8);
  const onModule = (x, y) => {
    if (isFinder(x, y)) {
      // outer 7x7 frame
      const refX = x > cells - 8 ? cells - 1 - x : x;
      const refY = y > cells - 8 ? cells - 1 - y : y;
      if (refX === 0 || refX === 6 || refY === 0 || refY === 6) return true;
      if (refX >= 2 && refX <= 4 && refY >= 2 && refY <= 4) return true;
      return false;
    }
    // hash seed+x+y
    let h = 0;
    const s = seed + x * 31 + y * 17;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (h & 7) < 3;
  };
  const rects = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (onModule(x, y)) rects.push(<rect key={x + '-' + y} x={x * sq} y={y * sq} width={sq} height={sq} fill="#16161F" />);
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="#fff" />
      {rects}
    </svg>
  );
}
window.QRCode = QRCode;
window.PairingView = PairingView;
window.SettingsView = SettingsView;

// ─── Empty states ────────────────────────────────────────────
function EmptyState({ mode, variant, search }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  let title, hint, illustration, actionLabel;
  if (variant === 'no-history') {
    title = 'Nothing here yet';
    hint = 'Copy anything — text, an image, a file — and it\u2019ll appear here.';
    illustration = <EmptyClipboardArt color={T.textTertiary} accent={accent} />;
  } else if (variant === 'no-results') {
    title = `No matches for \u201C${search || 'query'}\u201D`;
    hint = 'Try a shorter term or a different filter.';
    actionLabel = 'Clear search';
    illustration = <EmptySearchArt color={T.textTertiary} />;
  } else if (variant === 'no-filter') {
    title = 'No code clips yet';
    hint = 'Copy something from your editor or terminal to populate this filter.';
    illustration = <EmptyClipboardArt color={T.textTertiary} accent={accent} />;
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      {illustration}
      <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, textAlign: 'center', maxWidth: 360 }}>{hint}</div>
      {actionLabel && (
        <button style={{
          marginTop: 4, padding: '5px 11px', borderRadius: 7,
          background: 'transparent', color: accent,
          border: `1px solid ${accent}55`, cursor: 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}>{actionLabel}</button>
      )}
    </div>
  );
}

function EmptyClipboardArt({ color, accent }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="10" width="28" height="36" rx="3" />
      <rect x="22" y="6" width="12" height="6" rx="1.5" />
      <line x1="20" y1="22" x2="36" y2="22" />
      <line x1="20" y1="28" x2="32" y2="28" />
      <line x1="20" y1="34" x2="28" y2="34" />
      <path d="M44 12l2 1 1 2-1 2-2 1-2-1-1-2 1-2z" fill={accent} stroke="none" />
    </svg>
  );
}
function EmptySearchArt({ color }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="14" />
      <path d="m44 44-10-10" />
      <path d="M18 24h12M24 18v12" opacity="0.4" />
    </svg>
  );
}
window.EmptyState = EmptyState;
