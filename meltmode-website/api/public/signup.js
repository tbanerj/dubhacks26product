/**
 * Same-origin signup proxy for the Vercel site.
 *
 * The page posts to /api/public/signup. This forwards that body to the local
 * Photon process through PHOTON_SIGNUP_URL (the tunnel URL, including the path).
 * The browser Origin is forwarded so Photon's allowlist can accept the Vercel site.
 * Photon credentials stay on the machine running `bun start`.
 */

const SIGNUP_UNAVAILABLE = { error: "signup_unavailable" };

export const maxDuration = 20;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "invalid_request" });
    return;
  }

  const target = signupUrl();
  if (!target) {
    response.status(503).json(SIGNUP_UNAVAILABLE);
    return;
  }

  const origin = headerValue(request.headers.origin);
  try {
    const upstream = await fetch(target, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: bodyText(request.body),
    });
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    );
    response.send(text);
  } catch {
    response.status(503).json(SIGNUP_UNAVAILABLE);
  }
}

function signupUrl() {
  const raw = process.env.PHOTON_SIGNUP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function headerValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

function bodyText(body) {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  return JSON.stringify(body);
}
