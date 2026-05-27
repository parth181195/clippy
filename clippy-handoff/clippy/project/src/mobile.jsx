// Android mobile screens. Frame is 390x780 (Pixel-ish).

const PHONE_W = 390;
const PHONE_H = 780;

function PhoneFrame({ children, mode = 'dark', label = '9:41', label2 = 'Recent' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <div style={{
      width: PHONE_W, height: PHONE_H,
      borderRadius: 38, padding: 6,
      background: mode === 'dark' ? '#000' : '#1A1A24',
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.08), 0 24px 60px rgba(0,0,0,.3)',
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      <div style={{
        position: 'absolute', inset: 6,
        borderRadius: 32, overflow: 'hidden',
        background: T.bgSolid,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* status bar */}
        <div style={{
          height: 38, padding: '0 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 600, color: T.text,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{label}</span>
          {/* notch */}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: 7, background: '#000' }} />
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <I.wifi size={13} color={T.text} />
            <span style={{ fontSize: 11 }}>92</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Bottom nav ────────────────────────────────────────────
function BottomNav({ mode = 'dark', active = 'recent' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const tabs = [
    { id: 'recent', label: 'Recent', icon: I.clipboard },
    { id: 'send', label: 'Send', icon: I.send },
    { id: 'settings', label: 'Settings', icon: I.settings },
  ];
  return (
    <div style={{
      height: 76, padding: '8px 12px 14px',
      borderTop: `1px solid ${T.borderSubtle}`,
      display: 'flex',
      background: T.bg,
    }}>
      {tabs.map((t) => {
        const Ic = t.icon;
        const isActive = t.id === active;
        return (
          <div key={t.id} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer',
          }}>
            <div style={{
              width: 64, height: 32, borderRadius: 16,
              background: isActive ? `${accent}28` : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms',
            }}>
              <Ic size={20} color={isActive ? accent : T.textSecondary} strokeWidth={isActive ? 2 : 1.5} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: isActive ? T.text : T.textSecondary,
            }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile card ──────────────────────────────────────────────
function MobileClipCard({ clip, mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const Src = clip.source && I.app[clip.source];

  const renderPreview = () => {
    switch (clip.type) {
      case 'image': return (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: `linear-gradient(135deg, ${accent}33, ${T.surfaceRaised})`,
          border: `1px solid ${T.borderSubtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><I.image size={20} color={T.textSecondary} /></div>
      );
      case 'color': return (
        <div style={{
          width: 48, height: 48, borderRadius: 8, background: clip.hex,
          boxShadow: `inset 0 0 0 1px ${mode === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
        }} />
      );
      case 'emoji': return (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: T.surfaceRaised,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>{clip.content}</div>
      );
      default: return (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: T.surfaceRaised,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: CM_TOKENS.badges[clip.type]?.fg || T.textSecondary,
        }}>
          {clip.type === 'link' ? <I.link size={20} /> :
           clip.type === 'code' ? <I.code size={20} /> :
           clip.type === 'file' ? <I.file size={20} /> :
           <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>T</span>}
        </div>
      );
    }
  };

  const previewText = () => {
    switch (clip.type) {
      case 'link': return clip.title;
      case 'image': return 'Screenshot';
      case 'color': return clip.hex + ' · ' + clip.rgb;
      case 'emoji': return clip.content;
      case 'file': return clip.filename;
      case 'code': return clip.content.split('\n')[0];
      default: return clip.content;
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: `1px solid ${T.borderSubtle}`,
      minHeight: 76,
    }}>
      {renderPreview()}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <TypeBadge type={clip.type} mode={mode} lang={clip.lang} color={clip.type === 'color' ? clip.hex : undefined} />
          {clip.favorited && <I.starFill size={11} color={accent} />}
        </div>
        <div style={{
          fontSize: 13, color: T.text, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', wordBreak: 'break-word',
        }}>{previewText()}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{clip.time}</span>
        {Src && <Src />}
      </div>
    </div>
  );
}

// ─── Recent screen ───────────────────────────────────────────
function MobileRecent({ mode = 'dark', revealedAction = null, dayHeaders = true }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const clips = SAMPLE_CLIPS.slice(0, 9);
  return (
    <PhoneFrame mode={mode}>
      {/* sticky header */}
      <div style={{ padding: '8px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: T.text, letterSpacing: -0.5 }}>Recent</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: T.surface, border: 'none', color: T.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><I.search size={18} /></button>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: T.surface, border: 'none', color: T.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><I.filter size={16} /></button>
          </div>
        </div>
        {/* connection chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 11px', borderRadius: 12,
          background: T.surface, border: `1px solid ${T.borderSubtle}`,
          fontSize: 11.5, color: T.textSecondary,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />
          synced with <span style={{ color: T.text, fontWeight: 500 }}>Helios</span>
          <span style={{ color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>· 2s ago</span>
        </div>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {dayHeaders && (
          <div style={{
            padding: '8px 16px 4px', fontSize: 10, fontWeight: 600,
            color: T.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase',
            background: T.bg,
          }}>Today</div>
        )}
        {clips.slice(0, 4).map((c, i) => {
          // Reveal action on second clip if requested
          if (i === 1 && revealedAction === 'copy') {
            return <SwipeRevealRow key={c.id} clip={c} mode={mode} action="copy" />;
          }
          if (i === 1 && revealedAction === 'delete') {
            return <SwipeRevealRow key={c.id} clip={c} mode={mode} action="delete" />;
          }
          return <MobileClipCard key={c.id} clip={c} mode={mode} />;
        })}
        {dayHeaders && (
          <div style={{
            padding: '8px 16px 4px', fontSize: 10, fontWeight: 600,
            color: T.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase',
            background: T.bg,
          }}>Yesterday</div>
        )}
        {clips.slice(4, 7).map((c) => <MobileClipCard key={c.id} clip={c} mode={mode} />)}
      </div>

      <BottomNav mode={mode} active="recent" />
    </PhoneFrame>
  );
}

function SwipeRevealRow({ clip, mode, action }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  const isCopy = action === 'copy';
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: isCopy ? `${accent}` : '#B86A6A',
        display: 'flex', alignItems: 'center',
        justifyContent: isCopy ? 'flex-start' : 'flex-end',
        padding: '0 22px',
        color: '#fff', fontSize: 13, fontWeight: 500, gap: 8,
      }}>
        {isCopy && <><I.copy size={18} /><span>Copy to clipboard</span></>}
        {!isCopy && <><span>Delete</span><I.trash size={18} /></>}
      </div>
      <div style={{ position: 'relative', transform: `translateX(${isCopy ? 100 : -100}px)` }}>
        <MobileClipCard clip={clip} mode={mode} />
      </div>
    </div>
  );
}

// ─── Send screen ──────────────────────────────────────────────
function MobileSend({ mode = 'dark' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <PhoneFrame mode={mode}>
      <div style={{ padding: '8px 16px 0' }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 26, fontWeight: 600, color: T.text, letterSpacing: -0.5 }}>Send</h1>

        <div style={{
          background: T.surface, border: `1px solid ${T.borderSubtle}`,
          borderRadius: 14, padding: 14, marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, letterSpacing: 0.6, marginBottom: 8 }}>TO HELIOS</div>
          <div style={{
            fontSize: 14, color: T.text, lineHeight: 1.5, minHeight: 84,
            fontFamily: 'Geist, system-ui, sans-serif',
          }}>
            curl -fsSL https://clipmate.dev/install.sh | sh
            <span style={{ display: 'inline-block', width: 2, height: 14, background: accent, marginLeft: 2, verticalAlign: 'middle' }} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}`,
          }}>
            <div style={{ display: 'flex', gap: 14, color: T.textSecondary }}>
              <I.image size={18} />
              <I.file size={18} />
              <I.code size={18} />
            </div>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: accent, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Send <I.arrowRight size={14} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' }}>Recent transfers</span>
          <span style={{ fontSize: 11, color: T.textSecondary }}>Last 24h</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TransferRow mode={mode} name="design-export.fig" size="42.1 MB" status="done" time="12m" />
        <TransferRow mode={mode} name="staging-dump-2026-05-27.sql.gz" size="24.3 MB" status="progress" progress={0.42} time="now" />
        <TransferRow mode={mode} name="brief-clipmate-v2.pdf" size="184 KB" status="done" time="3h" />
      </div>

      <BottomNav mode={mode} active="send" />
    </PhoneFrame>
  );
}

function TransferRow({ mode, name, size, status, progress, time }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: `1px solid ${T.borderSubtle}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: T.surfaceRaised,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textSecondary,
      }}><I.file size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{size}</span>
          <span style={{ color: T.textTertiary }}>·</span>
          <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{time}</span>
        </div>
        {status === 'progress' && (
          <div style={{ height: 3, background: T.surfaceRaised, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: accent }} />
          </div>
        )}
      </div>
      <button style={{
        padding: '5px 11px', borderRadius: 8,
        background: 'transparent', color: T.text,
        border: `1px solid ${T.borderSubtle}`, cursor: 'pointer',
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
      }}>{status === 'progress' ? 'Cancel' : 'Resend'}</button>
    </div>
  );
}

// ─── Pairing screen ──────────────────────────────────────────
function MobilePairing({ mode = 'dark', stage = 'scan' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <PhoneFrame mode={mode}>
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: '#000',
      }}>
        {/* camera feed — radial dark gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 45%, #2A2530 0%, #14101A 50%, #000 100%)',
        }} />

        {/* viewfinder */}
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 220, height: 220, borderRadius: 16,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.4)`,
        }}>
          {/* corners */}
          {[
            { top: -2, left: -2, borderTop: '4px solid', borderLeft: '4px solid' },
            { top: -2, right: -2, borderTop: '4px solid', borderRight: '4px solid' },
            { bottom: -2, left: -2, borderBottom: '4px solid', borderLeft: '4px solid' },
            { bottom: -2, right: -2, borderBottom: '4px solid', borderRight: '4px solid' },
          ].map((s, i) => <span key={i} style={{ position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderRadius: 3, ...s }} />)}

          {stage === 'paired' && (
            <div style={{
              position: 'absolute', inset: 0, background: `${accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 14,
            }}><I.check size={80} color="#fff" strokeWidth={2.5} /></div>
          )}
        </div>

        <div style={{
          position: 'absolute', top: 60, left: 0, right: 0,
          textAlign: 'center', padding: '0 30px',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: -0.3 }}>
            {stage === 'paired' ? 'Paired with Helios' : stage === 'connecting' ? 'Connecting…' : 'Pair with your desktop'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
            {stage === 'paired'
              ? 'Your clips and files now sync across both devices.'
              : 'Point your phone at the QR code shown on the ClipMate panel.'}
          </p>
        </div>

        {/* bottom controls */}
        <div style={{
          position: 'absolute', bottom: 40, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 14,
        }}>
          <button style={{
            padding: '10px 22px', borderRadius: 14,
            background: 'rgba(255,255,255,0.12)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Enter code instead</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Settings screen ─────────────────────────────────────────
function MobileSettings({ mode = 'dark' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <PhoneFrame mode={mode}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px 18px' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: T.text, letterSpacing: -0.5 }}>Settings</h1>
        </div>

        {/* device card */}
        <div style={{
          margin: '0 16px 18px', padding: 16,
          background: T.surface, border: `1px solid ${T.borderSubtle}`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${accent}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accent,
            }}><I.monitor size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Helios</div>
              <div style={{ fontSize: 11.5, color: T.textSecondary, fontFamily: 'Geist Mono, ui-monospace, monospace', marginTop: 2 }}>
                Ubuntu 24.04 · last sync 2s ago
              </div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />
          </div>
        </div>

        <SectionLabel mode={mode}>Sync</SectionLabel>
        <MobileRow mode={mode} label="Auto-copy to clipboard" hint="New clips replace your clipboard automatically" right={<Toggle on={false} mode={mode} />} />
        <MobileRow mode={mode} label="Notifications" hint="Silent low-priority for clips, default for files" right={<Toggle on={true} mode={mode} />} />
        <MobileRow mode={mode} label="Sync over cellular" hint="Otherwise Wi-Fi only" right={<Toggle on={false} mode={mode} />} />

        <SectionLabel mode={mode}>Appearance</SectionLabel>
        <MobileRow mode={mode} label="Theme" right={<span style={{ fontSize: 13, color: T.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>System <I.chevronRight size={14} color={T.textTertiary} /></span>} />
      </div>
      <BottomNav mode={mode} active="settings" />
    </PhoneFrame>
  );
}

function SectionLabel({ children, mode }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <div style={{
      padding: '14px 16px 6px',
      fontSize: 10, fontWeight: 600, color: T.textTertiary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    }}>{children}</div>
  );
}

function MobileRow({ mode, label, hint, right }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: `1px solid ${T.borderSubtle}`,
      borderBottom: `1px solid ${T.borderSubtle}`,
      marginTop: -1,
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  );
}

// ─── Notification ────────────────────────────────────────────
function MobileNotification({ mode = 'dark', type = 'clip' }) {
  const T = mode === 'dark' ? CM_TOKENS.dark : CM_TOKENS.light;
  const accent = window.CM_ACCENT || CM_TOKENS.accents.coral;
  return (
    <PhoneFrame mode={mode}>
      <div style={{
        flex: 1, position: 'relative',
        background: `linear-gradient(180deg, ${T.bg} 0%, ${T.bgSolid} 100%)`,
      }}>
        {/* lock-screen clock */}
        <div style={{ textAlign: 'center', padding: '40px 0 12px' }}>
          <div style={{ fontSize: 64, fontWeight: 300, color: T.text, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>14:32</div>
          <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>Wednesday · 27 May</div>
        </div>

        {/* notification */}
        <div style={{ padding: '24px 14px 0' }}>
          <div style={{
            background: mode === 'dark' ? 'rgba(31,31,42,0.85)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: 18, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><I.clipboard size={12} color="#fff" /></div>
              <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, letterSpacing: 0.1 }}>ClipMate</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: T.textTertiary }}>now</span>
            </div>
            {type === 'clip' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 3 }}>From Helios</div>
                <div style={{
                  fontSize: 13, color: T.textSecondary, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>Hey — can you push the migration before the 5pm freeze? Need to verify the index rebuild before Vee is back from PTO.</div>
              </>
            )}
            {type === 'file' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 3 }}>brief-clipmate-v2.pdf received</div>
                <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.4 }}>184 KB · from Helios</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
                  <button style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'transparent', color: accent, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Open</button>
                  <div style={{ width: 1, background: T.borderSubtle }} />
                  <button style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'transparent', color: T.text, border: 'none', fontSize: 13, fontWeight: 400, fontFamily: 'inherit', cursor: 'pointer' }}>Share</button>
                </div>
              </>
            )}
          </div>

          {type === 'clip' && (
            <div style={{
              marginTop: 8, padding: '10px 14px',
              background: mode === 'dark' ? 'rgba(31,31,42,0.5)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: 14, opacity: 0.7,
              display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#34A853', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>i</span>
              </div>
              <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>ClipMate</span>
              <span style={{ fontSize: 12, color: T.textTertiary }}>Listening for clips from Helios</span>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

window.MobileRecent = MobileRecent;
window.MobileSend = MobileSend;
window.MobileSettings = MobileSettings;
window.MobilePairing = MobilePairing;
window.MobileNotification = MobileNotification;
window.PhoneFrame = PhoneFrame;
