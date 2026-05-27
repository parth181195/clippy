# Design Polish Spec — Clippy.html handoff

Source: `tMlKRyzDJK1bwwNzKWyWYw/clippy/project/Clippy.html` (Claude Design bundle)
Status: SPEC ONLY — implementation deferred.

## What's already shipped vs the design

| Element | Status | Notes |
|---|---|---|
| Dark palette + tokens | ✅ | `tokens.ts` matches exactly |
| Card sizes (compact / comfortable / spacious) | ✅ | width/height/pad/gap match |
| Type badge (top-left, colored pill) | ✅ | Uses badge-{type}-bg/fg CSS vars |
| Pinned coral stripe | ⚠️ | Code is in `ClipCard.tsx:74` but verify it paints when `isPinned=true` |
| Image thumbnail | ✅ | Fetches PNG bytes via IPC, decodes |
| Color swatch | ⚠️ | Renders a flat hex bar; design has large swatch + hex + rgb |
| Emoji 64px | ✅ | |
| Code (plain `<pre>`) | ❌ | Design has syntax highlighting (keywords/strings/comments) |
| Link card with favicon + url + title | ❌ | We just dump `clip.preview` as text |
| File glyph (paper sheet w/ extension badge) | ❌ | We dump filename as text |
| Source-app icons (Chrome/Terminal/Figma/VSCode) | ❌ | Our pipeline doesn't capture source app reliably; would need GNOME shell hook or Wayland focused-window introspection |
| Search bar `/` keyboard hint chip | ❌ | |
| Filter chip counts (e.g. "Text 12") | ❌ | Currently just shows label |
| Connection indicator with zap icon when paired | ❌ | We render a plain green dot |
| Kbd component for footer hints | ⚠️ | We use inline Lucide CornerDownLeft + Delete; design has styled monospace key chips |
| Settings: Devices section | ❌ | We have General/Hotkeys but no Devices view for pairing/unpair management |
| Settings: Exclusions UI | ⚠️ | Header exists, body says "Editor lands in a follow-up" |
| Filter transfer "circular progress" card variant | ❌ | We use a bottom-right banner; design uses a card-sized circular arc |

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
