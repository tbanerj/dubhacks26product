/**
 * Photo-evidence verification.
 *
 * Live mode: Perceptron's chat-completions API (POST {baseUrl}/chat/completions,
 * `Authorization: Bearer <key>`, OpenAI-style `image_url` + `text` content parts),
 * per docs.perceptron.inc. Model defaults to `perceptron-mk1.5`.
 *
 * Demo mode: a transparent mock that does NOT look at the photo. The UI says so.
 * In demo mode photos never leave the device.
 *
 * Production note: Perceptron keys must stay secret, so a shipped app should send
 * evidence to your backend, which calls Perceptron. EXPO_PUBLIC_* keys are for demos.
 */
import { z } from 'zod';
import type { Quest, VerificationResult } from '../types';
import { config } from '../config/env';

export interface EvidenceImage {
  uri: string;
  base64: string | null;
  mimeType: string;
}

export interface VerifyRequest {
  quest: Quest;
  landmarkName: string;
  image: EvidenceImage;
}

export interface VerifyOptions {
  /** Demo only: lets the judge rehearse the rejection + retry path. */
  demoOutcome?: 'accept' | 'reject';
  timeoutMs?: number;
}

export type VerifyError = { kind: 'network' | 'timeout' | 'server' | 'bad-response' | 'no-image'; message: string };
export type VerifyResponse = { ok: true; result: VerificationResult } | { ok: false; error: VerifyError };

export function isPerceptronConfigured(): boolean {
  return config.perceptron.apiKey !== null;
}

const VerdictSchema = z.object({
  match: z.boolean(),
  confidence: z.number().min(0).max(1),
  observations: z.string().max(400),
  feedback: z.string().max(300),
});

function buildPrompt(req: VerifyRequest): string {
  return [
    'You are verifying photo evidence for a friendly real-world exploration game.',
    `Quest: "${req.quest.title}" at ${req.landmarkName}.`,
    `Evidence requirement: ${req.quest.evidence}`,
    'Look at the image and decide whether it plausibly satisfies the evidence requirement.',
    'Be generous with creative interpretations. Do not identify any people.',
    'Reply with ONLY a JSON object: {"match": boolean, "confidence": number 0-1, "observations": short description of what is visible, "feedback": one encouraging sentence to the player}.',
  ].join('\n');
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

interface ChatCompletion {
  choices?: { message?: { content?: string | { type: string; text?: string }[] } }[];
}

async function verifyLive(req: VerifyRequest, timeoutMs: number): Promise<VerifyResponse> {
  if (!req.image.base64) return { ok: false, error: { kind: 'no-image', message: 'The photo could not be read for upload.' } };
  const { apiKey, baseUrl, model } = config.perceptron;

  const attempt = async (): Promise<VerifyResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_completion_tokens: 400,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
                { type: 'text', text: buildPrompt(req) },
              ],
            },
          ],
        }),
      });
      if (res.status >= 500) return { ok: false, error: { kind: 'server', message: `Verifier error (${res.status}).` } };
      if (!res.ok) return { ok: false, error: { kind: 'server', message: `Verifier rejected the request (${res.status}).` } };
      const json = (await res.json()) as ChatCompletion;
      const content = json.choices?.[0]?.message?.content;
      const text = typeof content === 'string' ? content : (content ?? []).map((p) => p.text ?? '').join('');
      const verdict = VerdictSchema.safeParse(extractJson(text));
      if (!verdict.success) return { ok: false, error: { kind: 'bad-response', message: 'The verifier’s answer was unreadable.' } };
      const accepted = verdict.data.match && verdict.data.confidence >= 0.45;
      return {
        ok: true,
        result: {
          accepted,
          confidence: verdict.data.confidence,
          feedback: verdict.data.feedback,
          observations: verdict.data.observations,
          source: 'perceptron',
        },
      };
    } catch (e) {
      if (controller.signal.aborted) return { ok: false, error: { kind: 'timeout', message: 'Verification took too long.' } };
      return { ok: false, error: { kind: 'network', message: e instanceof Error ? e.message : 'Network error.' } };
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt();
  // One automatic retry for transient failures only.
  if (!first.ok && (first.error.kind === 'network' || first.error.kind === 'server' || first.error.kind === 'timeout')) {
    await new Promise((r) => setTimeout(r, 800));
    return attempt();
  }
  return first;
}

async function verifyDemo(req: VerifyRequest, outcome: 'accept' | 'reject'): Promise<VerifyResponse> {
  await new Promise((r) => setTimeout(r, 1_400));
  if (!req.image.uri) return { ok: false, error: { kind: 'no-image', message: 'No photo selected.' } };
  return {
    ok: true,
    result:
      outcome === 'accept'
        ? {
            accepted: true,
            confidence: 1,
            feedback: 'Simulated check passed. In demo mode Thaw trusts you – no image analysis was performed.',
            observations: null,
            source: 'demo',
          }
        : {
            accepted: false,
            confidence: 0,
            feedback: 'Simulated rejection (you asked for one). Try another angle and resubmit.',
            observations: null,
            source: 'demo',
          },
  };
}

export async function verifyEvidence(req: VerifyRequest, opts: VerifyOptions = {}): Promise<VerifyResponse> {
  if (isPerceptronConfigured()) return verifyLive(req, opts.timeoutMs ?? 30_000);
  return verifyDemo(req, opts.demoOutcome ?? 'accept');
}
