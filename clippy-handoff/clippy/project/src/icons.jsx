// Inline stroke icons — Lucide-style, 1.5px stroke at 16px.
// All accept {size, color, fill}. Default stroke="currentColor".

const Icon = ({ d, size = 16, color = 'currentColor', strokeWidth = 1.5, fill = 'none', children, viewBox = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={color}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: 'block' }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  search:     (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>,
  settings:   (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>,
  star:       (p) => <Icon {...p}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1z" /></Icon>,
  starFill:   (p) => <Icon fill={p.color || 'currentColor'} {...p}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1z" /></Icon>,
  x:          (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>,
  link:       (p) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>,
  code:       (p) => <Icon {...p}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></Icon>,
  image:      (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></Icon>,
  palette:    (p) => <Icon {...p}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2a10 10 0 0 0 0 20c2 0 3-1.3 3-2.6 0-.6-.2-1.2-.7-1.7-.4-.4-.7-1-.7-1.6 0-1.3 1-2.4 2.4-2.4H17a5 5 0 0 0 5-5 9 9 0 0 0-10-9z" /></Icon>,
  smile:      (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></Icon>,
  file:       (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Icon>,
  send:       (p) => <Icon {...p}><path d="m22 2-7 20-4-9-9-4 20-7z" /></Icon>,
  smartphone: (p) => <Icon {...p}><rect x="5" y="2" width="14" height="20" rx="2.5" /><line x1="12" y1="18" x2="12.01" y2="18" /></Icon>,
  zap:        (p) => <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>,
  eyeOff:     (p) => <Icon {...p}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A11 11 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></Icon>,
  arrowLeft:  (p) => <Icon {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Icon>,
  arrowRight: (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>,
  chevronRight:(p) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>,
  chevronDown:(p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>,
  check:      (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>,
  wifi:       (p) => <Icon {...p}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></Icon>,
  wifiOff:    (p) => <Icon {...p}><line x1="2" y1="2" x2="22" y2="22" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M2 8.82a15 15 0 0 1 4.17-2.65" /><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" /><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" /><path d="M5 13a10 10 0 0 1 5.24-2.76" /><line x1="12" y1="20" x2="12.01" y2="20" /></Icon>,
  plus:       (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>,
  clipboard:  (p) => <Icon {...p}><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></Icon>,
  filter:     (p) => <Icon {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></Icon>,
  monitor:    (p) => <Icon {...p}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></Icon>,
  trash:      (p) => <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></Icon>,
  more:       (p) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>,
  copy:       (p) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>,
  pin:        (p) => <Icon {...p}><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></Icon>,
  lock:       (p) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>,
  // Source-app glyphs (placeholders — would be actual fetched icons in app)
  app: {
    chrome:    () => <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.5" fill="#fff" stroke="#d0d0d8" strokeWidth=".5"/><circle cx="7" cy="7" r="2.4" fill="#4285F4"/><path d="M7 4.6L11.3 4.6 9.5 7.7" stroke="#EA4335" strokeWidth="2.4" fill="none" strokeLinecap="round"/><path d="M5 5.7L2.8 9.5 6.1 9.5" stroke="#34A853" strokeWidth="2.4" fill="none" strokeLinecap="round"/><path d="M9.1 8L7 11.3 5 8" stroke="#FBBC04" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg>,
    terminal:  () => <svg width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="3" fill="#2D2D38"/><path d="M3.5 4.5l2 2-2 2M7 9h3" stroke="#7CE8B5" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    figma:     () => <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="4.7" cy="2.3" r="2.3" fill="#F24E1E"/><circle cx="9.3" cy="2.3" r="2.3" fill="#FF7262"/><circle cx="4.7" cy="7" r="2.3" fill="#A259FF"/><circle cx="9.3" cy="7" r="2.3" fill="#1ABCFE"/><circle cx="4.7" cy="11.7" r="2.3" fill="#0ACF83"/></svg>,
    vscode:    () => <svg width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="2" fill="#0078D4"/><path d="M10 3v8L6 9.5 3.5 11.5V2.5L6 4.5z" fill="#fff"/></svg>,
    slack:     () => <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="3" height="6" rx="1.5" fill="#E01E5A"/><rect x="2.5" y="9" width="3" height="2.5" rx="1.25" fill="#36C5F0"/><rect x="8.5" y="5.5" width="3" height="6" rx="1.5" fill="#2EB67D"/><rect x="8.5" y="2.5" width="3" height="2.5" rx="1.25" fill="#ECB22E"/></svg>,
    notes:     () => <svg width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="3" fill="#F5C842"/><path d="M3.5 5h7M3.5 7.5h7M3.5 10h4" stroke="#fff" strokeWidth="1" strokeLinecap="round"/></svg>,
    firefox:   () => <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="url(#fxg)"/><defs><radialGradient id="fxg" cx=".3" cy=".3"><stop offset="0" stopColor="#FFCB6B"/><stop offset="1" stopColor="#E66000"/></radialGradient></defs></svg>,
  },
};

window.I = I;
