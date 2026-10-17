/**
 * Real parties over Supabase: invite codes, membership (max 4), ready states and chat.
 * All writes are server RPCs with validation + rate limits; reads come from
 * `get_party_state`, refreshed whenever Supabase Realtime reports a change to the
 * party's rows (RLS applies to Realtime, so you only hear about your own party).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ChatMessage, Party, PartyMember } from '../types';
import { supabase } from './supabase/client';
import type { PartyService, PartySnapshot, SelfInfo } from './photon';
import { levelForXp } from '../game/progression';
import { MAX_CHAT_MESSAGES, PARTY_CAPACITY } from './photon';

const StateSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    quest_id: z.string().nullable(),
    quest_title: z.string().nullable(),
    expires_at: z.string(),
    is_host: z.boolean(),
    members: z.array(
      z.object({ key: z.string(), name: z.string(), hue: z.number(), xp: z.number(), ready: z.boolean(), is_host: z.boolean(), is_self: z.boolean() }),
    ),
    messages: z.array(
      z.object({ id: z.number(), author_key: z.string(), author_name: z.string(), body: z.string(), at: z.string(), is_self: z.boolean() }),
    ),
  })
  .nullable();

type ServerState = z.infer<typeof StateSchema>;

export type PartyErrorCode = 'invalid_code' | 'party_not_found' | 'party_full' | 'rate_limited' | 'not_host' | 'network' | 'unknown';

export const PARTY_ERROR_TEXT: Record<PartyErrorCode, string> = {
  invalid_code: 'Party codes are 6 letters and numbers.',
  party_not_found: 'No active party with that code. It may have ended – ask for a new one.',
  party_full: 'That party is full (4 explorers max).',
  rate_limited: 'Slow down a little and try again in a moment.',
  not_host: 'Only the host can change the party quest.',
  network: 'Couldn’t reach Thaw. Check your connection.',
  unknown: 'Something went wrong. Please try again.',
};

function errorCode(err: { message?: string } | null): PartyErrorCode {
  const m = err?.message ?? '';
  for (const c of ['invalid_code', 'party_not_found', 'party_full', 'rate_limited', 'not_host'] as const) if (m.includes(c)) return c;
  if (/fetch|network/i.test(m)) return 'network';
  return 'unknown';
}

export function mapPartyState(s: ServerState): { party: Party | null; messages: ChatMessage[] } {
  if (!s) return { party: null, messages: [] };
  const members: PartyMember[] = s.members.map((m) => ({
    id: m.key,
    name: m.name,
    avatarHue: m.hue,
    ready: m.ready,
    isSelf: m.is_self,
    isDemo: false,
    isHost: m.is_host,
    level: levelForXp(m.xp),
  }));
  return {
    party: {
      id: s.id,
      code: s.code,
      name: `${members.find((m) => m.isHost)?.name ?? 'Your'}’s party`,
      members,
      questId: s.quest_id,
      questTitle: s.quest_title,
      capacity: PARTY_CAPACITY,
      isHost: s.is_host,
      expiresAt: s.expires_at,
    },
    messages: s.messages.slice(-MAX_CHAT_MESSAGES).map((m) => ({ id: String(m.id), authorId: m.is_self ? 'self' : m.author_key, authorName: m.author_name, text: m.body, at: m.at })),
  };
}

export class SupabasePartyService implements PartyService {
  readonly isSimulated = false;
  private state: PartySnapshot = { connection: 'offline', party: null, messages: [], nearby: [] };
  private listeners = new Set<(s: PartySnapshot) => void>();
  private channel: RealtimeChannel | null = null;
  private channelPartyId: string | null = null;
  private refetchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: PartyErrorCode | null = null;

  private set(patch: Partial<PartySnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  error(): PartyErrorCode | null {
    return this.lastError;
  }

  subscribe(listener: (s: PartySnapshot) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot() {
    return this.state;
  }

  private apply(raw: unknown) {
    const parsed = StateSchema.safeParse(raw);
    if (!parsed.success) return;
    const { party, messages } = mapPartyState(parsed.data);
    this.set({ party, messages });
    this.ensureChannel(party?.id ?? null);
  }

  async refresh(): Promise<void> {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_party_state');
      if (error) {
        this.set({ connection: 'reconnecting' });
        return;
      }
      this.apply(data);
      if (this.state.connection !== 'connected') this.set({ connection: this.channel ? this.state.connection : 'connected' });
    } catch {
      this.set({ connection: 'reconnecting' });
    }
  }

  private scheduleRefresh() {
    if (this.refetchTimer) clearTimeout(this.refetchTimer);
    this.refetchTimer = setTimeout(() => void this.refresh(), 250);
  }

  private ensureChannel(partyId: string | null) {
    if (!supabase || partyId === this.channelPartyId) return;
    if (this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.channelPartyId = partyId;
    if (!partyId) return;
    const filter = `party_id=eq.${partyId}`;
    this.channel = supabase
      .channel(`party:${partyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members', filter }, () => this.scheduleRefresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter }, () => this.scheduleRefresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` }, () => this.scheduleRefresh())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.set({ connection: 'connected' });
          this.scheduleRefresh(); // catch anything missed while (re)connecting
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.set({ connection: 'reconnecting' });
        }
      });
  }

  connect() {
    if (!supabase) return;
    if (this.state.connection === 'offline') this.set({ connection: 'connecting' });
    void this.refresh();
  }

  disconnect() {
    if (this.refetchTimer) clearTimeout(this.refetchTimer);
    if (supabase && this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.channelPartyId = null;
    this.set({ connection: 'offline', party: null, messages: [], nearby: [] });
  }

  private async run(fn: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>, applyResult: boolean): Promise<boolean> {
    if (!supabase) return false;
    this.lastError = null;
    try {
      const { data, error } = await fn();
      if (error) {
        this.lastError = errorCode(error);
        this.listeners.forEach((l) => l(this.state));
        return false;
      }
      if (applyResult) this.apply(data);
      else await this.refresh();
      return true;
    } catch {
      this.lastError = 'network';
      this.listeners.forEach((l) => l(this.state));
      return false;
    }
  }

  createParty(_self: SelfInfo, _questId: string | null) {
    if (!supabase) return;
    const client = supabase;
    void this.run(() => client.rpc('create_party'), true);
  }

  async joinByCode(code: string): Promise<boolean> {
    if (!supabase) return false;
    const client = supabase;
    return this.run(() => client.rpc('join_party', { p_code: code }), true);
  }

  joinHostedParty() {
    // Real parties are joined by invite code only.
  }

  invite() {
    // Real invites are shared codes (see PartyScreen share sheet).
  }

  leaveParty() {
    if (!supabase) return;
    const client = supabase;
    this.set({ party: null, messages: [] });
    this.ensureChannel(null);
    void this.run(() => client.rpc('leave_party'), false);
  }

  setReady(ready: boolean) {
    if (!supabase || !this.state.party) return;
    const client = supabase;
    // Optimistic; the refresh reconciles.
    this.set({ party: { ...this.state.party, members: this.state.party.members.map((m) => (m.isSelf ? { ...m, ready } : m)) } });
    void this.run(() => client.rpc('set_party_ready', { p_ready: ready }), false);
  }

  setQuest(questId: string | null, questTitle?: string | null) {
    if (!supabase || !this.state.party?.isHost) return;
    const client = supabase;
    void this.run(() => client.rpc('set_party_quest', { p_quest_id: questId, p_quest_title: questId ? (questTitle ?? null) : null }), false);
  }

  sendMessage(text: string) {
    if (!supabase || !this.state.party) return;
    const client = supabase;
    const body = text.trim().slice(0, 280);
    if (!body) return;
    void this.run(() => client.rpc('send_party_message', { p_body: body }), false);
  }
}
