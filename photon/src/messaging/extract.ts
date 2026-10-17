import type { IncomingAttachment } from "./contracts.ts";

interface LooseContent {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  read?: () => Promise<Uint8Array>;
  items?: Array<{ content?: LooseContent }>;
  content?: LooseContent;
}

/** Pull text and images out of a Spectrum content tree without importing the SDK. */
export async function extractContent(content: unknown, maxBytes: number): Promise<{ text?: string; attachments: IncomingAttachment[] }> {
  const texts: string[] = [];
  const attachments: IncomingAttachment[] = [];
  const loose = asLoose(content);
  if (loose) await walk(loose, texts, attachments, maxBytes, 0);
  const text = texts.map((item) => item.trim()).filter(Boolean).join("\n");
  return { text: text || undefined, attachments };
}

function asLoose(value: unknown): LooseContent | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as LooseContent;
}

async function walk(
  content: LooseContent,
  texts: string[],
  attachments: IncomingAttachment[],
  maxBytes: number,
  depth: number,
): Promise<void> {
  if (depth > 5 || !content.type) return;
  if (content.type === "text" && content.text) texts.push(content.text);
  if (content.type === "attachment") {
    attachments.push(await readAttachment(content, maxBytes));
  }
  if (content.type === "effect" && content.content) await walk(content.content, texts, attachments, maxBytes, depth + 1);
  if (content.type === "reply" && content.content) await walk(content.content, texts, attachments, maxBytes, depth + 1);
  if (content.type === "group" && content.items) {
    for (const item of content.items) {
      if (item.content) await walk(item.content, texts, attachments, maxBytes, depth + 1);
    }
  }
}

async function readAttachment(content: LooseContent, maxBytes: number): Promise<IncomingAttachment> {
  const base = {
    attachmentId: content.id ?? crypto.randomUUID(),
    declaredMimeType: content.mimeType,
    declaredSizeBytes: content.size,
    originalName: content.name,
  };
  if (typeof content.size === "number" && content.size > maxBytes) {
    return { ...base, rejected: "too_large" };
  }
  if (!content.read) return { ...base, rejected: "unreadable" };
  try {
    const bytes = new Uint8Array(await content.read());
    if (bytes.byteLength > maxBytes) return { ...base, rejected: "too_large" };
    return { ...base, bytes };
  } catch {
    return { ...base, rejected: "unreadable" };
  }
}
