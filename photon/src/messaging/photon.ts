import { imessage } from "@spectrum-ts/imessage";
import { Spectrum } from "spectrum-ts";
import type { Runtime } from "../game/engine.ts";
import { deliverDueReminders, settleSubmission, stageIncoming } from "../game/engine.ts";
import { cleanupExpiredMedia } from "../jobs/retention.ts";
import type { IncomingMessage, OutboxItem } from "./contracts.ts";
import { deliverOutbox } from "./deliver.ts";
import { extractContent } from "./extract.ts";

/**
 * Stable Spectrum Cloud iMessage. This is the only live transport.
 * Group chats are ignored. Exact locations of other players are never read or sent.
 */
export async function runPhoton(runtime: Runtime): Promise<void> {
  if (!runtime.config.projectId || !runtime.config.projectSecret) {
    throw new Error("Photon transport is missing PROJECT_ID or PROJECT_SECRET.");
  }
  const app = await Spectrum({
    projectId: runtime.config.projectId,
    projectSecret: runtime.config.projectSecret,
    providers: [imessage.config()],
  });
  const platform = imessage(app);
  console.log(JSON.stringify({ event: "photon_ready", transport: "photon", verifier: runtime.config.verifier }));

  const sendItem = async (item: OutboxItem) => {
    const params = item.route.servingLine ? { phone: item.route.servingLine } : undefined;
    const space = await platform.space.get(item.route.providerConversationRef, params);
    const sent = await space.send(item.text);
    return { providerMessageId: sent?.id };
  };

  await deliverOutbox(runtime, sendItem);
  const timer = setInterval(() => {
    deliverDueReminders(runtime);
    cleanupExpiredMedia(runtime);
    void deliverOutbox(runtime, sendItem);
  }, 15_000);

  const shutdown = async () => {
    clearInterval(timer);
    await app.stop();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

  try {
    for await (const [space, message] of app.messages) {
      if (message.direction === "outbound") continue;
      const senderId = message.sender?.id;
      if (!senderId || message.sender?.kind === "agent") continue;
      if ("type" in space && space.type === "group") {
        console.log(JSON.stringify({ event: "ignored_group", spaceId: space.id }));
        continue;
      }
      const extracted = await extractContent(message.content, runtime.config.maxImageBytes);
      const servingLine = "phone" in space && typeof space.phone === "string" ? space.phone : undefined;
      const incoming: IncomingMessage = {
        channel: "imessage",
        projectScope: runtime.config.projectId,
        messageId: message.id,
        senderId,
        receivedAt: message.timestamp.toISOString(),
        text: extracted.text,
        attachments: extracted.attachments,
        route: { providerConversationRef: space.id, servingLine },
      };
      console.log(JSON.stringify({ event: "inbound", messageId: message.id, attachments: extracted.attachments.length }));
      const staged = stageIncoming(runtime, incoming);
      if (staged.submissionId) settleSubmission(runtime, staged.submissionId, undefined);
      await deliverOutbox(runtime, sendItem);
    }
  } finally {
    clearInterval(timer);
  }
}
