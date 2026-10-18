import type { Runtime } from "../game/engine.ts";
import { maskSender } from "../game/engine.ts";
import { confirmLink, issueLinkCode, progressForLinkedUser } from "../game/linking.ts";
import { syncPendingRewards } from "../game/sync.ts";
import { nextPromptInstant, scheduleFromPreference } from "../messaging/scheduler.ts";
import * as prompts from "../conversation/prompts.ts";

const USER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * App routes accept a Supabase access token. The dev header remains for local tests
 * when THAW_DEV_API=1. It is not a production credential.
 */
export function startApi(runtime: Runtime): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: runtime.config.port,
    hostname: runtime.config.apiHost,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
      if (request.method === "GET" && url.pathname === "/ready") {
        return json({
          ok: true,
          transport: runtime.config.transport,
          verifier: runtime.config.verifier,
          devApi: runtime.config.devApi,
          proactive: runtime.config.proactiveEnabled,
          providerBlocked: runtime.store.providerBlocked(),
        });
      }
      const appUser = await resolveUser(runtime, request);
      if (!appUser) return json({ error: "unauthorized" }, 401);

      if (request.method === "GET" && (url.pathname === "/api/me/progress" || url.pathname === "/api/me/messaging")) {
        return json(messagingView(runtime, appUser));
      }
      if (request.method === "POST" && (url.pathname === "/api/me/messaging/link" || url.pathname === "/api/me/messaging/link-token")) {
        const issued = issueLinkCode(runtime, appUser);
        return json({
          code: issued.code,
          expiresAt: issued.expiresAt,
          instruction: `Text LINK ${issued.code} to the Thaw chat for your registered iMessage user, then confirm here. The number can differ by recipient.`,
        });
      }
      if (request.method === "GET" && url.pathname === "/api/me/messaging/link-status") {
        const token = runtime.store.pendingLinkForUser(appUser);
        const linked = runtime.store.identityForAppUser(appUser);
        return json({ pending: token?.state === "pending", linked: Boolean(linked) });
      }
      if (request.method === "POST" && url.pathname === "/api/me/messaging/link-confirm") {
        const confirmed = confirmLink(runtime, appUser);
        if (confirmed.ok) await syncPendingRewards(runtime);
        return json(confirmed);
      }
      if (request.method === "DELETE" && url.pathname === "/api/me/messaging/link") {
        const linked = runtime.store.identityForAppUser(appUser);
        if (linked) {
          runtime.store.cancelRemindersForPlayer(linked.player_id);
          runtime.store.suppressPrompts(linked.player_id);
          const prefs = runtime.store.ensurePreferences(linked.player_id, linked.timezone, runtime.now().toISOString());
          prefs.reminders_enabled = 0;
          prefs.next_due_at = null;
          runtime.store.savePreferences(prefs, runtime.now().toISOString());
        }
        runtime.store.unlinkAppUser(appUser);
        return json({
          ok: true,
          note: "Future app access is removed. Earned quest history stays on the text conversation. Text START there to keep playing by message.",
        });
      }
      if (request.method === "PATCH" && url.pathname === "/api/me/messaging/preferences") {
        const identity = runtime.store.identityForAppUser(appUser);
        if (!identity) return json({ error: "Link Messages before changing reminders." }, 409);
        const body = await readJson(request);
        const saved = applyPreferences(runtime, identity.player_id, identity.timezone, body);
        if ("error" in saved) return json(saved, 400);
        return json(messagingView(runtime, appUser));
      }
      return json({ error: "not_found" }, 404);
    },
  });
}

function messagingView(runtime: Runtime, appUser: string) {
  const progress = progressForLinkedUser(runtime, appUser);
  const identity = runtime.store.identityForAppUser(appUser);
  const prefs = identity ? runtime.store.preferences(identity.player_id) : undefined;
  const conversation = identity ? runtime.store.latestConversation(identity.id) : undefined;
  return {
    ...progress,
    maskedSender: identity ? maskSender(identity.sender_id) : null,
    servingLineHint: conversation?.serving_line ? `••••${conversation.serving_line.slice(-2)}` : null,
    preferences: prefs
      ? {
          remindersEnabled: prefs.reminders_enabled === 1,
          timezone: prefs.timezone,
          weekdays: prefs.weekdays,
          weekdayLabel: prompts.weekdayLabel(prefs.weekdays),
          localTime: prefs.local_time,
          quietStart: prefs.quiet_start,
          quietEnd: prefs.quiet_end,
          pauseUntil: prefs.pause_until,
          stopped: Boolean(prefs.stopped_at) || identity?.opted_out === 1,
          nextDueAt: prefs.next_due_at,
        }
      : null,
    proactiveEnabled: runtime.config.proactiveEnabled,
  };
}

function applyPreferences(
  runtime: Runtime,
  playerId: string,
  fallbackTimezone: string,
  body: Record<string, unknown>,
): { ok: true } | { error: string } {
  const at = runtime.now().toISOString();
  const prefs = runtime.store.ensurePreferences(playerId, fallbackTimezone, at);
  if (typeof body.timezone === "string") {
    if (!isTimeZone(body.timezone)) return { error: "Timezone must be an IANA name." };
    prefs.timezone = body.timezone;
  }
  if (typeof body.localTime === "string" && /^\d{2}:\d{2}$/.test(body.localTime)) prefs.local_time = body.localTime;
  if (typeof body.quietStart === "string" && /^\d{2}:\d{2}$/.test(body.quietStart)) prefs.quiet_start = body.quietStart;
  if (typeof body.quietEnd === "string" && /^\d{2}:\d{2}$/.test(body.quietEnd)) prefs.quiet_end = body.quietEnd;
  if (Array.isArray(body.weekdays)) {
    const days = body.weekdays.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7);
    if (days.length === 0) return { error: "Pick at least one weekday." };
    prefs.weekdays = [...new Set(days)].sort((a, b) => a - b).join(",");
    prefs.schedule_version += 1;
    runtime.store.cancelStaleOccurrences(playerId, prefs.schedule_version);
  }
  if (body.remindersEnabled === true) {
    prefs.reminders_enabled = 1;
    prefs.stopped_at = null;
    prefs.next_due_at = nextPromptInstant(scheduleFromPreference(prefs), runtime.now()).toISOString();
  } else if (body.remindersEnabled === false) {
    prefs.reminders_enabled = 0;
    prefs.next_due_at = null;
    runtime.store.suppressPrompts(playerId);
  }
  if (body.resume === true) prefs.pause_until = null;
  if (typeof body.pauseDays === "number" && body.pauseDays >= 1 && body.pauseDays <= 30) {
    prefs.pause_until = new Date(runtime.now().getTime() + body.pauseDays * 86_400_000).toISOString();
    runtime.store.suppressPrompts(playerId);
  }
  if (prefs.reminders_enabled === 1 && prefs.pause_until && Date.parse(prefs.pause_until) > runtime.now().getTime()) {
    prefs.next_due_at = nextPromptInstant(scheduleFromPreference(prefs), new Date(prefs.pause_until)).toISOString();
  }
  runtime.store.savePreferences(prefs, at);
  return { ok: true };
}

async function resolveUser(runtime: Runtime, request: Request): Promise<string | null> {
  if (runtime.config.devApi) {
    const header = request.headers.get("x-thaw-dev-user");
    if (header && USER_PATTERN.test(header)) return header;
  }
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  const url = runtime.config.supabaseUrl;
  const key = runtime.config.supabasePublishableKey;
  if (!token || !url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    if (!body.id || !USER_PATTERN.test(body.id)) return null;
    return body.id;
  } catch {
    return null;
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
