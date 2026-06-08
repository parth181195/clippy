import { execFileSync } from 'node:child_process';

/**
 * Focused-app capture on Windows via PowerShell + Win32 GetForegroundWindow.
 *
 * Caches aggressively (1 s TTL) because spawning powershell.exe costs
 * 500–800 ms — far too much to do on every clipboard poll. The 1 s window
 * is fine for the source-app label use-case; a clip captured during a fast
 * app-switch may get the previous window's name, but that's acceptable for
 * v0.3.
 *
 * A follow-up will replace this with a native node-addon calling
 * GetForegroundWindow + GetWindowText directly (sub-millisecond), at which
 * point we can drop the cache TTL to match Mac/Linux.
 */
const SCRIPT = `Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
'@
$h = [W]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[W]::GetWindowText($h, $sb, 256) | Out-Null
$sb.ToString()`;

let _cache: { name: string | null; at: number } | null = null;
const TTL_MS = 1000;

export function currentFocusedApp(): string | null {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.name;
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', SCRIPT],
      {
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    )
      .toString()
      .trim();
    _cache = { name: out.length > 0 ? out : null, at: now };
    return _cache.name;
  } catch {
    _cache = { name: null, at: now };
    return null;
  }
}
