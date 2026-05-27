# Design Polish Spec — Clippy.html handoff

Source: `tMlKRyzDJK1bwwNzKWyWYw/clippy/project/Clippy.html` (Claude Design bundle)
Status: SPEC ONLY — implementation deferred.

## What's already shipped vs the design

| Element | Status | Notes |
|---|---|---|
| Dark palette + tokens | ✅ | `tokens.ts` matches exactly |
| Card sizes (compact / comfortable / spacious) | ✅ | width/height/pad/gap match |
| Type badge (top-left, colored pill) | ✅ | Uses badge-{type}-bg/fg CSS vars |
| Pinned coral stripe | ✅ | renders when `clip.isPinned` |
| Image thumbnail | ✅ | Fetches PNG bytes via IPC, decodes |
| Color swatch + hex + rgb | ✅ | Large swatch with top gloss, hex+rgb meta |
| Emoji 64px | ✅ | |
| Code syntax highlighting | ✅ | Tiny tokenizer (keywords/strings/comments/numbers), bash vs JS heuristic |
| Link card with favicon + host + url | ✅ | HSL-tinted initial favicon |
| File glyph + extension badge | ✅ | SVG paper-sheet with PDF/ZIP/PNG/BIN badge |
| Source-app icons | ✅ | GNOME extension pushes via SetFocusedApp D-Bus; cards render inline SVGs for known apps |
| Search bar `/` keyboard hint chip | ✅ | |
| Filter chip counts | ✅ | Hidden when 0 |
| Connection indicator: Smartphone + Zap | ✅ | |
| Kbd component for footer hints | ✅ | Geist Mono in subtle pills |
| Settings: Devices section | ✅ | Live state dot + Unpair button |
| Settings: Exclusions UI | ✅ | Chip-list editor (list/add/remove via new IPC) |
| Filter transfer circular-progress card | ❌ | Deferred — bottom banner is sufficient |
| Per-type Actions editor | ❌ | Still stubbed |

## Implementation order (when picked up later)

1. **Card type-specific rendering** — biggest visual lift. Add a `highlight()` helper for code, a `hexToRgb()` for color, a `<FileGlyph>` SVG with extension badge, and a link card layout (favicon + host + url).
2. **Kbd component** — already created at `desktop/renderer/src/components/Kbd.tsx`. Replace inline Lucide icons in the App.tsx footer hints.
3. **Filter chip counts** — needs an IPC channel `clip:counts` returning `{ text: N, link: N, ... }` and a state pass-through.
4. **Connection indicator polish** — wire Lucide `Smartphone` + `Zap` icons matching design.
5. **Search bar `/` chip** — add to empty search state. Bind global `/` key to focus search.
6. **Pinned stripe verification** — copy a clip, mark as pinned via context menu, confirm the coral 2px stripe paints at the card top edge.
7. **Settings → Devices section** — list paired devices, name/last-seen/pubkey-fingerprint; Unpair button per device.
8. **Source-app icons** — out of scope until we have a reliable focused-window source (probably via the GNOME extension once it lands).

## Things in the design we're NOT building
- File transfer circular-progress card variant — current bottom-banner UX is sufficient given <10MB cap
- Cancel button on transfers — per user, <10MB transfers complete fast enough that cancel is unnecessary
- "SEND TO PIXEL 7" hover badge below cards — context menu already covers this affordance
