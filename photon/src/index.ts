import { startApi } from "./api/server.ts";
import { loadConfig } from "./config.ts";
import { openStore } from "./db/store.ts";
import type { Runtime } from "./game/engine.ts";
import { deliverDueReminders } from "./game/engine.ts";
import { cleanupExpiredMedia } from "./jobs/retention.ts";
import { runDemoCli } from "./messaging/demo.ts";
import { deliverOutbox } from "./messaging/deliver.ts";
import { runPhoton } from "./messaging/photon.ts";

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
    void deliverOutbox(runtime, async () => ({}));
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
