// Sample clipboard history + ClipCard renderer.

const SAMPLE_CLIPS = [
  {
    id: 'c1', type: 'code', lang: 'tsx', pinned: true, source: 'vscode',
    time: 'now',
    content: `const useClips = (q: string) => {
  return clips
    .filter(c => c.text.includes(q))
    .sort((a, b) => b.time - a.time);
};`,
  },
  {
    id: 'c2', type: 'link', source: 'chrome', favorited: true, time: '2m',
    url: 'github.com/anthropic/clipmate',
    title: 'anthropic/clipmate · A clipboard manager for Linux',
    favicon: '#181717',
  },
  {
    id: 'c3', type: 'image', source: 'figma', time: '3m',
    aspect: 'landscape',
  },
  {
    id: 'c4', type: 'color', source: 'figma', time: '5m',
    hex: '#E95678', rgb: 'rgb(233, 86, 120)',
  },
  {
    id: 'c5', type: 'text', source: 'slack', time: '8m',
    content: 'Hey — can you push the migration before the 5pm freeze? Need to verify the index rebuild before Vee is back from PTO. Will run rollback drill in staging tomorrow morning if all green.',
  },
  {
    id: 'c6', type: 'text', source: 'notes', time: '14m',
    content: '4825 Telegraph Ave, Suite 200\nOakland, CA 94609\n+1 (510) 555-0173',
  },
  {
    id: 'c7', type: 'emoji', source: 'slack', time: '22m', favorited: true,
    content: '🫠',
  },
  {
    id: 'c8', type: 'file', source: 'terminal', time: '31m',
    filename: 'staging-dump-2026-05-27.sql.gz',
    size: '24.3 MB',
    mime: 'application/gzip',
  },
  {
    id: 'c9', type: 'code', lang: 'bash', source: 'terminal', time: '38m',
    content: `docker compose up -d \\
  --build \\
  --remove-orphans`,
  },
  {
    id: 'c10', type: 'link', source: 'firefox', time: '1h',
    url: 'linear.app/clipmate/issue/CLP-184',
    title: 'CLP-184 · Multi-device sync flakiness on cold start',
    favicon: '#5E6AD2',
  },
  {
    id: 'c11', type: 'color', source: 'figma', time: '2h',
    hex: '#16161F', rgb: 'rgb(22, 22, 31)',
  },
  {
    id: 'c12', type: 'text', source: 'notes', time: '3h',
    content: 'Q3 OKRs draft:\n1. Ship desktop GA\n2. Android beta to 50 testers\n3. <200ms p95 panel-open',
  },
  {
    id: 'c13', type: 'file', source: 'chrome', time: '5h',
    filename: 'brief-clipmate-v2.pdf',
    size: '184 KB',
    mime: 'application/pdf',
  },
];

window.SAMPLE_CLIPS = SAMPLE_CLIPS;

// ─── Type badge ───────────────────────────────────────────────
function TypeBadge({ type, label, mode = 'dark', lang, color }) {
  const tk = CM_TOKENS.badges[type] || CM_TOKENS.badges.text;
  const sty = mode === 'light' ? tk.light : { bg: tk.bg, fg: tk.fg };
  const displayLabel = label || (lang ? lang.toUpperCase() : type.toUpperCase());
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 7px',
      background: type === 'color' && color ? color : sty.bg,
      color: type === 'color' && color ? '#fff' : sty.fg,
      borderRadius: 6,
      fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
      lineHeight: 1, textTransform: 'uppercase',
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      {displayLabel}
    </span>
  );
}
window.TypeBadge = TypeBadge;

