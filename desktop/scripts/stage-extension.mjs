// electron-builder won't reliably copy extraResources from outside the project
// dir, so stage the GNOME extension into desktop/extension-bundle/ first; the
// `extraResources` entry then bundles it from this in-project path.
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');
const src = join(desktop, '..', 'extension');
const dest = join(desktop, 'extension-bundle');

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
  recursive: true,
  filter: (s) => !/(?:^|[\\/])(Makefile|README\.md|clippy\.zip|\.git)(?:$|[\\/])/.test(s),
});
console.log('staged GNOME extension →', dest);
