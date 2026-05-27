// Bolder layout variants — same product, different visual vocabulary.
// Each accepts a `state` prop: 'default' | 'search' | 'filter' | 'empty' | 'extra'.

// ─── Variant A: Spotlight ──────────────────────────────────
// One selected card large at left, scrollable thumbnail row at right.
function SpotlightPanel({ mode = 'dark', width = 1280, height = 340, state = 'default' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  const codePalette = mode === 'dark'
    ? { k: '#C792EA', s: '#7CE8B5', c: '#5C5C6B', n: '#FFCB6B', i: T.text, p: T.textSecondary }
    : { k: '#7A4FA6', s: '#3A8B5C', c: '#9999A8', n: '#A36800', i: T.text, p: T.textSecondary };

  // pick what to focus + which thumbs to show by state
  let selected = SAMPLE_CLIPS[0];
  let thumbs = SAMPLE_CLIPS.slice(1, 6);
  let searchValue = '';
  let searchFocused = false;
  if (state === 'search') {
    searchValue = 'migration';
    searchFocused = true;
    selected = SAMPLE_CLIPS[4]; // the slack text about migration
    thumbs = [SAMPLE_CLIPS[8]]; // matching code clip docker
  }
  if (state === 'filter') {
    selected = SAMPLE_CLIPS[0];
    thumbs = SAMPLE_CLIPS.filter((c) => c.type === 'code');
  }
  if (state === 'link') {
    selected = SAMPLE_CLIPS[1]; // link
    thumbs = SAMPLE_CLIPS.slice(2, 7);
  }

  const renderFocus = () => {
    if (state === 'empty') {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <EmptyClipboardArtTone color={T.textTertiary} accent={accent} />
          <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>Nothing here yet</div>
          <div style={{ fontSize: 12, color: T.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            Copy anything — text, an image, a file — and it’ll show up here.
          </div>
        </div>
      );
    }
    // text-type clip preview
    if (selected.type === 'text') {
      return (
        <div style={{ flex: 1, overflow: 'hidden', fontSize: 14, color: T.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {selected.content}
        </div>
      );
    }
    if (selected.type === 'link') {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: selected.favicon, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: 'Geist Mono, ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.url}</span>
              <span style={{ fontSize: 15, color: T.text, fontWeight: 500, marginTop: 2 }}>{selected.title}</span>
            </div>
          </div>
          <div style={{
            flex: 1, borderRadius: 10, minHeight: 0,
            background: `linear-gradient(135deg, ${selected.favicon}22, ${T.surfaceRaised})`,
            border: `1px solid ${T.borderSubtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10,
          }}>preview · open-graph thumbnail</div>
        </div>
      );
    }
    // default: code
    return (
      <pre style={{
        margin: 0, flex: 1, overflow: 'hidden',
        fontFamily: 'Geist Mono, ui-monospace, monospace',
        fontSize: 13, lineHeight: 1.55, color: T.text, whiteSpace: 'pre',
      }}>{highlightCode(selected.content, selected.lang || 'tsx', codePalette)}</pre>
    );
  };

  const focusBadge = () => {
    if (state === 'empty') return null;
    return <TypeBadge type={selected.type} lang={selected.lang} mode={mode} color={selected.type === 'color' ? selected.hex : undefined} />;
  };

  const renderThumbs = () => {
    if (state === 'empty') {
      return (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: T.textTertiary, padding: 20,
        }}>↩ ⌫ are wired up — start copying.</div>
      );
    }
    return (
      <div style={{ flex: 1, display: 'flex', gap: 8, padding: '14px 16px', overflow: 'hidden' }}>
        {thumbs.map((c) => (
          <div key={c.id} style={{ width: 130, flexShrink: 0 }}>
            <ClipCard clip={c} mode={mode} width={130} height={220} density="compact" />
          </div>
        ))}
        {thumbs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.textSecondary }}>
            No other matches
          </div>
        )}
      </div>
    );
  };

  const footerHint =
    state === 'search' ? `1 match for “${searchValue}”` :
    state === 'filter' ? `${thumbs.length + 1} code clips · ` :
    '500 · paired';

  return (
    <div style={{
      width, height,
      background: `${T.bg}D9`, backdropFilter: 'blur(24px)',
      borderRadius: 20, border: `1px solid ${T.borderSubtle}`,
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      color: T.text, fontFamily: 'Geist, system-ui, sans-serif',
      overflow: 'hidden', display: 'flex',
    }}>
      {/* Left — focused clip */}
      <div style={{
        width: 480, padding: 24,
        borderRight: `1px solid ${T.borderSubtle}`,
        display: 'flex', flexDirection: 'column', gap: 14,
        background: mode === 'dark' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.02)',
        minHeight: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {focusBadge()}
          {state !== 'empty' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <Kbd mode={mode}>↵</Kbd>
              <span style={{ fontSize: 11, color: T.textSecondary, alignSelf: 'center' }}>paste</span>
            </div>
          )}
        </div>
        {renderFocus()}
        {state !== 'empty' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}`,
            fontSize: 11, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace',
          }}>
            {selected.source && I.app[selected.source] && React.createElement(I.app[selected.source])}
            <span>{selected.source === 'vscode' ? 'panel.tsx · VS Code' : selected.source === 'slack' ? 'Slack · #engineering' : selected.source === 'chrome' ? 'github.com' : selected.source}</span>
            <span style={{ flex: 1 }} />
            <span>copied {selected.time} ago</span>
          </div>
        )}
      </div>

      {/* Right — header + horizontal cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          height: 48, padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          <SearchBar mode={mode} width={300} value={searchValue} focused={searchFocused} />
          {state === 'filter' && <FilterChip label="Code" mode={mode} active />}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{footerHint}</span>
          <I.settings size={18} color={T.textSecondary} />
        </div>
        {renderThumbs()}
      </div>
    </div>
  );
}

function EmptyClipboardArtTone({ color, accent }) {
  return (
    <svg width="48" height="48" viewBox="0 0 56 56" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="10" width="28" height="36" rx="3" />
      <rect x="22" y="6" width="12" height="6" rx="1.5" />
      <line x1="20" y1="22" x2="36" y2="22" />
      <line x1="20" y1="28" x2="32" y2="28" />
      <line x1="20" y1="34" x2="28" y2="34" />
      <path d="M44 12l2 1 1 2-1 2-2 1-2-1-1-2 1-2z" fill={accent} stroke="none" />
    </svg>
  );
}

// ─── Variant B: Sectioned list (vertical) ────────────────────
function SectionedPanel({ mode = 'dark', width = 1280, height = 340, state = 'default' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  let groups, searchValue = '', activeFilter = 'all';
  if (state === 'search') {
    searchValue = 'migration';
    const q = searchValue.toLowerCase();
    const matches = SAMPLE_CLIPS.filter((c) =>
      (c.content || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q));
    groups = [{ label: `RESULTS · ${matches.length} MATCHES`, items: matches }];
  } else if (state === 'filter') {
    activeFilter = 'code';
    groups = [
      { label: 'PINNED', items: SAMPLE_CLIPS.filter((c) => c.type === 'code' && c.pinned) },
      { label: 'TODAY', items: SAMPLE_CLIPS.filter((c) => c.type === 'code' && !c.pinned) },
    ];
  } else {
    groups = [
      { label: 'PINNED', items: SAMPLE_CLIPS.filter((c) => c.pinned) },
      { label: 'TODAY · 3:42 PM', items: SAMPLE_CLIPS.slice(1, 5) },
      { label: 'TODAY · 2:15 PM', items: SAMPLE_CLIPS.slice(5, 8) },
      { label: 'EARLIER', items: SAMPLE_CLIPS.slice(8, 12) },
    ];
  }

  const Row = ({ clip, selected }) => {
    const Src = clip.source && I.app[clip.source];
    const text =
      clip.type === 'link' ? clip.title :
      clip.type === 'color' ? `${clip.hex}  ${clip.rgb}` :
      clip.type === 'file' ? clip.filename :
      clip.type === 'image' ? 'Screenshot 1920×1080' :
      clip.type === 'emoji' ? clip.content :
      clip.content.split('\n')[0];

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 10px', borderRadius: 7,
        background: selected ? T.surfaceRaised : 'transparent',
        border: `1px solid ${selected ? accent : 'transparent'}`,
      }}>
        <TypeBadge type={clip.type} mode={mode} lang={clip.lang} color={clip.type === 'color' ? clip.hex : undefined} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13, color: T.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: clip.type === 'code' ? 'Geist Mono, ui-monospace, monospace' : 'Geist, system-ui, sans-serif',
        }}>{text}</span>
        {Src && <Src />}
        {clip.favorited
          ? <I.starFill size={11} color={accent} />
          : <span style={{ width: 11 }} />}
        <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace', width: 28, textAlign: 'right' }}>{clip.time}</span>
      </div>
    );
  };

  // partition into 3 cols
  const cols = state === 'search'
    ? [groups, [], []]
    : state === 'filter'
      ? [[groups[0]], [groups[1]], []]
      : [groups.slice(0, 2), groups.slice(2, 3), groups.slice(3)];

  return (
    <div style={{
      width, height,
      background: `${T.bg}D9`, backdropFilter: 'blur(24px)',
      borderRadius: 20, border: `1px solid ${T.borderSubtle}`,
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      color: T.text, fontFamily: 'Geist, system-ui, sans-serif',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 48, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${T.borderSubtle}`, flexShrink: 0,
      }}>
        <SearchBar mode={mode} width={360} value={searchValue} focused={state === 'search'} />
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <FilterChip label="All" active={activeFilter === 'all'} mode={mode} />
          <FilterChip label="Favorites" icon={I.star} mode={mode} />
          <FilterChip label="Text" mode={mode} />
          <FilterChip label="Image" mode={mode} />
          <FilterChip label="Link" mode={mode} />
          <FilterChip label="Code" active={activeFilter === 'code'} mode={mode} />
          <FilterChip label="File" mode={mode} />
        </div>
        <I.settings size={18} color={T.textSecondary} />
      </div>

      {state === 'empty' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState mode={mode} variant="no-history" />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', padding: '14px 16px', gap: 24, overflow: 'hidden' }}>
          {cols.map((col, ci) => (
            <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {col.map((g, gi) => (
                <div key={gi}>
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: g.label.startsWith('RESULTS') ? accent : T.textTertiary,
                    letterSpacing: 0.8,
                    padding: '0 10px 5px', fontFamily: 'Geist Mono, ui-monospace, monospace',
                  }}>{g.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {g.items.length === 0
                      ? <div style={{ padding: 10, fontSize: 11, color: T.textTertiary, fontStyle: 'italic' }}>— none —</div>
                      : g.items.map((c, i) => <Row key={c.id} clip={c} selected={ci === 0 && gi === 0 && i === 0} />)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{
        height: 28, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderTop: `1px solid ${T.borderSubtle}`,
        fontSize: 11, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace',
        flexShrink: 0,
      }}>
        <span>500 items</span>
        <span style={{ opacity: .5 }}>·</span>
        <ConnectionIndicator mode={mode} state="connected" deviceName="Pixel 7" />
        <div style={{ flex: 1 }} />
        <span style={{ opacity: .7 }}>↑↓ navigate · ↵ paste · Super+F search</span>
      </div>
    </div>
  );
}

// ─── Variant C: Mosaic — varied card sizes ──────────────────
function MosaicPanel({ mode = 'dark', width = 1280, height = 340, state = 'default' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  let items, searchValue = '';
  if (state === 'search') {
    searchValue = 'github';
    items = SAMPLE_CLIPS.filter((c) =>
      (c.content || '').toLowerCase().includes('github') ||
      (c.title || '').toLowerCase().includes('github') ||
      (c.url || '').toLowerCase().includes('github')
    ).map((c, i) => ({ clip: c, w: i === 0 ? 320 : 200 }));
  } else {
    items = [
      { clip: SAMPLE_CLIPS[0], w: 280 }, // code wide
      { clip: SAMPLE_CLIPS[1], w: 200 }, // link
      { clip: SAMPLE_CLIPS[2], w: 240 }, // image
      { clip: SAMPLE_CLIPS[3], w: 160 }, // color
      { clip: SAMPLE_CLIPS[4], w: 220 }, // text
      { clip: SAMPLE_CLIPS[6], w: 130 }, // emoji
      { clip: SAMPLE_CLIPS[7], w: 200 }, // file
    ];
  }

  return (
    <div style={{
      width, height,
      background: `${T.bg}D9`, backdropFilter: 'blur(24px)',
      borderRadius: 20, border: `1px solid ${T.borderSubtle}`,
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      color: T.text, fontFamily: 'Geist, system-ui, sans-serif',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 48, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${T.borderSubtle}`, flexShrink: 0,
      }}>
        <SearchBar mode={mode} width={360} value={searchValue} focused={state === 'search'} />
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <FilterChip label="All" active={state !== 'filter'} mode={mode} />
          <FilterChip label="Favorites" icon={I.star} mode={mode} />
          <FilterChip label="Text" mode={mode} />
          <FilterChip label="Image" mode={mode} />
          <FilterChip label="Link" active={state === 'filter'} mode={mode} />
          <FilterChip label="Code" mode={mode} />
        </div>
        <I.settings size={18} color={T.textSecondary} />
      </div>

      {state === 'transfer' ? (
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: '16px 20px', overflow: 'hidden', alignItems: 'stretch' }}>
          <TransferCard mode={mode} />
          {[
            { clip: SAMPLE_CLIPS[0], w: 240 },
            { clip: SAMPLE_CLIPS[1], w: 200 },
            { clip: SAMPLE_CLIPS[2], w: 220 },
            { clip: SAMPLE_CLIPS[3], w: 160 },
            { clip: SAMPLE_CLIPS[4], w: 200 },
          ].map((it) => (
            <div key={it.clip.id} style={{ flexShrink: 0 }}>
              <ClipCard clip={it.clip} mode={mode} width={it.w} height={232} />
            </div>
          ))}
        </div>
      ) : state === 'filter' ? (
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: '16px 20px', overflow: 'hidden', alignItems: 'stretch' }}>
          {SAMPLE_CLIPS.filter((c) => c.type === 'link').map((c, i) => (
            <div key={c.id} style={{ flexShrink: 0 }}>
              <ClipCard clip={c} mode={mode}
                width={i === 0 ? 320 : 220} height={232}
                state={i === 0 ? 'selected' : 'default'} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState mode={mode} variant="no-results" search={searchValue} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: '16px 20px', overflow: 'hidden', alignItems: 'stretch' }}>
          {items.map((it, i) => (
            <div key={it.clip.id} style={{ flexShrink: 0 }}>
              <ClipCard clip={it.clip} mode={mode} width={it.w} height={232}
                state={i === 0 ? 'selected' : 'default'} density="comfortable" />
            </div>
          ))}
        </div>
      )}

      <div style={{
        height: 28, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderTop: `1px solid ${T.borderSubtle}`,
        fontSize: 11, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace',
        flexShrink: 0,
      }}>
        <span>{state === 'search' ? `${items.length} matches` : '500 items'}</span>
        <span style={{ opacity: .5 }}>·</span>
        <ConnectionIndicator mode={mode} state="connected" deviceName="Pixel 7" />
      </div>
    </div>
  );
}

window.SpotlightPanel = SpotlightPanel;
window.SectionedPanel = SectionedPanel;
window.MosaicPanel = MosaicPanel;
