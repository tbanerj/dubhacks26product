import { loadConfig } from "../config.ts";
import { openStore } from "../db/store.ts";
import { listQuests } from "../game/quests.ts";

const config = loadConfig({ ...process.env, THAW_VERIFIER: "demo" });
const store = openStore(config.databasePath);
store.close();
console.log(
  JSON.stringify({
    event: "seeded",
    databasePath: config.databasePath,
    quests: listQuests().map((quest) => quest.id),
    note: "Quest templates live in code. The database file is ready for players.",
  }),
);
