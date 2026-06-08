import { execFileSync } from 'node:child_process';

/**
 * Focused-app capture on macOS via System Events. The clipboard poller calls
 * this once per tick (~300 ms), so we cache aggressively — querying
 * AppleScript fresh every poll burns 30–80 ms per call, enough to feel
 * laggy in profile traces.
 */
let _cache: { name: string | null; at: number } | null = null;
const TTL_MS = 250;

const SCRIPT = `tell application "System Events" to get name of first application process whose frontmost is true`;

export function currentFocusedApp(): string | null {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.name;
  try {
    const out = execFileSync('osascript', ['-e', SCRIPT], {
      timeout: 200,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    _cache = { name: out.length > 0 ? out : null, at: now };
    return _cache.name;
  } catch {
    _cache = { name: null, at: now };
    return null;
  }
}
