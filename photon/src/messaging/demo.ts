import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Runtime } from "../game/engine.ts";
import { deliverDueReminders, settleSubmission, stageIncoming } from "../game/engine.ts";
import { tinyPng } from "../game/images.ts";
import type { IncomingMessage } from "./contracts.ts";
import { deliverOutbox } from "./deliver.ts";

const PLAYERS = ["ada", "ben"] as const;

/**
 * Credential-free chat that uses the same conversation and reward code as iMessage.
 * Players are fictional demo participants, not nearby people.
 */
export async function runDemoCli(runtime: Runtime): Promise<void> {
  let player: (typeof PLAYERS)[number] = "ada";
  let scenario: IncomingMessage["verifierScenario"] = "success";
  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write("Thaw demo. Fictional players: ada, ben. This is not live iMessage.\n");
  stdout.write("Commands: /as ada, /scenario success|mismatch|unavailable, /photo, /reset, /quit\n");
  try {
    for (;;) {
      const line = (await rl.question(`${player}> `)).trim();
      if (!line) continue;
      if (line === "/quit") return;
      if (line === "/reset") {
        runtime.store.resetDemo();
        stdout.write("Demo progress cleared.\n");
        continue;
      }
      if (line.startsWith("/as ")) {
        const next = line.slice(4).trim();
        if (next === "ada" || next === "ben") player = next;
        else stdout.write("Use /as ada or /as ben.\n");
        continue;
      }
      if (line.startsWith("/scenario ")) {
        const next = line.slice(10).trim();
        if (next === "success" || next === "mismatch" || next === "unavailable") scenario = next;
        else stdout.write("Use success, mismatch, or unavailable.\n");
        continue;
      }
      const message = demoMessage(player, line === "/photo" ? undefined : line, line === "/photo", scenario);
      await handleDemoMessage(runtime, message);
    }
  } finally {
    rl.close();
  }
}

export async function handleDemoMessage(runtime: Runtime, message: IncomingMessage): Promise<string[]> {
  const staged = stageIncoming(runtime, message);
  const texts = staged.replies.map((item) => item.text);
  for (const item of staged.replies) printReply(message.senderId, item.text);
  if (staged.submissionId) {
    const settled = settleSubmission(runtime, staged.submissionId, message.verifierScenario);
    for (const item of settled) {
      texts.push(item.text);
      printReply(message.senderId, item.text);
    }
  }
  for (const item of deliverDueReminders(runtime)) {
    texts.push(item.text);
    printReply(item.route.providerConversationRef, item.text);
  }
  await deliverOutbox(runtime, async (item) => {
    if (!texts.includes(item.text)) printReply(item.route.providerConversationRef, item.text);
    return {};
  });
  return texts;
}

export function demoMessage(
  player: string,
  text: string | undefined,
  photo: boolean,
  scenario: IncomingMessage["verifierScenario"],
): IncomingMessage {
  return {
    channel: "demo",
    projectScope: "demo",
    messageId: crypto.randomUUID(),
    senderId: `demo:${player}`,
    receivedAt: new Date().toISOString(),
    text,
    attachments: photo ? [{ attachmentId: crypto.randomUUID(), bytes: tinyPng(), declaredMimeType: "image/png" }] : [],
    route: { providerConversationRef: `demo:${player}` },
    verifierScenario: scenario,
  };
}

function printReply(who: string, text: string): void {
  stdout.write(`Thaw → ${who}\n${text}\n\n`);
}
