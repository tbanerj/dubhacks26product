import { unreadChatCount, unseenCollectibleCount } from '../src/game/attention';
import type { ChatMessage } from '../src/types';

const message = (partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'authorId' | 'at'>): ChatMessage => ({
  authorName: 'Mika',
  text: 'Hi',
  ...partial,
});

describe('attention badges', () => {
  it('counts other people’s messages after the last read time', () => {
    const chat = [
      message({ id: '1', authorId: 'me', at: '2026-10-17T10:00:00.000Z', text: 'Hello' }),
      message({ id: '2', authorId: 'mika', at: '2026-10-17T10:01:00.000Z' }),
      message({ id: '3', authorId: 'mika', at: '2026-10-17T10:02:00.000Z', system: true, text: 'joined' }),
      message({ id: '4', authorId: 'mika', at: '2026-10-17T10:03:00.000Z' }),
    ];
    expect(unreadChatCount(chat, '2026-10-17T10:01:00.000Z', 'me')).toBe(1);
    expect(unreadChatCount(chat, null, 'me')).toBe(2);
  });

  it('counts collectibles that have not been opened', () => {
    const owned = [{ id: 'a' }, { id: 'b' }];
    expect(unseenCollectibleCount(owned, ['a'])).toBe(1);
    expect(unseenCollectibleCount(owned, ['a', 'b'])).toBe(0);
  });
});
