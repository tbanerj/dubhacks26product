const COMMAND_WORDS = new Set([
  "stop",
  "help",
  "status",
  "quest",
  "start",
  "cancel",
  "skip",
  "name",
  "phone",
  "email",
  "unsubscribe",
  "location",
  "keep",
  "ping",
  "settings",
  "resume",
  "unlink",
  "collection",
]);

export type ContactKind = "phone" | "email" | "other";

/** A live iMessage sender is a phone or an email. Demo ids such as ada are neither. */
export function contactKind(senderId: string): ContactKind {
  if (senderId.includes("@")) return normalizeEmail(senderId) ? "email" : "other";
  return normalizePhone(senderId) ? "phone" : "other";
}

export function normalizeName(raw: string): string | undefined {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 1 || value.length > 40) return undefined;
  if (COMMAND_WORDS.has(value.toLocaleLowerCase("en-US"))) return undefined;
  if (!/^[\p{L}](?:[\p{L}]|[ '\u2019-]){0,39}$/u.test(value)) return undefined;
  return value;
}

/** Keeps a leading + when the person typed one. Spaces, dashes, and parentheses are dropped. */
export function normalizePhone(raw: string): string | undefined {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return undefined;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeEmail(raw: string): string | undefined {
  const value = raw.trim().toLocaleLowerCase("en-US");
  if (value.length < 3 || value.length > 80) return undefined;
  if (/\s/.test(value)) return undefined;
  const at = value.indexOf("@");
  if (at <= 0 || value.indexOf("@", at + 1) !== -1) return undefined;
  const domain = value.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return undefined;
  return value;
}

export function phoneHint(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-2);
}

export function maskContact(value: string | null | undefined): string {
  if (!value) return "none";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-2)}`;
}
