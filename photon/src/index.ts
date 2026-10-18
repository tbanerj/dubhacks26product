import { startApi } from "./api/server.ts";
import { loadConfig } from "./config.ts";
import { openStore } from "./db/store.ts";
import type { Runtime } from "./game/engine.ts";
import { deliverDueReminders } from "./game/engine.ts";
import { syncPendingRewards } from "./game/sync.ts";
import { cleanupExpiredMedia } from "./jobs/retention.ts";
import { runDemoCli } from "./messaging/demo.ts";
import { deliverOutbox } from "./messaging/deliver.ts";
import { runPhoton } from "./messaging/photon.ts";
import { runScheduler } from "./messaging/scheduler.ts";

const config = loadConfig();
const store = openStore(config.databasePath);
const runtime: Runtime = { config, store, now: () => new Date() };
cleanupExpiredMedia(runtime);

try {
  const server = startApi(runtime);
  console.log(JSON.stringify({ event: "api_ready", port: server.port, devApi: config.devApi }));
} catch (error) {
  console.log(JSON.stringify({ event: "api_unavailable", category: error instanceof Error ? error.name : "error" }));
}

if (config.transport === "demo") {
  const timer = setInterval(() => {
    const due = deliverDueReminders(runtime);
    for (const item of due) console.log(`Thaw reminder\n${item.text}\n`);
    const prompts = runScheduler(runtime);
    for (const item of prompts) console.log(`Thaw prompt\n${item.text}\n`);
    void deliverOutbox(runtime, async () => ({}));
    void syncPendingRewards(runtime);
    cleanupExpiredMedia(runtime);
  }, 15_000);
  try {
    await runDemoCli(runtime);
  } finally {
    clearInterval(timer);
    store.close();
  }
} else {
  await runPhoton(runtime);
  store.close();
}
