import { imessage } from "@spectrum-ts/imessage";
import { Spectrum } from "spectrum-ts";
import { loadConfig } from "../config.ts";

/**
 * Prints which settings are present and, when Spectrum credentials exist,
 * opens and closes a Cloud connection. Values are never printed.
 */
const config = loadConfig({ ...process.env, THAW_VERIFIER: process.env.THAW_VERIFIER === "live" ? "live" : "demo" });
const present = {
  PROJECT_ID: Boolean(config.projectId),
  PROJECT_SECRET: Boolean(config.projectSecret),
  GEMINI_API_KEY: Boolean(config.geminiApiKey),
  SUPABASE_URL: Boolean(config.supabaseUrl),
  SUPABASE_PUBLISHABLE_KEY: Boolean(config.supabasePublishableKey),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(config.supabaseServiceRoleKey),
};

console.log(
  JSON.stringify({
    event: "doctor_config",
    transport: config.transport,
    verifier: config.verifier,
    apiHost: config.apiHost,
    port: config.port,
    diagnostics: config.diagnostics,
    proactive: config.proactiveEnabled,
    present,
  }),
);

if (!config.projectId || !config.projectSecret) {
  console.log(
    JSON.stringify({
      event: "doctor_blocked",
      reason: "Add PROJECT_ID and PROJECT_SECRET from the Photon project settings. Do not put them in the Expo app.",
    }),
  );
  process.exit(0);
}

try {
  const app = await Spectrum({
    projectId: config.projectId,
    projectSecret: config.projectSecret,
    providers: [imessage.config()],
  });
  console.log(JSON.stringify({ event: "doctor_ready", connected: true, sdk: "spectrum-ts" }));
  await app.stop();
} catch (error) {
  const message = error instanceof Error ? error.message : "error";
  const safe = message.replace(/[A-Za-z0-9_+/=-]{12,}/g, "[redacted]").slice(0, 180);
  console.log(JSON.stringify({ event: "doctor_failed", category: error instanceof Error ? error.name : "error", message: safe }));
  process.exit(1);
}
