import { loadConfig } from "../config.ts";
import { openStore } from "../db/store.ts";

const config = loadConfig({ ...process.env, THAW_VERIFIER: "demo", THAW_TRANSPORT: "demo" });
const store = openStore(config.databasePath);
const removed = store.resetDemo();
store.close();
console.log(JSON.stringify({ event: "demo_reset", playersRemoved: removed }));
