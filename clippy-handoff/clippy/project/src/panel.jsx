// Desktop panel + sub-components. All artboards are 1280x340 unless noted.

// Backdrop — a faked Ubuntu desktop behind the panel. Used in hero shots.
function FauxDesktop({ children, mode = 'dark', height = 720, width = 1280 }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  // GNOME-ish desktop with a wallpaper
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: mode === 'dark'
        ? 'radial-gradient(ellipse 100% 80% at 70% 110%, #E95420 0%, #6B2540 25%, #2A1430 55%, #1A0E1F 80%, #0E080F 100%)'
        : 'radial-gradient(ellipse 100% 80% at 70% 110%, #F4C8A8 0%, #D9B0C2 30%, #C5B3D0 60%, #B8B0CE 100%)',
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      {/* top bar — GNOME shell */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 32,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', color: '#fff', fontSize: 12,
      }}>
        <span style={{ opacity: .8, fontWeight: 500 }}>Activities</span>
        <span style={{ opacity: .9, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>Wed 14:32</span>
        <div style={{ display: 'flex', gap: 8, opacity: .7, alignItems: 'center' }}>
          <I.wifi size={11} color="#fff" />
          <span>EN</span>
          <span>92%</span>
        </div>
      </div>

      {/* Ubuntu dock — left edge */}
      <div style={{
        position: 'absolute', top: 44, left: 6, bottom: 60, width: 52,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)',
        borderRadius: 8, padding: '8px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        {[
          { c: '#E95420', label: 'F' }, // Files (Ubuntu orange-ish)
          { c: '#2E86DE', label: 'T' }, // Terminal
          { c: '#7F2A8F', label: 'S' }, // Software
          { c: '#3A8B5C', label: 'G' }, // Settings
        ].map((d, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: 8,
            background: d.c,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: '0 1px 4px rgba(0,0,0,.3)',
          }}>{d.label}</div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(255,255,255,.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="10" y="2" width="6" height="6" rx="1"/><rect x="2" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>
        </div>
      </div>

      {/* faux window — GNOME Terminal */}
      <div style={{
        position: 'absolute', top: 80, left: 180, width: 540, height: 320,
        background: '#0F0F14', borderRadius: 12,
        boxShadow: '0 24px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05)',
        overflow: 'hidden', opacity: .9,
      }}>
        <div style={{ height: 36, background: '#2C2C32', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 14px' }}>
          <span style={{ fontSize: 12, color: '#ECECF1', fontWeight: 500 }}>helios — clipmate — zsh</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="10" height="2" viewBox="0 0 10 2"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: 14, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11.5, color: '#B0B0BE', lineHeight: 1.6 }}>
          <div><span style={{ color: '#7CE8B5' }}>helios ~/clipmate</span> <span style={{ color: '#5C5C6B' }}>$</span> cargo run --release</div>
          <div style={{ color: '#5C5C6B' }}>   Compiling clipmate v0.4.1</div>
          <div style={{ color: '#5C5C6B' }}>    Finished release [optimized] target(s) in 14.83s</div>
          <div style={{ color: '#5C5C6B' }}>     Running `target/release/clipmate`</div>
          <div style={{ color: '#9999A8' }}>[INFO] clipboard watcher started</div>
          <div style={{ color: '#9999A8' }}>[INFO] listening on 0.0.0.0:7842</div>
          <div style={{ color: '#9999A8' }}>[INFO] paired device: Pixel 7</div>
          <div><span style={{ color: '#7CE8B5' }}>helios ~/clipmate</span> <span style={{ color: '#5C5C6B' }}>$</span> <span style={{ background: '#9999A8', display: 'inline-block', width: 7, height: 13, verticalAlign: 'middle' }} /></div>
        </div>
      </div>

      {/* faux window — GNOME Text Editor / Gedit-ish */}
      <div style={{
        position: 'absolute', top: 60, right: 100, width: 460, height: 240,
        background: '#171823', borderRadius: 12,
        boxShadow: '0 24px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05)',
        overflow: 'hidden', opacity: .85,
      }}>
        <div style={{ height: 36, background: '#1F2030', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 14px' }}>
          <span style={{ fontSize: 12, color: '#ECECF1', fontWeight: 500 }}>panel.tsx</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="2" viewBox="0 0 10 2"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
            <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: 'none', color: '#ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: 14, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: '#B0B0BE', lineHeight: 1.6 }}>
          <div><span style={{ color: '#5C5C6B' }}>1</span>  <span style={{ color: '#C792EA' }}>const</span> useClips = (q: <span style={{ color: '#C792EA' }}>string</span>) =&gt; {'{'}</div>
          <div><span style={{ color: '#5C5C6B' }}>2</span>    <span style={{ color: '#C792EA' }}>return</span> clips</div>
          <div><span style={{ color: '#5C5C6B' }}>3</span>      .filter(c =&gt; c.text.includes(q))</div>
          <div><span style={{ color: '#5C5C6B' }}>4</span>      .sort((a, b) =&gt; b.time - a.time);</div>
          <div><span style={{ color: '#5C5C6B' }}>5</span>  {'}'};</div>
          <div><span style={{ color: '#5C5C6B' }}>6</span></div>
          <div><span style={{ color: '#5C5C6B' }}>7</span>  <span style={{ color: '#5C5C6B', fontStyle: 'italic' }}>// matches across types now</span></div>
        </div>
      </div>

      {children}
    </div>
  );
}
window.FauxDesktop = FauxDesktop;

// ─── Header pieces ───────────────────────────────────────────
function SearchBar({ mode, value = '', placeholder = 'Search clipboard\u2026', focused = false, width = 360 }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 32, padding: '0 12px',
      width, minWidth: 0,
      background: mode === 'dark' ? 'rgba(0,0,0,0.25)' : '#fff',
      borderRadius: 10,
      border: `1px solid ${focused ? accent : T.borderSubtle}`,
      boxShadow: focused ? `0 0 0 3px ${accent}22` : 'none',
      transition: 'border-color 120ms, box-shadow 120ms',
    }}>
      <I.search size={14} color={T.textSecondary} />
      <span style={{
        flex: 1, color: value ? T.text : T.textTertiary,
        fontSize: 13, fontWeight: 400,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>{value || placeholder}</span>
      {value && (
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: T.textSecondary, display: 'flex' }}>
          <I.x size={12} />
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, count, active, mode, icon: Ic }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, padding: '0 11px',
      background: active ? (mode === 'dark' ? T.surfaceRaised : T.surfaceRaised) : 'transparent',
      color: active ? T.text : T.textSecondary,
      border: `1px solid ${active ? T.borderStrong : T.borderSubtle}`,
      borderRadius: 14,
      fontSize: 12, fontWeight: 500,
      fontFamily: 'Geist, system-ui, sans-serif',
      letterSpacing: 0,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {Ic && <Ic size={13} color={active ? accent : T.textSecondary} />}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span style={{
          fontSize: 10, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>{count}</span>
      )}
    </div>
  );
}
window.FilterChip = FilterChip;

// ─── The Panel ─────────────────────────────────────────────────
function Panel({
  mode = 'dark',
  width = 1280, height = 340,
  clips = SAMPLE_CLIPS,
  search = '',
  searchFocused = false,
  activeFilter = 'all',
  selectedIndex = 0,
  showChips = true,
  density = 'comfortable',
  incognito = false,
  connectionState = 'connected', // connected | connecting | disconnected | unpaired
  deviceName = 'Pixel 7',
  itemCount,
  bodyOverride = null,
  hideSourceIcon = false,
  noHighlight = false,
  pinnedFirst = true,
}) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  const cardW = density === 'compact' ? 168 : density === 'spacious' ? 232 : 200;
  const cardH = density === 'compact' ? 210 : density === 'spacious' ? 244 : 240;
  const cardGap = density === 'compact' ? 9 : 12;

  // Filter + sort
  const filterTypes = {
    text:'text', link:'link', code:'code', image:'image', file:'file',
  };
  let visible = clips;
  if (activeFilter === 'favorites') visible = clips.filter((c) => c.favorited);
  else if (filterTypes[activeFilter]) visible = clips.filter((c) => c.type === filterTypes[activeFilter]);
  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter((c) =>
      (c.content || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.url || '').toLowerCase().includes(q) ||
      (c.filename || '').toLowerCase().includes(q)
    );
  }
  if (pinnedFirst) visible = [...visible].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const totalCount = itemCount ?? clips.length;

  const chips = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites', icon: I.star },
    { id: 'text', label: 'Text' },
    { id: 'image', label: 'Image' },
    { id: 'link', label: 'Link' },
    { id: 'code', label: 'Code' },
    { id: 'file', label: 'File' },
  ];

  return (
    <div style={{
      width, height,
      background: mode === 'dark' ? `${T.bg}D9` : `${T.bg}E0`,
      backdropFilter: 'blur(24px) saturate(140%)',
      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
      borderRadius: 20,
      border: `1px solid ${incognito ? T.warn : T.borderSubtle}`,
      borderWidth: incognito ? 2 : 1,
      boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,.04) inset',
      display: 'flex', flexDirection: 'column',
      color: T.text,
      fontFamily: 'Geist, system-ui, sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ───────── Header ───────── */}
      <div style={{
        height: 48, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${T.borderSubtle}`,
        flexShrink: 0,
      }}>
        <SearchBar mode={mode} value={search} focused={searchFocused} width={showChips ? 320 : 460} />

        {showChips && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <FilterChip label={chips[0].label} active={activeFilter === 'all'} mode={mode} />
            <FilterChip label={chips[1].label} icon={chips[1].icon} active={activeFilter === 'favorites'} mode={mode} />
            <span style={{ width: 1, height: 18, background: T.borderSubtle, margin: '0 2px' }} />
            {chips.slice(2).map((c) => (
              <FilterChip key={c.id} label={c.label} active={activeFilter === c.id} mode={mode} />
            ))}
          </div>
        )}

        {!showChips && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <FilterChip label={activeFilter === 'all' ? 'Filter' : chips.find((c) => c.id === activeFilter)?.label}
              icon={I.filter} active={activeFilter !== 'all'} mode={mode} />
          </div>
        )}

        {incognito && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 9px', borderRadius: 7,
            background: `${T.warn}22`, color: T.warn,
            fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
          }}>
            <I.eyeOff size={12} />
            <span>INCOGNITO · 12m</span>
          </div>
        )}

        <button style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.textSecondary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.settings size={18} />
        </button>
      </div>

      {/* ───────── Body ───────── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {bodyOverride || (
          <div style={{
            display: 'flex', gap: cardGap, padding: `${density === 'compact' ? 12 : 16}px 20px`,
            overflowX: 'auto', overflowY: 'hidden', height: '100%',
            alignItems: 'stretch',
          }}>
            {visible.map((c, i) => (
              <ClipCard key={c.id} clip={c} mode={mode}
                state={i === selectedIndex ? 'selected' : 'default'}
                width={cardW} height={cardH} density={density}
                hideSourceIcon={hideSourceIcon} noHighlight={noHighlight} />
            ))}
            {/* fade edge */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 60, height: '100%',
              background: `linear-gradient(to left, ${mode === 'dark' ? '#16161FCC' : '#F5F5FACC'} 0%, transparent 100%)`,
              pointerEvents: 'none',
            }} />
          </div>
        )}
      </div>

      {/* ───────── Footer ───────── */}
      <div style={{
        height: 28, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderTop: `1px solid ${T.borderSubtle}`,
        fontSize: 11, color: T.textTertiary,
        fontFamily: 'Geist Mono, ui-monospace, monospace',
        flexShrink: 0,
        background: mode === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
      }}>
        <span>{totalCount} items</span>
        <span style={{ opacity: .5 }}>·</span>
        <ConnectionIndicator mode={mode} state={connectionState} deviceName={deviceName} />
        <div style={{ flex: 1 }} />
        <span style={{ opacity: .7 }}>↵ paste · ⌫ delete · Super+F search</span>
      </div>
    </div>
  );
}

function ConnectionIndicator({ mode, state, deviceName }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  if (state === 'unpaired') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textTertiary }}>
        <I.smartphone size={12} />
        <span>No device paired</span>
        <span style={{ color: accent, marginLeft: 4, textDecoration: 'underline' }}>Pair phone →</span>
      </span>
    );
  }
  if (state === 'disconnected') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textTertiary }}>
        <I.wifiOff size={12} />
        <span>{deviceName} (offline)</span>
      </span>
    );
  }
  if (state === 'connecting') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textSecondary }}>
        <Spinner size={11} color={T.textSecondary} />
        <span>Connecting to {deviceName}\u2026</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textSecondary }}>
      <I.smartphone size={12} />
      <span>paired with {deviceName}</span>
      <I.zap size={11} color={accent} />
    </span>
  );
}

function Spinner({ size = 12, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'cm-spin 0.9s linear infinite' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity=".2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
window.Spinner = Spinner;
window.Panel = Panel;
window.SearchBar = SearchBar;
window.ConnectionIndicator = ConnectionIndicator;

// keyframes
if (typeof document !== 'undefined' && !document.getElementById('cm-spin-kf')) {
  const s = document.createElement('style');
  s.id = 'cm-spin-kf';
  s.textContent = '@keyframes cm-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}
