import type { Config } from "../config.ts";

const E164 = /^\+[1-9]\d{6,14}$/;
const PROJECT_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SPECTRUM_ORIGIN = "https://spectrum.photon.codes";

export type SignupError =
  | "age_confirmation_required"
  | "consent_required"
  | "invalid_request"
  | "rate_limited"
  | "signup_unavailable"
  | "origin_not_allowed";

export interface SignupLimiter {
  allow(key: string, now: number): boolean;
}

type SignupFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createSignupLimiter(windowMs = WINDOW_MS, max = MAX_ATTEMPTS): SignupLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key, now) {
      const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/**
 * US numbers may omit the country code. Anything else must already include +.
 * Returns E.164 or null. This does not guess a timezone from the number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  let e164: string;
  if (trimmed.startsWith("+")) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    e164 = `+${digits}`;
  } else {
    return null;
  }
  return E164.test(e164) ? e164 : null;
}

export function publicSignupResponse(
  request: Request,
  config: Pick<Config, "transport" | "projectId" | "projectSecret" | "signupAllowedOrigins">,
  deps: {
    clientKey: string;
    limiter: SignupLimiter;
    now?: () => number;
    fetchImpl?: SignupFetch;
  },
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl ?? fetch;
  return handleSignup(request, config, { ...deps, now, fetchImpl });
}

async function handleSignup(
  request: Request,
  config: Pick<Config, "transport" | "projectId" | "projectSecret" | "signupAllowedOrigins">,
  deps: {
    clientKey: string;
    limiter: SignupLimiter;
    now: () => number;
    fetchImpl: SignupFetch;
  },
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || !config.signupAllowedOrigins.includes(origin)) {
    return signupJson({ error: "origin_not_allowed" }, 403);
  }
  if (!deps.limiter.allow(deps.clientKey, deps.now())) {
    return signupJson({ error: "rate_limited" }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return signupJson({ error: "invalid_request" }, 400);
  }
  if (!payload || typeof payload !== "object") return signupJson({ error: "invalid_request" }, 400);
  const body = payload as { phone?: unknown; ageConfirmed?: unknown; consent?: unknown };
  if (body.ageConfirmed !== true) return signupJson({ error: "age_confirmation_required" }, 400);
  if (body.consent !== true) return signupJson({ error: "consent_required" }, 400);
  if (typeof body.phone !== "string") return signupJson({ error: "invalid_request" }, 400);
  const phone = normalizePhone(body.phone);
  if (!phone) return signupJson({ error: "invalid_request" }, 400);

  const assigned = await registerSharedUser(config, phone, deps.fetchImpl);
  if (!assigned) return signupJson({ error: "signup_unavailable" }, 503);
  return signupJson({ assignedPhoneNumber: assigned }, 200);
}

/**
 * Free and Pro plans message through a shared number pool. A shared line only
 * replies to phones registered as project users. `type: "shared"` is that
 * registration. Dedicated lines are a Business feature and are not used here.
 * Spectrum assigns the serving number; this service does not choose or store it.
 */
async function registerSharedUser(
  config: Pick<Config, "transport" | "projectId" | "projectSecret">,
  phone: string,
  fetchImpl: SignupFetch,
): Promise<string | null> {
  const projectId = config.projectId;
  const projectSecret = config.projectSecret;
  if (config.transport !== "photon" || !projectId || !projectSecret || !PROJECT_ID_PATTERN.test(projectId)) {
    return null;
  }
  const url = `${SPECTRUM_ORIGIN}/projects/${projectId}/users/`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: {
        authorization: `Basic ${btoa(`${projectId}:${projectSecret}`)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "shared", phoneNumber: phone }),
    });
  } catch (error) {
    console.log(JSON.stringify({ event: "signup_unavailable", category: error instanceof Error ? error.name : "error" }));
    return null;
  }
  if (!response.ok) {
    console.log(JSON.stringify({ event: "signup_unavailable", status: response.status }));
    return null;
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.log(JSON.stringify({ event: "signup_unavailable", category: "invalid_json" }));
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { succeed?: unknown; data?: unknown }).data;
  const succeed = (payload as { succeed?: unknown }).succeed;
  if (succeed !== true || !data || typeof data !== "object") return null;
  const assigned = (data as { assignedPhoneNumber?: unknown }).assignedPhoneNumber;
  if (typeof assigned !== "string" || !E164.test(assigned)) return null;
  console.log(JSON.stringify({ event: "signup_registered" }));
  return assigned;
}

function signupJson(body: { error: SignupError } | { assignedPhoneNumber: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
