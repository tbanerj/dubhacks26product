export type Command =
  | { type: "START" }
  | { type: "HELP" }
  | { type: "STATUS" }
  | { type: "COLLECTION" }
  | { type: "CANCEL" }
  | { type: "STOP" }
  | { type: "QUEST" }
  | { type: "LOCATION" }
  | { type: "KEEP" }
  | { type: "REMIND"; minutes: number }
  | { type: "LINK"; code: string }
  | { type: "CHOICE"; value: number }
  | { type: "PING" }
  | { type: "SETTINGS" }
  | { type: "RESUME" }
  | { type: "UNLINK" }
  | { type: "REMINDERS"; enabled: boolean }
  | { type: "PAUSE"; days?: number; until?: string }
  | { type: "SCHEDULE"; weekdays?: number[]; time?: string }
  | { type: "NAME"; text: string }
  | { type: "PHONE"; text: string }
  | { type: "EMAIL"; text: string }
  | { type: "TEXT"; text: string };

const READ_ONLY_ALIASES: Record<string, "STATUS" | "QUEST"> = {
  "what am i doing": "STATUS",
  "what am i doing?": "STATUS",
  "give me something quick": "QUEST",
};

const WEEKDAYS: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
};

/** Whole-message commands only. Words inside a sentence or a photo do not run. */
export function parseCommand(text: string | undefined): Command {
  const trimmed = text?.trim().replace(/\s+/g, " ") ?? "";
  if (!trimmed) return { type: "TEXT", text: "" };
  const stripped = trimmed.replace(/[.!?]+$/g, "").trim();
  const upper = stripped.toLocaleUpperCase("en-US");
  const lower = stripped.toLocaleLowerCase("en-US");
  if (upper === "START") return { type: "START" };
  if (upper === "HELP") return { type: "HELP" };
  if (upper === "STATUS") return { type: "STATUS" };
  if (upper === "COLLECTION") return { type: "COLLECTION" };
  if (upper === "CANCEL") return { type: "CANCEL" };
  if (upper === "STOP" || upper === "UNSUBSCRIBE" || lower === "stop texting me") return { type: "STOP" };
  if (upper === "QUEST" || upper === "NEXT") return { type: "QUEST" };
  if (upper === "LOCATION") return { type: "LOCATION" };
  if (upper === "KEEP") return { type: "KEEP" };
  if (upper === "PING") return { type: "PING" };
  if (upper === "SETTINGS") return { type: "SETTINGS" };
  if (upper === "RESUME") return { type: "RESUME" };
  if (upper === "UNLINK") return { type: "UNLINK" };
  if (upper === "REMINDERS ON") return { type: "REMINDERS", enabled: true };
  if (upper === "REMINDERS OFF") return { type: "REMINDERS", enabled: false };
  const pauseDays = /^PAUSE\s+(\d+)\s+DAYS?$/i.exec(stripped);
  if (pauseDays?.[1]) return { type: "PAUSE", days: Number(pauseDays[1]) };
  const pauseUntil = /^PAUSE\s+UNTIL\s+(\d{4}-\d{2}-\d{2})$/i.exec(stripped);
  if (pauseUntil?.[1]) return { type: "PAUSE", until: pauseUntil[1] };
  if (upper === "SCHEDULE" || upper.startsWith("SCHEDULE ")) return parseSchedule(stripped);
  const remind = /^REMIND\s+(\d+)$/i.exec(stripped);
  if (remind?.[1]) return { type: "REMIND", minutes: Number(remind[1]) };
  const link = /^LINK\s+([A-Z0-9]{8})$/i.exec(stripped);
  if (link?.[1]) return { type: "LINK", code: link[1].toLocaleUpperCase("en-US") };
  const named = /^NAME\s+(.+)$/i.exec(stripped);
  if (named?.[1]) return { type: "NAME", text: named[1].trim() };
  const phone = /^PHONE\s+(.+)$/i.exec(stripped);
  if (phone?.[1]) return { type: "PHONE", text: phone[1].trim() };
  const email = /^EMAIL\s+(.+)$/i.exec(stripped);
  if (email?.[1]) return { type: "EMAIL", text: email[1].trim() };
  if (/^[1-9]$/.test(stripped)) return { type: "CHOICE", value: Number(stripped) };
  const alias = READ_ONLY_ALIASES[lower];
  if (alias === "STATUS") return { type: "STATUS" };
  if (alias === "QUEST") return { type: "QUEST" };
  return { type: "TEXT", text: trimmed };
}

function parseSchedule(stripped: string): Command {
  if (stripped.toLocaleUpperCase("en-US") === "SCHEDULE") return { type: "SCHEDULE" };
  const timeMatch = /(\d{1,2}:\d{2})$/.exec(stripped);
  if (!timeMatch?.[1]) return { type: "SCHEDULE" };
  const time = normalizeTime(timeMatch[1]);
  const daysPart = stripped.slice("SCHEDULE".length, stripped.length - timeMatch[1].length).trim();
  const weekdays = parseWeekdays(daysPart);
  if (!time || weekdays.length === 0) return { type: "SCHEDULE" };
  return { type: "SCHEDULE", weekdays, time };
}

function normalizeTime(value: string): string | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2]) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function parseWeekdays(value: string): number[] {
  const parts = value
    .toLocaleLowerCase("en-US")
    .split(/[\s,]+/)
    .filter(Boolean);
  const days = parts.map((part) => WEEKDAYS[part]).filter((day): day is number => day !== undefined);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function isGreeting(text: string): boolean {
  return /^(hi|hey|hello|hiya|yo|start)$/i.test(text.trim());
}
