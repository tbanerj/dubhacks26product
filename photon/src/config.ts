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
  apiHost: string;
  devApi: boolean;
  diagnostics: boolean;
  messagingEnabled: boolean;
  proactiveEnabled: boolean;
  geminiApiKey?: string;
  geminiModel: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseServiceRoleKey?: string;
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
  /** A scheduled prompt older than this is skipped instead of sent late. */
  promptGraceMs: number;
  /** Exact Origin values allowed to call the public text signup route. */
  signupAllowedOrigins: readonly string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const projectId = blank(env.SPECTRUM_PROJECT_ID) ?? blank(env.PROJECT_ID);
  const projectSecret = blank(env.SPECTRUM_PROJECT_SECRET) ?? blank(env.PROJECT_SECRET);
  const transport = parseTransport(env.THAW_TRANSPORT, Boolean(projectId));
  const verifier = parseVerifier(env.THAW_VERIFIER);
  const geminiApiKey = blank(env.GEMINI_API_KEY);

  if (verifier === "live" && !geminiApiKey) {
    throw new Error(
      "THAW_VERIFIER=live needs GEMINI_API_KEY on the server. Live photo checks are not simulated. Set THAW_VERIFIER=demo to run the labeled demo verifier.",
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
    apiHost: parseHost(env.THAW_API_HOST),
    devApi,
    diagnostics: blank(env.THAW_DIAGNOSTICS) === "1",
    messagingEnabled: !isOff(env.MESSAGING_ENABLED),
    proactiveEnabled: blank(env.MESSAGING_PROACTIVE_ENABLED) === "1",
    geminiApiKey,
    geminiModel: blank(env.GEMINI_MODEL) ?? "gemini-3.5-flash-lite",
    supabaseUrl: blank(env.SUPABASE_URL),
    supabasePublishableKey: blank(env.SUPABASE_PUBLISHABLE_KEY),
    supabaseServiceRoleKey: blank(env.SUPABASE_SERVICE_ROLE_KEY),
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
    promptGraceMs: 2 * 60 * 60 * 1000,
    signupAllowedOrigins: parseOrigins(env.THAW_SIGNUP_ALLOWED_ORIGINS),
  };
}

/** Local Vite dev server. Used when THAW_SIGNUP_ALLOWED_ORIGINS is unset. */
export const DEFAULT_SIGNUP_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] as const;

function parseOrigins(value: string | undefined): string[] {
  const raw = blank(value);
  if (!raw) return [...DEFAULT_SIGNUP_ORIGINS];
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 ? origins : [...DEFAULT_SIGNUP_ORIGINS];
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

function parseHost(value: string | undefined): string {
  const raw = blank(value) ?? "127.0.0.1";
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) throw new Error("THAW_API_HOST must be a hostname or IP.");
  return raw;
}

function isOff(value: string | undefined): boolean {
  const raw = blank(value);
  return raw === "0" || raw === "false";
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
