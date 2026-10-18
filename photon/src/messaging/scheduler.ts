import type { PreferenceRow } from "../db/store.ts";
import type { Runtime } from "../game/engine.ts";
import type { OutboxItem } from "./contracts.ts";
import * as prompts from "../conversation/prompts.ts";

export interface Schedule {
  timeZone: string;
  weekdays: number[];
  localTime: string;
  quietStart: string;
  quietEnd: string;
}

export interface ZonedParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  weekday: number;
}

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function scheduleFromPreference(row: PreferenceRow): Schedule {
  return {
    timeZone: row.timezone,
    weekdays: row.weekdays.split(",").map((part) => Number(part)).filter((day) => day >= 1 && day <= 7),
    localTime: row.local_time,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
  };
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? 0 : Number(pick("hour"));
  return {
    y: Number(pick("year")),
    m: Number(pick("month")),
    d: Number(pick("day")),
    h: hour,
    min: Number(pick("minute")),
    weekday: WEEKDAY[pick("weekday")] ?? 1,
  };
}

/** Returns null when that local clock time does not exist (a DST spring-forward gap). */
export function zonedLocalToUtc(parts: { y: number; m: number; d: number; h: number; min: number }, timeZone: string): Date | null {
  let date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const got = zonedParts(date, timeZone);
    const desired = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min);
    const actual = Date.UTC(got.y, got.m - 1, got.d, got.h, got.min);
    const delta = desired - actual;
    if (delta === 0) {
      const check = zonedParts(date, timeZone);
      if (check.y === parts.y && check.m === parts.m && check.d === parts.d && check.h === parts.h && check.min === parts.min) {
        return date;
      }
      return null;
    }
    date = new Date(date.getTime() + delta);
  }
  const check = zonedParts(date, timeZone);
  if (check.y === parts.y && check.m === parts.m && check.d === parts.d && check.h === parts.h && check.min === parts.min) return date;
  return null;
}

export function isQuiet(instant: Date, schedule: Schedule): boolean {
  const parts = zonedParts(instant, schedule.timeZone);
  const nowMin = parts.h * 60 + parts.min;
  const start = minutes(schedule.quietStart);
  const end = minutes(schedule.quietEnd);
  if (start === end) return false;
  if (start < end) return nowMin >= start && nowMin < end;
  return nowMin >= start || nowMin < end;
}

export function localKey(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.y}-${pad(parts.m)}-${pad(parts.d)}T${pad(parts.h)}:${pad(parts.min)}`;
}

export function localDayKey(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`;
}

