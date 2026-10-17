export type ImageFormat = "jpeg" | "png";

export type ImageInspection =
  | { ok: true; format: ImageFormat; width: number; height: number; stored: Uint8Array }
  | { ok: false; reason: "empty" | "too_large" | "too_many_pixels" | "heic" | "unsupported" | "unreadable"; detail: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function inspectImage(
  bytes: Uint8Array,
  limits: { maxBytes: number; maxPixels: number },
): ImageInspection {
  if (bytes.byteLength === 0) {
    return { ok: false, reason: "empty", detail: "That file was empty." };
  }
  if (bytes.byteLength > limits.maxBytes) {
    return {
      ok: false,
      reason: "too_large",
      detail: `That photo is over the ${Math.round(limits.maxBytes / (1024 * 1024))} MB limit.`,
    };
  }
  if (isHeic(bytes)) {
    return {
      ok: false,
      reason: "heic",
      detail: "That looks like a HEIC photo. Thaw can check JPEG or PNG. In Messages, resend it as a compatible photo or take a screenshot of it.",
    };
  }

  const png = inspectPng(bytes);
  const jpeg = png ? undefined : inspectJpeg(bytes);
  const parsed = png ?? jpeg;
  if (!parsed) {
    return {
      ok: false,
      reason: "unsupported",
      detail: "Thaw could not read that file as a JPEG or PNG.",
    };
  }
  if (parsed.width <= 0 || parsed.height <= 0 || parsed.width * parsed.height > limits.maxPixels) {
    return {
      ok: false,
      reason: "too_many_pixels",
      detail: "That photo is larger than Thaw can check. Send a smaller JPEG or PNG.",
    };
  }
  return { ok: true, format: parsed.format, width: parsed.width, height: parsed.height, stored: parsed.stored };
}

/** 1×1 PNG used by the demo transport and tests. */
export function tinyPng(): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
}

function isHeic(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 64)).toString("latin1");
  return /ftyp(heic|heix|hevc|heif|mif1|msf1)/.test(head);
}

function inspectPng(bytes: Uint8Array): { format: "png"; width: number; height: number; stored: Uint8Array } | undefined {
  if (bytes.byteLength < 8 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return undefined;
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = readU32(bytes, offset);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("latin1");
    const chunkEnd = offset + 12 + length;
    if (length < 0 || chunkEnd > bytes.byteLength) return undefined;
    const chunk = bytes.subarray(offset, chunkEnd);
    if (type === "IHDR") {
      if (length < 8) return undefined;
      width = readU32(bytes, offset + 8);
      height = readU32(bytes, offset + 12);
      sawIhdr = true;
      kept.push(chunk);
    } else if (type === "PLTE" || type === "IDAT" || type === "IEND") {
      kept.push(chunk);
    }
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  if (!sawIhdr) return undefined;
  return { format: "png", width, height, stored: concat(kept) };
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function inspectJpeg(bytes: Uint8Array): { format: "jpeg"; width: number; height: number; stored: Uint8Array } | undefined {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  const out: number[] = [0xff, 0xd8];
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawSof = false;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return undefined;
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) return undefined;
    const marker = bytes[offset]!;
    offset += 1;
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      out.push(0xff, marker);
      for (let index = offset; index < bytes.byteLength; index += 1) out.push(bytes[index]!);
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(0xff, marker);
      continue;
    }
    if (offset + 1 >= bytes.byteLength) return undefined;
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) return undefined;
    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return undefined;
      height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      sawSof = true;
    }
    const drop = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!drop) {
      out.push(0xff, marker);
      for (let index = 0; index < segmentLength; index += 1) out.push(bytes[offset + index]!);
    }
    offset += segmentLength;
  }
  if (!sawSof) return undefined;
  return { format: "jpeg", width, height, stored: Uint8Array.from(out) };
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
