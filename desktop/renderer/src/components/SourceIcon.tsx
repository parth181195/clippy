// Inline SVGs for common source apps. Matches the design's hand-built icons.
// Match against lowercased substring of the source-app id (which on Wayland
// arrives from the GNOME extension as a desktop-id-shaped string like
// "firefox", "org.gnome.Terminal", "code", "slack", etc.).

const APPS: Record<string, React.ReactNode> = {
  chrome: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6.5" fill="#fff" stroke="#d0d0d8" strokeWidth=".5" />
      <circle cx="7" cy="7" r="2.4" fill="#4285F4" />
      <path d="M7 4.6L11.3 4.6 9.5 7.7" stroke="#EA4335" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M5 5.7L2.8 9.5 6.1 9.5" stroke="#34A853" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M9.1 8L7 11.3 5 8" stroke="#FBBC04" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  ),
  firefox: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6.5" fill="#FF7139" />
      <circle cx="7" cy="7" r="3" fill="#FFA64D" />
    </svg>
  ),
  terminal: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect width="14" height="14" rx="3" fill="#2D2D38" />
      <path d="M3.5 4.5l2 2-2 2M7 9h3" stroke="#7CE8B5" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  figma: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <circle cx="4.7" cy="2.3" r="2.3" fill="#F24E1E" />
      <circle cx="9.3" cy="2.3" r="2.3" fill="#FF7262" />
      <circle cx="4.7" cy="7" r="2.3" fill="#A259FF" />
      <circle cx="9.3" cy="7" r="2.3" fill="#1ABCFE" />
      <circle cx="4.7" cy="11.7" r="2.3" fill="#0ACF83" />
    </svg>
  ),
  vscode: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect width="14" height="14" rx="2" fill="#0078D4" />
      <path d="M10 3v8L6 9.5 3.5 11.5V2.5L6 4.5z" fill="#fff" />
    </svg>
  ),
  slack: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="2.5" y="2.5" width="3" height="6" rx="1.5" fill="#E01E5A" />
      <rect x="2.5" y="9" width="3" height="2.5" rx="1.25" fill="#36C5F0" />
      <rect x="8.5" y="5.5" width="3" height="6" rx="1.5" fill="#2EB67D" />
      <rect x="8.5" y="2.5" width="3" height="2.5" rx="1.25" fill="#ECB22E" />
    </svg>
  ),
  notes: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="2" y="2" width="10" height="10" rx="1.5" fill="#F7E07E" stroke="#D9B43C" strokeWidth=".5" />
      <line x1="4" y1="5" x2="10" y2="5" stroke="#A8862C" strokeWidth=".8" />
      <line x1="4" y1="7" x2="10" y2="7" stroke="#A8862C" strokeWidth=".8" />
      <line x1="4" y1="9" x2="8" y2="9" stroke="#A8862C" strokeWidth=".8" />
    </svg>
  ),
};

function matchApp(sourceApp: string): React.ReactNode | null {
  const s = sourceApp.toLowerCase();
  if (/chrome|chromium/.test(s)) return APPS.chrome;
  if (/firefox/.test(s)) return APPS.firefox;
  if (/terminal|gnome-terminal|kitty|alacritty|wezterm|kgx|console/.test(s)) return APPS.terminal;
  if (/figma/.test(s)) return APPS.figma;
  if (/code|vscode|codium/.test(s)) return APPS.vscode;
  if (/slack/.test(s)) return APPS.slack;
  if (/notes|gedit|text\-editor/.test(s)) return APPS.notes;
  return null;
}

export function SourceIcon({ sourceApp }: { sourceApp: string | null | undefined }) {
  if (!sourceApp) return null;
  const icon = matchApp(sourceApp);
  if (!icon) return null;
  return <span className="src-icon" title={sourceApp}>{icon}</span>;
}
