import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Runtime } from "../game/engine.ts";

/** Deletes private evidence files after the retention window. Progress rows stay. */
export function cleanupExpiredMedia(runtime: Runtime): number {
  const cutoff = new Date(runtime.now().getTime() - runtime.config.mediaRetentionHours * 60 * 60 * 1000).toISOString();
  const expired = runtime.store.expiredMedia(cutoff);
  let removed = 0;
  for (const row of expired) {
    removed += removeFile(row.media_path);
    runtime.store.clearMediaPath(row.id);
  }
  const referenced = runtime.store.referencedMediaPaths();
  let names: string[] = [];
  try {
    names = readdirSync(runtime.config.mediaDir);
  } catch {
    return removed;
  }
  for (const name of names) {
    const path = join(runtime.config.mediaDir, name);
    if (referenced.has(path)) continue;
    try {
      const age = runtime.now().getTime() - statSync(path).mtimeMs;
      if (age > runtime.config.mediaRetentionHours * 60 * 60 * 1000) {
        removed += removeFile(path);
      }
    } catch {
      continue;
    }
  }
  return removed;
}

function removeFile(path: string): number {
  try {
    unlinkSync(path);
    return 1;
  } catch {
    return 0;
  }
}
