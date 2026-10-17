import type { Runtime } from "../game/engine.ts";
import { confirmLink, issueLinkCode, progressForLinkedUser } from "../game/linking.ts";

const USER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Development stand-in for app auth. The header is not a production credential.
 * It is enabled for demo transport unless THAW_DEV_API=0 is not the switch —
 * photon mode leaves it off unless THAW_DEV_API=1.
 */
export function startApi(runtime: Runtime): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: runtime.config.port,
    hostname: "127.0.0.1",
    fetch(request) {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        return json({
          ok: true,
          transport: runtime.config.transport,
          verifier: runtime.config.verifier,
          devApi: runtime.config.devApi,
        });
      }
      if (!runtime.config.devApi) return json({ error: "not_found" }, 404);
      const appUser = request.headers.get("x-thaw-dev-user");
      if (!appUser || !USER_PATTERN.test(appUser)) return json({ error: "unauthorized" }, 401);

      if (request.method === "GET" && url.pathname === "/api/me/progress") {
        return json(progressForLinkedUser(runtime, appUser));
      }
      if (request.method === "POST" && url.pathname === "/api/me/messaging/link") {
        const issued = issueLinkCode(runtime, appUser);
        return json({
          code: issued.code,
          expiresAt: issued.expiresAt,
          instruction: `Text LINK ${issued.code} to your Thaw iMessage chat, then confirm here.`,
        });
      }
      if (request.method === "GET" && url.pathname === "/api/me/messaging/link-status") {
        const token = runtime.store.pendingLinkForUser(appUser);
        const linked = runtime.store.identityForAppUser(appUser);
        return json({
          pending: token?.state === "pending",
          linked: Boolean(linked),
        });
      }
      if (request.method === "POST" && url.pathname === "/api/me/messaging/link-confirm") {
        return json(confirmLink(runtime, appUser));
      }
      if (request.method === "DELETE" && url.pathname === "/api/me/messaging/link") {
        const linked = runtime.store.identityForAppUser(appUser);
        if (linked) runtime.store.cancelRemindersForPlayer(linked.player_id);
        runtime.store.unlinkAppUser(appUser);
        return json({
          ok: true,
          note: "Future app access is removed. Earned quest history stays on the text conversation. Text START there to keep playing by message.",
        });
      }
      return json({ error: "not_found" }, 404);
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
