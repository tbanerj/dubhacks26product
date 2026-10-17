import type { ChatMessage, OwnedCollectible } from '../types';

/** Messages from other people that arrived after the chat was last opened. */
export function unreadChatCount(chat: ChatMessage[], lastReadAt: string | null, selfId: string): number {
  return chat.filter((m) => !m.system && m.authorId !== selfId && (lastReadAt == null || m.at > lastReadAt)).length;
}

/** Owned pins the collection screen has not shown yet. */
export function unseenCollectibleCount(owned: Pick<OwnedCollectible, 'id'>[], seenIds: string[]): number {
  const seen = new Set(seenIds);
  return owned.filter((c) => !seen.has(c.id)).length;
}
