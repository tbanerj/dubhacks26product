/**
 * Thaw settings. Photon credentials stay the names this repo already uses
 * (`PROJECT_ID` / `PROJECT_SECRET`). SPECTRUM_* aliases are accepted too.
 * Values here are application settings, not Photon SDK options.
 */

export type TransportMode = "demo" | "photon";
export type VerifierMode = "demo" | "live";

export interface Config {
  transport: TransportMode;
  verifier: VerifierMode;
  /** Demo CLI may force success / mismatch / unavailable. Live transport never does. */
  allowVerifierScenarios: boolean;
  projectId?: string;
  projectSecret?: string;
  databasePath: string;
  mediaDir: string;
  port: number;
  devApi: boolean;
  maxImageBytes: number;
  maxImagePixels: number;
  mediaRetentionHours: number;
  defaultTimezone: string;
  /** Overdue reminders older than this are dropped instead of sent in a burst. */
  reminderStaleMs: number;
  reminderMinMinutes: number;
  reminderMaxMinutes: number;
  linkCodeTtlMs: number;
  linkMaxFailures: number;
  outboxMaxAttempts: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const projectId = blank(env.SPECTRUM_PROJECT_ID) ?? blank(env.PROJECT_ID);
  const projectSecret = blank(env.SPECTRUM_PROJECT_SECRET) ?? blank(env.PROJECT_SECRET);
  const transport = parseTransport(env.THAW_TRANSPORT, Boolean(projectId));
  const verifier = parseVerifier(env.THAW_VERIFIER);

  if (verifier === "live") {
    throw new Error(
      "THAW_VERIFIER=live is not available. This repository has no verified Perceptron (or other) image API contract, so a live verifier is not wired. Set THAW_VERIFIER=demo. Demo results are labeled as simulated.",
    );
  }
  if (transport === "photon" && (!projectId || !projectSecret)) {
    throw new Error(
      "THAW_TRANSPORT=photon needs PROJECT_ID and PROJECT_SECRET from the Photon dashboard (https://app.photon.codes). A PHOTON_API_KEY does not work with stable Spectrum. Or set THAW_TRANSPORT=demo to run without credentials.",
    );
  }

  const devExplicit = blank(env.THAW_DEV_API);
  const devApi = devExplicit ? devExplicit === "1" : transport === "demo";

  return {
    transport,
    verifier,
    allowVerifierScenarios: transport === "demo",
    projectId,
    projectSecret,
    databasePath: blank(env.THAW_DATABASE_PATH) ?? "data/thaw.sqlite",
    mediaDir: blank(env.THAW_MEDIA_DIR) ?? "data/media",
    port: parsePositiveInt(env.PORT, 3001),
    devApi,
    maxImageBytes: parsePositiveInt(env.THAW_MAX_IMAGE_BYTES, 10_485_760),
    maxImagePixels: parsePositiveInt(env.THAW_MAX_IMAGE_PIXELS, 20_000_000),
    mediaRetentionHours: parsePositiveInt(env.THAW_MEDIA_RETENTION_HOURS, 24),
    defaultTimezone: blank(env.THAW_DEFAULT_TIMEZONE) ?? "America/Los_Angeles",
    reminderStaleMs: 6 * 60 * 60 * 1000,
    reminderMinMinutes: 1,
    reminderMaxMinutes: 180,
    linkCodeTtlMs: 10 * 60 * 1000,
    linkMaxFailures: 5,
    outboxMaxAttempts: 5,
  };
}

function parseTransport(value: string | undefined, hasProject: boolean): TransportMode {
  const raw = blank(value);
  if (!raw) return hasProject ? "photon" : "demo";
  if (raw === "demo" || raw === "photon") return raw;
  throw new Error("THAW_TRANSPORT must be demo or photon.");
}

function parseVerifier(value: string | undefined): VerifierMode {
  const raw = blank(value) ?? "demo";
  if (raw === "demo" || raw === "live") return raw;
  throw new Error("THAW_VERIFIER must be demo or live.");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const raw = blank(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${raw}.`);
  }
  return parsed;
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
