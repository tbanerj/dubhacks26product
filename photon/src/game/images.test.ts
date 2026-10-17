import { describe, expect, test } from "bun:test";
import { inspectImage, tinyPng } from "./images.ts";

const limits = { maxBytes: 1024, maxPixels: 100 };

describe("image inspection", () => {
  test("reads a png and drops extra chunks", () => {
    const png = tinyPng();
    const result = inspectImage(png, { maxBytes: 10_000, maxPixels: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.format).toBe("png");
    }
  });

  test("strips jpeg comment metadata and reads the frame size", () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xfe, 0x00, 0x08, 0x45, 0x58, 0x49, 0x46, 0x54, 0x45,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xd9,
    ]);
    const result = inspectImage(jpeg, { maxBytes: 10_000, maxPixels: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(3);
      expect(result.height).toBe(2);
      expect(Buffer.from(result.stored).includes("EXIFTE")).toBe(false);
    }
  });

  test("rejects heic, empty, and huge frames", () => {
    expect(inspectImage(new Uint8Array(), limits).ok).toBe(false);
    expect(inspectImage(Buffer.from("xxxxftypheic"), limits).ok).toBe(false);
    const wide = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x64, 0x00, 0x64, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xd9,
    ]);
    const result = inspectImage(wide, limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_many_pixels");
  });
});
