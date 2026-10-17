import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, EmptyState, Notice, SectionTitle } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { formatTime } from '../utils/format';
import { sendInviteViaRelay } from '../services/photon';
import { config } from '../config/env';
import { t } from '../i18n/strings';
import type { NearbyPlayer } from '../types';

const PROXIMITY_LABEL: Record<NearbyPlayer['proximity'], string> = {
  'very-near': 'Very near',
  near: 'Nearby',
  around: 'In the area',
};

export function PartyScreen({ navigation }: TabScreenProps<'Party'>) {
  const s = useGameStore(
    useShallow((st) => ({
      connection: st.connection,
      party: st.party,
      chat: st.chat,
      nearby: st.nearbyPlayers,
      quests: st.quests,
      activeQuest: st.activeQuest,
    })),
  );
  const a = useGameStore(
    useShallow((st) => ({
      connectParty: st.connectParty,
      createParty: st.createParty,
      joinHostedParty: st.joinHostedParty,
      invitePlayer: st.invitePlayer,
      leaveParty: st.leaveParty,
      setReady: st.setReady,
      sendChat: st.sendChat,
    })),
  );
  const [draft, setDraft] = useState('');
  const [shareNote, setShareNote] = useState<string | null>(null);
  const chatScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    a.connectParty();
  }, [a]);

  const party = s.party;
  const me = party?.members.find((m) => m.isSelf);
  const partyQuest = party?.questId ? s.quests.find((q) => q.id === party.questId) : undefined;
  const spots = party ? party.capacity - party.members.length : 0;

  const share = async () => {
    const message = `Join my Thaw party${partyQuest ? ` for “${partyQuest.title}”` : ''}! Let's explore together – meet in a public spot.`;
    try {
      await Share.share({ message });
      if (config.photon.relayUrl) {
        const r = await sendInviteViaRelay(message);
        setShareNote(r.ok ? 'Invite also sent through your Photon relay.' : `Relay: ${r.reason}`);
      }
    } catch {
      setShareNote('Sharing isn’t available on this device.');
    }
  };

  const send = () => {
    if (!draft.trim()) return;
    a.sendChat(draft);
    setDraft('');
    setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const status = (
    <Chip
      label={s.connection === 'simulated' ? 'Simulated lobby' : s.connection === 'connecting' ? 'Connecting…' : s.connection}
      icon={s.connection === 'connecting' ? 'timer-sand' : 'flask-outline'}
      bg={colors.butterSoft}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell title={t('party.title')} subtitle="Explore together, 2–4 players" tab right={status} keyboardShouldPersistTaps="handled">
        <Notice icon="shield-check-outline" text={t('party.safety')} />

        {!party ? (
          <>
            <Card tint={colors.white} style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flexDirection: 'row' }}>
                <Critter hue={150} size={56} />
                <Critter hue={28} size={64} mood="wow" />
                <Critter hue={330} size={56} />
              </View>
              <Text style={[type.heading, { textAlign: 'center' }]}>Some quests are better together</Text>
              <Text style={[type.small, { textAlign: 'center' }]}>Party quests earn bonus XP and co-op pins. Everything social has a solo option too.</Text>
              <Button label={t('party.create')} icon="account-plus" variant="sunset" onPress={a.createParty} style={{ alignSelf: 'stretch' }} />
            </Card>

            <SectionTitle>{t('party.nearby')}</SectionTitle>
            {s.connection !== 'simulated' ? (
              <Text style={type.small}>Looking for explorers…</Text>
            ) : s.nearby.length === 0 ? (
              <EmptyState icon="account-search-outline" title="Nobody around right now." />
            ) : (
              s.nearby.map((p) => (
                <Card key={p.id} tint={colors.paper} style={styles.playerRow}>
                  <Critter hue={p.avatarHue} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.subheading}>
                      {p.name} <Text style={type.small}>· Lv {p.level}</Text>
                    </Text>
                    <Text style={type.small}>
                      {PROXIMITY_LABEL[p.proximity]} · {p.lookingFor}
                    </Text>
                    {p.isDemo && <Chip label={t('party.demoLabel')} icon="flask-outline" bg={colors.butterSoft} style={{ marginTop: 4 }} />}
                  </View>
                  <Button label="Join" compact variant="secondary" onPress={() => a.joinHostedParty(p.id)} />
                </Card>
              ))
            )}
            <Text style={[type.small, { textAlign: 'center' }]}>
              Positions are shown only as rough distance – never exact locations. Real-time multiplayer needs a backend; this lobby is a local simulation.
            </Text>
          </>
        ) : (
          <>
            <Card tint={colors.sunsetSoft} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={type.heading}>{party.name}</Text>
                <Chip label={spots === 1 ? t('party.spot1') : spots > 0 ? t('party.spots', { n: spots }) : t('party.full')} bg={spots > 0 ? colors.white : colors.grass} />
              </View>
              <View style={styles.members}>
                {party.members.map((m) => (
                  <View key={m.id} style={styles.member} accessible accessibilityLabel={`${m.name}${m.isSelf ? ' (you)' : ''}${m.isDemo ? ', demo participant' : ''}, ${m.ready ? 'ready' : 'not ready'}`}>
                    <View style={[styles.memberAvatar, m.ready && { backgroundColor: colors.grassSoft, borderColor: colors.forest }]}>
                      <Critter hue={m.avatarHue} size={48} mood={m.ready ? 'happy' : 'sleepy'} />
                    </View>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.isSelf ? 'You' : m.name}
                    </Text>
                    <Text style={[styles.memberState, { color: m.ready ? colors.forest : colors.inkFaint }]}>{m.ready ? 'Ready' : 'Not ready'}</Text>
                    {m.isDemo && <Text style={styles.demoTag}>demo</Text>}
                  </View>
                ))}
                {Array.from({ length: spots }, (_, i) => (
                  <View key={`empty-${i}`} style={styles.member}>
                    <View style={[styles.memberAvatar, styles.emptySeat]}>
                      <MaterialCommunityIcons name="plus" size={22} color={colors.inkFaint} />
                    </View>
                    <Text style={[styles.memberName, { color: colors.inkFaint }]}>Open</Text>
                  </View>
                ))}
              </View>
              <View style={styles.questRow}>
                <MaterialCommunityIcons name="flag-variant" size={18} color={colors.ink} />
                <Text style={[type.small, { flex: 1, color: colors.ink }]}>{partyQuest ? `Attempting: ${partyQuest.title}` : 'No quest chosen yet – pick a party quest on the map.'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label={me?.ready ? t('party.notReady') : t('party.ready')}
                  icon={me?.ready ? 'close-circle-outline' : 'check-circle-outline'}
                  variant={me?.ready ? 'secondary' : 'primary'}
                  compact
                  onPress={() => a.setReady(!me?.ready)}
                  style={{ flex: 1 }}
                />
                <Button label={partyQuest ? 'Open quest' : 'Find a quest'} icon="compass-outline" variant="secondary" compact style={{ flex: 1 }} onPress={() => (partyQuest && s.activeQuest?.questId === partyQuest.id ? navigation.navigate('ActiveQuest') : navigation.navigate('Explore'))} />
              </View>
            </Card>

            {spots > 0 && s.nearby.some((p) => !party.members.some((m) => m.id === p.id)) && (
              <View style={{ gap: spacing.sm }}>
                <SectionTitle>Invite explorers</SectionTitle>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {s.nearby
                    .filter((p) => !party.members.some((m) => m.id === p.id))
                    .map((p) => (
                      <Pressable key={p.id} style={styles.invite} onPress={() => a.invitePlayer(p.id)} accessibilityRole="button" accessibilityLabel={`Invite ${p.name}, demo participant`}>
                        <Critter hue={p.avatarHue} size={40} />
                        <Text style={styles.memberName}>{p.name}</Text>
                        <Text style={styles.demoTag}>demo · invite</Text>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            )}

            <Button label={t('party.share')} icon="share-variant" variant="secondary" compact onPress={() => void share()} />
            {shareNote && <Notice text={shareNote} />}

            <Card tint={colors.white} style={{ gap: spacing.sm }}>
              <Text style={type.heading}>Party chat</Text>
              <ScrollView ref={chatScroll} style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 6 }} onContentSizeChange={() => chatScroll.current?.scrollToEnd({ animated: false })} nestedScrollEnabled>
                {s.chat.map((m) =>
                  m.system ? (
                    <Text key={m.id} style={styles.system}>
                      {m.text}
                    </Text>
                  ) : (
                    <View key={m.id} style={[styles.bubble, m.authorId === me?.id ? styles.mine : styles.theirs]}>
                      {m.authorId !== me?.id && <Text style={styles.author}>{m.authorName}</Text>}
                      <Text style={type.body}>{m.text}</Text>
                      <Text style={styles.time}>{formatTime(m.at)}</Text>
                    </View>
                  ),
                )}
              </ScrollView>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('party.chatPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                  style={styles.input}
                  maxLength={280}
                  returnKeyType="send"
                  onSubmitEditing={send}
                  accessibilityLabel="Chat message"
                />
                <Pressable onPress={send} style={styles.send} accessibilityRole="button" accessibilityLabel={t('party.send')} disabled={!draft.trim()}>
                  <MaterialCommunityIcons name="send" size={20} color={colors.paper} />
                </Pressable>
              </View>
              <Text style={type.small}>Keep chat friendly. Don’t share phone numbers, addresses or socials.</Text>
            </Card>

            <Button label={t('party.leave')} icon="exit-run" variant="danger" compact onPress={a.leaveParty} />
          </>
        )}
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  members: { flexDirection: 'row', justifyContent: 'space-between' },
  member: { alignItems: 'center', width: 72, gap: 2 },
  memberAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  emptySeat: { borderStyle: 'dashed', borderColor: colors.inkFaint, backgroundColor: 'transparent' },
  memberName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  memberState: { fontFamily: fonts.bodySemi, fontSize: 11 },
  demoTag: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.inkSoft },
  questRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.white, padding: spacing.sm, borderRadius: radii.sm },
  invite: { alignItems: 'center', padding: spacing.sm, borderRadius: radii.md, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, width: 96, minHeight: 44 },
  system: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  bubble: { maxWidth: '82%', borderRadius: radii.md, padding: spacing.sm, borderWidth: 1.5, borderColor: colors.ink },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.grassSoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.paper },
  author: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.sunsetDeep },
  time: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.forest, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
