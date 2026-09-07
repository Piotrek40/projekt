// Wspólny import sharp 0.35.4 dla skryptów pomiarowych: leży TYLKO w tools/node_modules głównego repo (worktree go nie ma) —
// najpierw ścieżka względna od tego pliku (audyt/testy/tools → ../../../tools), potem bezwzględna.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
export const TOOLS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');            // katalog repo (albo worktree)
export const ASSETS_SRC = existsSync(resolve(TOOLS_DIR, 'audyt/assets_src')) ? resolve(TOOLS_DIR, 'audyt/assets_src') : '/home/user/projekt/audyt/assets_src';
const local = resolve(TOOLS_DIR, 'tools/node_modules/sharp');
export const sharp = createRequire(import.meta.url)(existsSync(local) ? local : '/home/user/projekt/tools/node_modules/sharp');
