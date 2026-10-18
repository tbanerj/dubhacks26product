import { config } from '../config/env';
import { supabase } from './supabase/client';

export interface MessagingView {
  linked: boolean;
  maskedSender: string | null;
  servingLineHint: string | null;
  xp?: number;
  level?: number;
  activeQuest?: { id: string; title: string; status?: string } | null;
  preferences: {
    remindersEnabled: boolean;
    timezone: string;
    weekdays: string;
    weekdayLabel: string;
    localTime: string;
    quietStart: string;
    quietEnd: string;
    pauseUntil: string | null;
    stopped: boolean;
    nextDueAt: string | null;
  } | null;
  proactiveEnabled: boolean;
  code?: string;
  expiresAt?: string;
  instruction?: string;
  error?: string;
  ok?: boolean;
}

export function photonApiConfigured(): boolean {
  return Boolean(config.photon.apiUrl && supabase);
}

export async function messagingRequest(path: string, init?: { method?: string; body?: unknown }): Promise<MessagingView> {
  const base = config.photon.apiUrl;
  if (!base || !supabase) throw new Error('Play by text is not configured on this build.');
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Sign in again to manage text play.');
  const res = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => ({}))) as MessagingView & { error?: string; note?: string };
  if (!res.ok) throw new Error(body.error || body.note || `Request failed (${res.status}).`);
  return body;
}
