import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState } from '../components/Paper';
import { Button } from '../components/Button';
import { useTheme } from '../theme/useTheme';
import { formatTime } from '../utils/format';
import { t } from '../i18n/strings';

export function PartyChatScreen({ navigation }: RootScreenProps<'PartyChat'>) {
  const insets = useSafeAreaInsets();
  const { colors, type, radii } = useTheme();
  const s = useGameStore(useShallow((st) => ({ party: st.party, chat: st.chat, quests: st.quests, selfId: st.player.id })));
  const sendChat = useGameStore((st) => st.sendChat);
  const markChatRead = useGameStore((st) => st.markChatRead);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      markChatRead();
      return () => setFocused(false);
    }, [markChatRead]),
  );

  useEffect(() => {
    if (focused) markChatRead();
  }, [focused, s.chat, markChatRead]);

  const party = s.party;
  if (!party) {
    return (
      <ScreenShell title="Party chat" back>
        <EmptyState icon="chat-outline" title="No party yet." action={<Button label="Back" onPress={() => navigation.goBack()} />} />
      </ScreenShell>
    );
  }

  const quest = party.questId ? s.quests.find((q) => q.id === party.questId && q.mode !== 'solo') : undefined;
  const me = party.members.find((m) => m.isSelf);

  const send = () => {
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      <ScreenShell title={party.name} subtitle={`${party.members.length} ${party.members.length === 1 ? 'explorer' : 'explorers'}`} back center scroll={false} bottomInset={false}>
        {quest ? (
          <Pressable
            onPress={() => navigation.navigate('QuestDetail', { questId: quest.id })}
            accessibilityRole="button"
            accessibilityLabel={`Selected quest ${quest.title}`}
            style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="flag-variant-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong} numberOfLines={1}>
                {quest.title}
              </Text>
              <Text style={type.tiny}>{quest.xp} XP</Text>
            </View>
          </Pressable>
        ) : null}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
          {s.chat.map((m) =>
            m.system ? (
              <Text key={m.id} style={[type.small, { textAlign: 'center' }]}>
                {m.text}
              </Text>
            ) : (
              <View key={m.id} style={[styles.bubble, { backgroundColor: m.authorId === me?.id ? colors.sageSoft : colors.surface, borderColor: colors.border, alignSelf: m.authorId === me?.id ? 'flex-end' : 'flex-start' }]}>
                {m.authorId !== me?.id ? <Text style={[type.tiny, { color: colors.primary }]}>{m.authorName}</Text> : null}
                <Text style={type.body}>{m.text}</Text>
                <Text style={[type.tiny, { alignSelf: 'flex-end' }]}>{formatTime(m.at)}</Text>
              </View>
            ),
          )}
        </ScrollView>
        <Text style={[type.tiny, { paddingHorizontal: 20 }]}>Keep chat friendly. Don’t share phone numbers, addresses, or socials.</Text>
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8), borderColor: colors.border, backgroundColor: colors.bg }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('party.chatPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, type.body, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill }]}
            maxLength={280}
            returnKeyType="send"
            onSubmitEditing={send}
            accessibilityLabel="Message your party"
          />
          <Pressable onPress={send} disabled={!draft.trim()} accessibilityRole="button" accessibilityLabel={t('party.send')} style={[styles.send, { backgroundColor: draft.trim() ? colors.primary : colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="send" size={18} color={draft.trim() ? colors.onPrimary : colors.textFaint} />
          </Pressable>
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pin: { marginHorizontal: 20, marginBottom: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 52 },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
