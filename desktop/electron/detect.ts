import type { ContentType } from './ipc-types';

const COLOR_RE = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\s*$/;
const URL_RE = /^(https?|ftp|ftps):\/\/\S+$/i;

const CODE_APPS = new Set(
  [
    'code', 'code-insiders', 'vscode',
    'jetbrains-idea', 'jetbrains-pycharm', 'jetbrains-webstorm', 'jetbrains-rustrover',
    'gnome-terminal', 'kitty', 'alacritty', 'wezterm',
    'neovim', 'nvim', 'vim', 'sublime_text', 'zed',
  ].map((s) => s.toLowerCase())
);

const CODE_HINTS = ['{', '}', ';', 'fn ', 'def ', 'function ', 'import ', 'class ', '<?', '</'];

// Emoji-only test: char.codePointAt is in a known emoji range, or matches emoji property.
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s)+$/u;

export function detectText(text: string, sourceApp: string | null): ContentType {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'text';

  // URL?
  if (!/\s/.test(trimmed) && URL_RE.test(trimmed)) return 'link';

  // Color literal?
  if (COLOR_RE.test(trimmed)) return 'color';

  // Emoji only?
  if (EMOJI_REGEX.test(trimmed) && /\p{Extended_Pictographic}/u.test(trimmed)) return 'emoji';

  // Code by source app?
  if (sourceApp && CODE_APPS.has(sourceApp.toLowerCase())) return 'code';

  // Code by heuristic on multiline?
  if (trimmed.includes('\n')) {
    if (CODE_HINTS.some((h) => trimmed.includes(h))) return 'code';
  }

  return 'text';
}
