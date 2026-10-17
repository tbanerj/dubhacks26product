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
  | { type: "TEXT"; text: string };

const READ_ONLY_ALIASES: Record<string, "STATUS" | "QUEST"> = {
  "what am i doing": "STATUS",
  "what am i doing?": "STATUS",
  "give me something quick": "QUEST",
};

/** Whole-message commands only. Words inside a sentence or a photo do not run. */
export function parseCommand(text: string | undefined): Command {
  const trimmed = text?.trim().replace(/\s+/g, " ") ?? "";
  if (!trimmed) return { type: "TEXT", text: "" };
  const upper = trimmed.toLocaleUpperCase("en-US");
  if (upper === "START") return { type: "START" };
  if (upper === "HELP") return { type: "HELP" };
  if (upper === "STATUS") return { type: "STATUS" };
  if (upper === "COLLECTION") return { type: "COLLECTION" };
  if (upper === "CANCEL") return { type: "CANCEL" };
  if (upper === "STOP") return { type: "STOP" };
  if (upper === "QUEST" || upper === "NEXT") return { type: "QUEST" };
  if (upper === "LOCATION") return { type: "LOCATION" };
  if (upper === "KEEP") return { type: "KEEP" };
  const remind = /^REMIND\s+(\d+)$/i.exec(trimmed);
  if (remind?.[1]) return { type: "REMIND", minutes: Number(remind[1]) };
  const link = /^LINK\s+([A-Z0-9]{8})$/i.exec(trimmed);
  if (link?.[1]) return { type: "LINK", code: link[1].toLocaleUpperCase("en-US") };
  if (/^[1-9]$/.test(trimmed)) return { type: "CHOICE", value: Number(trimmed) };
  const alias = READ_ONLY_ALIASES[trimmed.toLocaleLowerCase("en-US")];
  if (alias === "STATUS") return { type: "STATUS" };
  if (alias === "QUEST") return { type: "QUEST" };
  return { type: "TEXT", text: trimmed };
}

export function isGreeting(text: string): boolean {
  return /^(hi|hey|hello|hiya|yo|start)$/i.test(text.trim());
}
