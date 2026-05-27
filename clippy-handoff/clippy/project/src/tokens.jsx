// Design tokens for ClipMate. Pure data, no rendering.

window.CM_TOKENS = {
  dark: {
    bg: '#16161F',
    bgSolid: '#0E0E15',                       // for non-blurred desktop fills
    surface: '#1F1F2A',
    surfaceRaised: '#2A2A38',
    surfaceSunken: '#15151C',
    borderSubtle: '#2D2D3A',
    borderStrong: '#3A3A4A',
    text: '#ECECF1',
    textSecondary: '#9999A8',
    textTertiary: '#5C5C6B',
    warn: '#A55C5C',
  },
  light: {
    bg: '#F5F5FA',
    bgSolid: '#EFEFF4',
    surface: '#FFFFFF',
    surfaceRaised: '#F0F0F5',
    surfaceSunken: '#ECECF1',
    borderSubtle: '#E5E5EC',
    borderStrong: '#D5D5DE',
    text: '#1A1A24',
    textSecondary: '#5C5C6B',
    textTertiary: '#9999A8',
    warn: '#B86A6A',
  },
  // Curated accent swatches for the tweaks panel
  accents: {
    coral:    '#E95678',
    indigo:   '#7C7CFF',
    teal:     '#5BC0BE',
    violet:   '#C792EA',
    bone:     '#ECECF1',
  },
  // Subtle type-badge tints — bg / fg in DARK mode. Light handled inline.
  badges: {
    text:  { bg: 'rgba(153,153,168,0.10)', fg: '#B0B0BE',  light: { bg: '#ECECF1', fg: '#5C5C6B' } },
    link:  { bg: 'rgba(124,156,255,0.13)', fg: '#A6B7EA',  light: { bg: '#E8EEFB', fg: '#3F5DAB' } },
    code:  { bg: 'rgba(199,146,234,0.14)', fg: '#C9A8E7',  light: { bg: '#F0E6F8', fg: '#7A4FA6' } },
    image: { bg: 'rgba(91,192,190,0.14)',  fg: '#8FCFC9',  light: { bg: '#DDF2F1', fg: '#3A8B86' } },
    color: { bg: 'rgba(255,180,120,0.14)', fg: '#D9B493',  light: { bg: '#F7ECE0', fg: '#8C6238' } },
    emoji: { bg: 'rgba(230,189,108,0.14)', fg: '#D9BC8A',  light: { bg: '#F6ECD8', fg: '#8C6F35' } },
    file:  { bg: 'rgba(140,150,170,0.14)', fg: '#9FA9BC',  light: { bg: '#E5E8ED', fg: '#5A6478' } },
  },
};

// Geist + Geist Mono via Google Fonts
if (typeof document !== 'undefined' && !document.getElementById('cm-fonts')) {
  const l = document.createElement('link');
  l.id = 'cm-fonts';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
  document.head.appendChild(l);
}
