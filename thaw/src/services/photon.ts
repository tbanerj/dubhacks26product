/**
 * Parties & social presence.
 *
 * About Photon: the DubHacks '26 sponsor "Photon 2.0" (photon.co) is a platform for
 * *messaging agents* that live on iMessage / SMS / RCS / WhatsApp / Telegram, not a
 * client-side realtime multiplayer SDK. Its keys belong on a server. So this module:
 *
 *  1. Defines a transport-agnostic `PartyService` interface the UI depends on.
 *  2. Ships `SimulatedPartyService`: a deterministic local lobby with clearly-labelled
 *     demo participants. Used only in Demo mode.
 *     Real parties (invite codes, Realtime chat) live in `supabaseParty.ts`.
 *  3. Offers `sendInviteViaRelay`, which POSTs to YOUR backend (EXPO_PUBLIC_PHOTON_RELAY_URL)
 *     where a Photon agent can text the invite to a friend. No Photon SDK methods are
 *     called from the app, and none are invented here.
 *
 * Swapping in a real realtime backend means implementing `PartyService` – screens
 * and the store don't change.
 */
import type { ChatMessage, ConnectionState, NearbyPlayer, Party, PartyMember } from '../types';
import { DEMO_CHAT_LINES, DEMO_NEARBY } from '../data/demoPeople';
import { config } from '../config/env';
import { clampText } from '../utils/format';

export const PARTY_CAPACITY = 4;
export const MAX_CHAT_MESSAGES = 60;

export interface PartySnapshot {
  connection: ConnectionState;
  party: Party | null;
  messages: ChatMessage[];
  nearby: NearbyPlayer[];
}

export interface SelfInfo {
  id: string;
  name: string;
  avatarHue: number;
  level: number;
}

export interface PartyService {
  readonly isSimulated: boolean;
  connect(): void;
  disconnect(): void;
  subscribe(listener: (s: PartySnapshot) => void): () => void;
  snapshot(): PartySnapshot;
  createParty(self: SelfInfo, questId: string | null): void;
  joinHostedParty(self: SelfInfo, hostId: string): void;
  invite(playerId: string): void;
  leaveParty(): void;
  setReady(ready: boolean): void;
  setQuest(questId: string | null, questTitle?: string | null): void;
  sendMessage(text: string): void;
  /** Join a real party by invite code. No-op in the simulation. */
  joinByCode(code: string): Promise<boolean>;
  /** Last error code from a party action, if any. */
  error(): string | null;
}

