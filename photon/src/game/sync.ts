import type { Runtime } from "./engine.ts";
import { getQuest } from "./quests.ts";
import { parsePlace } from "../db/store.ts";

const QUESTS: Record<string, { title: string; difficulty: "easy" | "medium" | "hard"; theme: string; name: string; collectibleId: string }> = {
  "hidden-detail": { title: "Hidden Detail", difficulty: "easy", theme: "hidden", name: "Hidden Detail pin", collectibleId: "pin-hidden-detail" },
  "nature-nearby": { title: "Nature Nearby", difficulty: "easy", theme: "botanical", name: "Nature Nearby pin", collectibleId: "pin-nature-nearby" },
  "shared-perspective": {
    title: "Shared Perspective",
    difficulty: "medium",
    theme: "cooperative",
    name: "Shared Perspective pin",
    collectibleId: "pin-shared-perspective",
  },
};

/** Copy a linked SQLite reward into Supabase. Missing server credentials leave the row pending. */
export async function syncPendingRewards(runtime: Runtime): Promise<void> {
  const url = runtime.config.supabaseUrl;
  const key = runtime.config.supabaseServiceRoleKey;
  const rows = runtime.store.pendingCloudRewards();
  if (!url || !key) return;
  for (const row of rows) {
    const quest = QUESTS[row.questId] ?? null;
    const known = getQuest(row.questId);
    if (!quest || !known) {
      runtime.store.markRewardSync(row.operationKey, "skipped");
      continue;
    }
    const place = parsePlace(row.placeLabel);
    const label = (place?.label ?? "A place you named").slice(0, 80);
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/record_messaging_completion`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: row.appUserId,
          p_quest_id: row.questId,
          p_title: quest.title,
          p_difficulty: quest.difficulty,
          p_collectible_id: quest.collectibleId,
          p_collectible_name: quest.name,
          p_theme: quest.theme,
          p_place_label: label,
          p_time_zone: row.timezone,
        }),
      });
      if (res.ok) runtime.store.markRewardSync(row.operationKey, "synced");
      else console.log(JSON.stringify({ event: "cloud_sync_failed", status: res.status, questId: row.questId }));
    } catch {
      console.log(JSON.stringify({ event: "cloud_sync_failed", status: 0, questId: row.questId }));
    }
  }
}