export function isoWeekKey(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Next allowed slot strictly after `after`. A missing DST time moves forward to the next valid clock time. */
export function nextPromptInstant(schedule: Schedule, after: Date): Date {
  const start = zonedParts(after, schedule.timeZone);
  const [hour, minute] = schedule.localTime.split(":").map(Number);
  for (let add = 0; add < 21; add += 1) {
    const day = addDays(start, add);
    if (!schedule.weekdays.includes(day.weekday)) continue;
    const instant = resolveLocal(day, hour ?? 16, minute ?? 0, schedule.timeZone);
    if (!instant || instant.getTime() <= after.getTime()) continue;
    if (isQuiet(instant, schedule)) continue;
    return instant;
  }
  return new Date(after.getTime() + 7 * 86_400_000);
}

export function formatInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function promptStillAllowed(runtime: Runtime, conversationId: string): boolean {
  if (!runtime.config.proactiveEnabled || runtime.store.providerBlocked()) return false;
  if (runtime.store.optedOutConversation(conversationId)) return false;
  const conversation = runtime.store.conversationById(conversationId);
  if (!conversation) return false;
  const identity = runtime.store.findIdentityById(conversation.identity_id);
  if (!identity) return false;
  const pref = runtime.store.preferences(identity.player_id);
  if (!pref || pref.reminders_enabled !== 1 || pref.stopped_at) return false;
  if (pref.pause_until && Date.parse(pref.pause_until) > runtime.now().getTime()) return false;
  if (runtime.store.activeAttemptForPlayer(identity.player_id)) return false;
  const schedule = scheduleFromPreference(pref);
  if (isQuiet(runtime.now(), schedule)) return false;
  return true;
}

export function runScheduler(runtime: Runtime): OutboxItem[] {
  if (!runtime.config.proactiveEnabled || runtime.store.providerBlocked()) {
    if (runtime.store.providerBlocked()) {
      console.log(JSON.stringify({ event: "prompts_suppressed", reason: "provider_blocked" }));
    }
    return [];
  }
  const now = runtime.now();
  return runtime.store.transact(() => {
    const replies: OutboxItem[] = [];
    for (const pref of runtime.store.duePreferences(now.toISOString())) {
      const schedule = scheduleFromPreference(pref);
      const dueAt = pref.next_due_at ? Date.parse(pref.next_due_at) : now.getTime();
      const stale = now.getTime() - dueAt > runtime.config.promptGraceMs;
      const paused = pref.pause_until !== null && Date.parse(pref.pause_until) > now.getTime();
      const identity = runtime.store.identityForPlayer(pref.player_id);
      const conversation = identity ? runtime.store.latestConversation(identity.id) : undefined;
      const day = localDayKey(now, pref.timezone);
      const week = isoWeekKey(now, pref.timezone);
      const todayCount = pref.prompts_today === day ? pref.prompts_today_count : 0;
      const weekCount = pref.prompts_week === week ? pref.prompts_week_count : 0;
      const blocked =
        stale ||
        paused ||
        !identity ||
        identity.opted_out === 1 ||
        !conversation ||
        todayCount >= 1 ||
        weekCount >= 3 ||
        Boolean(runtime.store.activeAttemptForPlayer(pref.player_id)) ||
        isQuiet(now, schedule);
      if (blocked) {
        const after = paused && pref.pause_until ? new Date(Math.max(now.getTime(), Date.parse(pref.pause_until))) : now;
        pref.next_due_at = nextPromptInstant(schedule, after).toISOString();
        runtime.store.savePreferences(pref, now.toISOString());
        continue;
      }
      const key = localKey(new Date(dueAt), pref.timezone);
      if (
        !runtime.store.claimOccurrence({
          playerId: pref.player_id,
          scheduleVersion: pref.schedule_version,
          localKey: key,
          dueAt: new Date(dueAt).toISOString(),
          at: now.toISOString(),
        })
      ) {
        pref.next_due_at = nextPromptInstant(schedule, now).toISOString();
        runtime.store.savePreferences(pref, now.toISOString());
        continue;
      }
      const route = {
        providerConversationRef: conversation.provider_conversation_ref,
        servingLine: conversation.serving_line ?? undefined,
      };
      const operationKey = `prompt:${pref.player_id}:${key}`;
      const text = prompts.proactivePrompt();
      if (runtime.store.enqueue({ operationKey, conversationId: conversation.id, route, text, at: now.toISOString(), purpose: "prompt" })) {
        replies.push({ operationKey, conversationId: conversation.id, text, route, purpose: "prompt" });
      }
      pref.prompts_today = day;
      pref.prompts_today_count = todayCount + 1;
      pref.prompts_week = week;
      pref.prompts_week_count = weekCount + 1;
      pref.next_due_at = nextPromptInstant(schedule, now).toISOString();
      runtime.store.savePreferences(pref, now.toISOString());
    }
    return replies;
  });
}

function resolveLocal(day: { y: number; m: number; d: number }, hour: number, minute: number, timeZone: string): Date | null {
  const exact = zonedLocalToUtc({ ...day, h: hour, min: minute }, timeZone);
  if (exact) return exact;
  for (let extra = 1; extra <= 3; extra += 1) {
    const moved = zonedLocalToUtc({ ...day, h: Math.min(23, hour + extra), min: minute }, timeZone);
    if (moved) return moved;
  }
  return null;
}

function addDays(parts: ZonedParts, days: number): ZonedParts {
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  const weekday = date.getUTCDay() || 7;
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), h: 0, min: 0, weekday };
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