let idCounter = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const partyCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export class SimulatedPartyService implements PartyService {
  readonly isSimulated = true;
  private state: PartySnapshot = { connection: 'offline', party: null, messages: [], nearby: [] };
  private listeners = new Set<(s: PartySnapshot) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private self: SelfInfo | null = null;
  private lineIndex = 0;

  async joinByCode(): Promise<boolean> {
    return false;
  }

  error(): string | null {
    return null;
  }

  /** Delay multiplier; tests set this to 0. */
  constructor(private readonly delayScale = 1) {}

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms * this.delayScale);
    this.timers.add(t);
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  private set(patch: Partial<PartySnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private pushMessage(m: Omit<ChatMessage, 'id' | 'at'>) {
    const msg: ChatMessage = { ...m, id: nid('msg'), at: new Date().toISOString() };
    this.set({ messages: [...this.state.messages, msg].slice(-MAX_CHAT_MESSAGES) });
  }

  private system(text: string) {
    this.pushMessage({ authorId: 'system', authorName: 'Thaw', text, system: true });
  }

  private updateMember(id: string, patch: Partial<PartyMember>) {
    const party = this.state.party;
    if (!party) return;
    this.set({ party: { ...party, members: party.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) } });
  }

  private nextLine(): string {
    const line = DEMO_CHAT_LINES[this.lineIndex % DEMO_CHAT_LINES.length] ?? 'Hi!';
    this.lineIndex++;
    return line;
  }

  private demoMember(p: NearbyPlayer): PartyMember {
    return { id: p.id, name: p.name, avatarHue: p.avatarHue, ready: false, isSelf: false, isDemo: true, level: p.level };
  }

  private selfMember(self: SelfInfo, ready = false): PartyMember {
    return { id: self.id, name: self.name, avatarHue: self.avatarHue, ready, isSelf: true, isDemo: false, level: self.level };
  }

  connect() {
    if (this.state.connection === 'simulated') return;
    this.set({ connection: 'connecting' });
    this.later(500, () => this.set({ connection: 'simulated', nearby: DEMO_NEARBY }));
  }

  disconnect() {
    this.clearTimers();
    this.set({ connection: 'offline', party: null, messages: [], nearby: [] });
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

  createParty(self: SelfInfo, questId: string | null) {
    this.self = self;
    this.set({
      party: { id: nid('party'), name: `${self.name}’s party`, members: [this.selfMember(self)], questId, capacity: PARTY_CAPACITY, code: partyCode() },
      messages: [],
    });
    this.system('Party created. Invite demo explorers, or share an invite with a friend.');
  }

  joinHostedParty(self: SelfInfo, hostId: string) {
    const host = this.state.nearby.find((p) => p.id === hostId);
    if (!host) return;
    this.self = self;
    this.set({
      party: {
        id: nid('party'),
        name: `${host.name}’s party`,
        members: [{ ...this.demoMember(host), ready: true }, this.selfMember(self)],
        questId: this.state.party?.questId ?? null,
        capacity: PARTY_CAPACITY,
        code: partyCode(),
      },
      messages: [],
    });
    this.system(`You joined ${host.name}’s party (demo participant).`);
    this.later(900, () => this.pushMessage({ authorId: host.id, authorName: host.name, text: this.nextLine() }));
  }

  invite(playerId: string) {
    const party = this.state.party;
    const p = this.state.nearby.find((n) => n.id === playerId);
    if (!party || !p) return;
    if (party.members.length >= party.capacity || party.members.some((m) => m.id === playerId)) return;
    this.system(`Invite sent to ${p.name}…`);
    this.later(1_200, () => {
      const cur = this.state.party;
      if (!cur || cur.id !== party.id || cur.members.length >= cur.capacity) return;
      this.set({ party: { ...cur, members: [...cur.members, this.demoMember(p)] } });
      this.system(`${p.name} joined (demo participant).`);
      this.later(1_400, () => {
        this.pushMessage({ authorId: p.id, authorName: p.name, text: this.nextLine() });
        this.updateMember(p.id, { ready: true });
      });
    });
  }

  leaveParty() {
    this.clearTimers();
    this.set({ party: null, messages: [] });
  }

  setReady(ready: boolean) {
    if (this.self) this.updateMember(this.self.id, { ready });
  }

  setQuest(questId: string | null, questTitle?: string | null) {
    const party = this.state.party;
    if (party) this.set({ party: { ...party, questId, questTitle: questId ? (questTitle ?? party.questTitle ?? null) : null } });
  }

  sendMessage(text: string) {
    const party = this.state.party;
    const clean = clampText(text, 280);
    if (!party || !this.self || !clean) return;
    this.pushMessage({ authorId: this.self.id, authorName: this.self.name, text: clean });
    const responder = party.members.find((m) => m.isDemo);
    if (responder) {
      this.later(1_300, () => {
        if (this.state.party?.id === party.id) this.pushMessage({ authorId: responder.id, authorName: responder.name, text: this.nextLine() });
      });
    }
  }
}

export type RelayResult = { ok: true } | { ok: false; reason: string };

/**
 * Optional: ask your backend (which owns the Photon agent + key) to deliver an invite.
 * Contract (our own, documented in README): POST {relay}/invites { message } → 2xx.
 */
export async function sendInviteViaRelay(message: string): Promise<RelayResult> {
  const relay = config.photon.relayUrl;
  if (!relay) return { ok: false, reason: 'No invite relay configured.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${relay.replace(/\/+$/, '')}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clampText(message, 500) }),
      signal: controller.signal,
    });
    return res.ok ? { ok: true } : { ok: false, reason: `Relay error (${res.status}).` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Relay unreachable.' };
  } finally {
    clearTimeout(timer);
  }
}
