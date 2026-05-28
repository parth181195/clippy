// Rasterize the brand SVGs (assets/brand/) into the PNGs that desktop +
// mobile need. Single source of truth → run `node scripts/gen-icons.mjs`
// from the desktop/ dir whenever the brand marks change.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const brand = join(repoRoot, 'assets', 'brand');

function render(svgFile, width) {
  const svg = readFileSync(join(brand, svgFile), 'utf8');
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    // Load Geist (bundled with the desktop app) so text in og.svg renders on-brand.
    font: { fontDirs: [join(repoRoot, 'desktop', 'assets', 'fonts')], loadSystemFonts: true, defaultFontFamily: 'Geist' },
  });
  return r.render().asPng();
}

function emit(svgFile, width, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, render(svgFile, width));
  console.log(`  ${svgFile} @${width} → ${outPath.replace(repoRoot + '/', '')}`);
}

const desktopIcons = join(repoRoot, 'desktop', 'assets', 'icons');
const mobileIcons = join(repoRoot, 'mobile', 'assets', 'icon');

console.log('Generating icons…');
// Desktop: window/app icon + electron-builder size-named set + tray glyph.
emit('icon.svg', 512, join(desktopIcons, 'icon.png'));
for (const s of [128, 256, 512]) emit('icon.svg', s, join(desktopIcons, `${s}x${s}.png`));
emit('icon-foreground.svg', 32, join(desktopIcons, 'tray.png'));
// Mobile: legacy launcher + adaptive foreground/background.
emit('icon.svg', 1024, join(mobileIcons, 'icon.png'));
emit('icon-foreground.svg', 1024, join(mobileIcons, 'icon_foreground.png'));
emit('icon-bg.svg', 1024, join(mobileIcons, 'icon_background.png'));
// Landing: 1200x630 social card.
emit('og.svg', 1200, join(repoRoot, 'landing', 'public', 'og.png'));
console.log('Done.');