// ─── Code highlighter — extremely tiny: keywords + strings + comments ──
function highlightCode(code, lang, palette) {
  const KW = {
    tsx: /\b(const|let|var|function|return|if|else|import|export|from|async|await|new|class|extends|interface|type|null|undefined|true|false)\b/g,
    bash: /\b(docker|compose|up|down|run|build|exec|sudo|cd|ls|cat|grep|curl|echo|export)\b/g,
  };
  const STR = /(['"`])(?:\\.|(?!\1).)*\1/g;
  const NUM = /\b\d+\b/g;
  const COMMENT = /\/\/[^\n]*|#[^\n]*/g;

  // Token spans: produce array of {type, text}
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    const slice = code.slice(i);
    // comment
    let m = slice.match(/^(\/\/[^\n]*|#[^\n]*)/);
    if (m) { tokens.push({ t: 'c', v: m[0] }); i += m[0].length; continue; }
    // string
    m = slice.match(/^(['"`])(?:\\.|(?!\1).)*\1/);
    if (m) { tokens.push({ t: 's', v: m[0] }); i += m[0].length; continue; }
    // keyword
    const kwRe = KW[lang];
    if (kwRe) {
      const kwm = slice.match(new RegExp('^' + kwRe.source));
      if (kwm) { tokens.push({ t: 'k', v: kwm[0] }); i += kwm[0].length; continue; }
    }
    // number
    m = slice.match(/^\d+(\.\d+)?/);
    if (m) { tokens.push({ t: 'n', v: m[0] }); i += m[0].length; continue; }
    // ident
    m = slice.match(/^[a-zA-Z_$][\w$]*/);
    if (m) { tokens.push({ t: 'i', v: m[0] }); i += m[0].length; continue; }
    tokens.push({ t: 'p', v: code[i] });
    i++;
  }
  const colorFor = (t) => palette[t] || palette.p;
  return tokens.map((tok, idx) => <span key={idx} style={{ color: colorFor(tok.t) }}>{tok.v}</span>);
}
window.highlightCode = highlightCode;

// ─── ClipCard ─────────────────────────────────────────────────
function ClipCard({ clip, mode = 'dark', state = 'default', width = 200, height = 240, density = 'comfortable', noHighlight = false, hideSourceIcon = false }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;

  // Density: comfortable default. compact = tighter inner padding.
  const pad = density === 'compact' ? 10 : density === 'spacious' ? 16 : 12;

  // State styling
  let bg = T.surface;
  let border = `1px solid ${T.borderSubtle}`;
  let translate = 0;
  if (state === 'hover') { bg = T.surfaceRaised; border = `1px solid ${accent}55`; translate = -2; }
  if (state === 'selected') { bg = T.surfaceRaised; border = `1px solid ${accent}`; }
  if (state === 'pressed') { /* scale handled by parent */ }

  const codePalette = mode === 'dark'
    ? { k: '#C792EA', s: '#7CE8B5', c: '#5C5C6B', n: '#FFCB6B', i: T.text, p: T.textSecondary }
    : { k: '#7A4FA6', s: '#3A8B5C', c: '#9999A8', n: '#A36800', i: T.text, p: T.textSecondary };

  const renderContent = () => {
    switch (clip.type) {
      case 'text':
        return (
          <div style={{
            fontSize: 13, lineHeight: 1.5, color: T.text,
            display: '-webkit-box', WebkitLineClamp: 7, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{clip.content}</div>
        );
      case 'link':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: clip.favicon || accent, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'Geist Mono, ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.url}</span>
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.4, color: T.text, fontWeight: 500,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{clip.title}</div>
          </div>
        );
      case 'code':
        return (
          <pre style={{
            fontFamily: 'Geist Mono, ui-monospace, "SF Mono", monospace',
            fontSize: 11.5, lineHeight: 1.45, color: T.text,
            margin: 0, overflow: 'hidden', whiteSpace: 'pre',
            display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical',
          }}>{noHighlight ? clip.content : highlightCode(clip.content, clip.lang, codePalette)}</pre>
        );
      case 'image':
        return (
          <div style={{
            width: '100%', height: '100%', borderRadius: 8,
            background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 30%, ${T.surfaceRaised} 60%, ${accent}22 100%)`,
            position: 'relative', overflow: 'hidden',
            boxShadow: `inset 0 0 0 1px ${T.borderSubtle}`,
          }}>
            {/* faux screenshot — soft shapes */}
            <div style={{ position: 'absolute', top: '20%', left: '15%', width: '50%', height: '20%', background: `${T.text}22`, borderRadius: 4 }} />
            <div style={{ position: 'absolute', top: '45%', left: '15%', width: '70%', height: '8%', background: `${T.text}18`, borderRadius: 3 }} />
            <div style={{ position: 'absolute', top: '57%', left: '15%', width: '60%', height: '8%', background: `${T.text}18`, borderRadius: 3 }} />
            <div style={{ position: 'absolute', top: '72%', left: '15%', width: '30%', height: '12%', background: accent, borderRadius: 4 }} />
          </div>
        );
      case 'color':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
            <div style={{
              flex: 1,
              borderRadius: 8,
              background: clip.hex,
              boxShadow: `inset 0 0 0 1px ${mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}`,
            }} />
            <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>
              <div style={{ color: T.text, fontWeight: 500 }}>{clip.hex}</div>
              <div>{clip.rgb}</div>
            </div>
          </div>
        );
      case 'emoji':
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', fontSize: 64, lineHeight: 1,
            fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          }}>{clip.content}</div>
        );
      case 'file':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: T.surfaceSunken, borderRadius: 8,
              border: `1px dashed ${T.borderSubtle}`,
            }}>
              <FileGlyph mime={clip.mime} mode={mode} accent={accent} />
            </div>
            <div>
              <div style={{
                fontSize: 12, color: T.text, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{clip.filename}</div>
              <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{clip.size}</div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const badgeProps = { type: clip.type, mode, lang: clip.lang, color: clip.type === 'color' ? clip.hex : undefined };
  const SourceGlyph = !hideSourceIcon && clip.source && I.app[clip.source] ? I.app[clip.source] : null;

  return (
    <div style={{
      position: 'relative',
      width, height,
      background: bg,
      border,
      borderRadius: 14,
      padding: pad,
      display: 'flex', flexDirection: 'column',
      gap: pad - 2,
      transition: 'transform 150ms cubic-bezier(.2,.9,.3,1), background 150ms, border-color 150ms',
      transform: state === 'pressed' ? 'scale(0.97)' : `translateY(${translate}px)`,
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>
      {/* pinned top stripe */}
      {clip.pinned && (
        <div style={{
          position: 'absolute', top: 0, left: 14, right: 14, height: 2,
          background: accent, borderBottomLeftRadius: 1, borderBottomRightRadius: 1, opacity: 0.9,
        }} />
      )}

      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 18 }}>
        <TypeBadge {...badgeProps} />
        {SourceGlyph && <SourceGlyph />}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>{renderContent()}</div>

      {/* bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 16 }}>
        <span style={{
          fontSize: 10, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace',
          letterSpacing: 0.3,
        }}>{clip.time}</span>
        {clip.favorited
          ? <I.starFill size={12} color={accent} />
          : <I.star size={12} color={T.textTertiary} />}
      </div>
    </div>
  );
}

function FileGlyph({ mime, mode, accent }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const isPdf = mime?.includes('pdf');
  const isArchive = mime?.includes('gzip') || mime?.includes('zip');
  return (
    <div style={{ position: 'relative' }}>
      <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
        <path d="M4 4a4 4 0 0 1 4-4h18l10 10v34a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4z" fill={T.surface} stroke={T.borderStrong} strokeWidth="1" />
        <path d="M26 0l10 10h-7a3 3 0 0 1-3-3V0z" fill={T.surfaceRaised} stroke={T.borderStrong} strokeWidth="1" />
      </svg>
      <div style={{
        position: 'absolute', bottom: 6, left: 0, right: 0,
        textAlign: 'center', fontSize: 8, fontWeight: 700, letterSpacing: 0.6,
        color: isPdf ? '#D9645C' : isArchive ? '#D9B493' : T.textSecondary,
        fontFamily: 'Geist Mono, ui-monospace, monospace',
      }}>{isPdf ? 'PDF' : isArchive ? 'GZ' : 'BIN'}</div>
    </div>
  );
}

window.ClipCard = ClipCard;
window.FileGlyph = FileGlyph;
