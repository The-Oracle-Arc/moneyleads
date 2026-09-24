#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite JS into the Vercel function but does not
 * copy the Emscripten .data / .wasm payloads next to it. Local `vite preview`
 * (no DATABASE_URL) then dies looking for pglite.data. Deployed apps use Neon
 * and never instantiate PGLite — this copy is for production-preview smoke.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules/@electric-sql/pglite/dist");
const DEST_CANDIDATES = [
  join(ROOT, ".vercel/output/functions/__server.func/_libs"),
];
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function copyPgliteAssets() {
  let copied = 0;
  for (const dest of DEST_CANDIDATES) {
    if (!existsSync(dest)) continue;
    for (const file of FILES) {
      const from = join(SRC, file);
      if (!existsSync(from)) continue;
      copyFileSync(from, join(dest, file));
      copied += 1;
    }
  }
  return copied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = copyPgliteAssets();
  console.log(`[pglite] copied ${n} asset(s) into the production output`);
}
