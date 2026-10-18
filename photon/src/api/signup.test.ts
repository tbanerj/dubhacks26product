import { describe, expect, test } from "bun:test";
import { loadConfig } from "../config.ts";
import { createSignupLimiter, normalizePhone, publicSignupResponse } from "./signup.ts";

const ORIGIN = "http://localhost:5173";

describe("normalizePhone", () => {
  test("accepts a US number with punctuation, with or without the country code", () => {
    expect(normalizePhone("+1 (206) 555-0123")).toBe("+12065550123");
    expect(normalizePhone("2065550123")).toBe("+12065550123");
    expect(normalizePhone("1-206-555-0123")).toBe("+12065550123");
  });

  test("keeps an international number that already includes +", () => {
    expect(normalizePhone("+442071234567")).toBe("+442071234567");
  });

  test("rejects numbers that are not E.164", () => {
    expect(normalizePhone("555-0123")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("public signup", () => {
  test("registers a Free-plan shared user and returns the assigned line", async () => {
    const seen: { url?: string; body?: unknown; authorization?: string } = {};
    const response = await publicSignupResponse(signupRequest({ phone: "(206) 555-0123" }), photonConfig(), {
      clientKey: "203.0.113.5",
      limiter: createSignupLimiter(),
      fetchImpl: async (input, init) => {
        seen.url = String(input);
        seen.authorization = new Headers(init?.headers).get("authorization") ?? undefined;
        seen.body = JSON.parse(String(init?.body));
        return Response.json({
          succeed: true,
          data: {
            id: "user-1",
            projectId: "7d9e5221-e3cb-447f-baef-36b3c3c46695",
            type: "shared",
            firstName: null,
            lastName: null,
            email: null,
            phoneNumber: "+12065550123",
            assignedPhoneNumber: "+15557654321",
            meta: null,
            createdAt: "2026-10-17T00:00:00.000Z",
          },
        });
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assignedPhoneNumber: "+15557654321" });
    expect(seen.url).toBe("https://spectrum.photon.codes/projects/7d9e5221-e3cb-447f-baef-36b3c3c46695/users/");
    expect(seen.body).toEqual({ type: "shared", phoneNumber: "+12065550123" });
    expect(seen.authorization?.startsWith("Basic ")).toBe(true);
  });

  test("does not call Spectrum in demo mode", async () => {
    let called = false;
    const response = await publicSignupResponse(signupRequest(), demoConfig(), {
      clientKey: "203.0.113.6",
      limiter: createSignupLimiter(),
      fetchImpl: async () => {
        called = true;
        return new Response("nope", { status: 500 });
      },
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "signup_unavailable" });
    expect(called).toBe(false);
  });

  test("hides a Spectrum failure", async () => {
    const response = await publicSignupResponse(signupRequest(), photonConfig(), {
      clientKey: "203.0.113.7",
      limiter: createSignupLimiter(),
      fetchImpl: async () => new Response("full", { status: 403 }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "signup_unavailable" });
  });

  test("requires age, consent, a usable number, and an allowed origin", async () => {
    const limiter = createSignupLimiter();
    const deps = { clientKey: "203.0.113.8", limiter, fetchImpl: unusedFetch };
    expect((await publicSignupResponse(signupRequest({ ageConfirmed: false }), photonConfig(), deps)).status).toBe(400);
    expect(await (await publicSignupResponse(signupRequest({ consent: false }), photonConfig(), deps)).json()).toEqual({
      error: "consent_required",
    });
    expect(await (await publicSignupResponse(signupRequest({ phone: "123" }), photonConfig(), deps)).json()).toEqual({
      error: "invalid_request",
    });
    const foreign = signupRequest();
    foreign.headers.set("origin", "https://evil.example");
    expect(await (await publicSignupResponse(foreign, photonConfig(), deps)).json()).toEqual({
      error: "origin_not_allowed",
    });
  });

  test("stops a sixth attempt from the same address inside the window", async () => {
    let now = 1_000;
    const limiter = createSignupLimiter();
    const deps = { clientKey: "203.0.113.9", limiter, now: () => now, fetchImpl: unusedFetch };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await publicSignupResponse(signupRequest({ phone: "nope" }), photonConfig(), deps);
      expect(response.status).toBe(400);
    }
    const blocked = await publicSignupResponse(signupRequest(), photonConfig(), deps);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    now += 10 * 60 * 1000;
    const again = await publicSignupResponse(signupRequest({ phone: "nope" }), photonConfig(), deps);
    expect(again.status).toBe(400);
  });
});

function signupRequest(overrides: { phone?: string; ageConfirmed?: boolean; consent?: boolean } = {}): Request {
  return new Request("http://127.0.0.1:3001/api/public/signup", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      phone: overrides.phone ?? "+1 206 555 0123",
      ageConfirmed: overrides.ageConfirmed ?? true,
      consent: overrides.consent ?? true,
    }),
  });
}

function photonConfig() {
  return loadConfig({
    PROJECT_ID: "7d9e5221-e3cb-447f-baef-36b3c3c46695",
    PROJECT_SECRET: "test-secret",
    THAW_TRANSPORT: "photon",
    THAW_VERIFIER: "demo",
  });
}

function demoConfig() {
  return loadConfig({ THAW_TRANSPORT: "demo", THAW_VERIFIER: "demo" });
}

const unusedFetch = async () => {
  throw new Error("Spectrum should not be called");
};
