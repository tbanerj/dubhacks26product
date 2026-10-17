import type { Runtime } from "../game/engine.ts";
import type { OutboxItem } from "./contracts.ts";

export async function deliverOutbox(
  runtime: Runtime,
  send: (item: OutboxItem) => Promise<{ providerMessageId?: string } | undefined>,
): Promise<void> {
  for (const item of runtime.store.pendingOutbox()) {
    if (item.attempts >= runtime.config.outboxMaxAttempts) {
      runtime.store.markOutbox(item.operationKey, "failed", undefined, "attempt_limit");
      continue;
    }
    if (runtime.store.optedOutConversation(item.conversationId)) {
      runtime.store.markOutbox(item.operationKey, "suppressed", undefined, "opt_out");
      continue;
    }
    try {
      const sent = await send(item);
      runtime.store.markOutbox(item.operationKey, "sent", sent?.providerMessageId);
    } catch (error) {
      const category = errorCategory(error);
      const unknown = category === "timeout" || category === "network";
      runtime.store.markOutbox(item.operationKey, unknown ? "delivery_unknown" : "failed", undefined, category);
      console.log(JSON.stringify({ event: "outbox_error", operationKey: item.operationKey, category }));
    }
  }
}

function errorCategory(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout")) return "timeout";
  if (message.includes("network") || message.includes("unavailable")) return "network";
  if (message.includes("auth") || message.includes("permission")) return "auth";
  return "send_failed";
}
