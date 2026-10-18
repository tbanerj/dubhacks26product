import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, EmptyState, Notice } from '../components/Paper';
import { Button, IconButton } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { unreadChatCount } from '../game/attention';
import { sendInviteViaRelay } from '../services/photon';
import { PARTY_ERROR_TEXT, type PartyErrorCode } from '../services/supabaseParty';
import { config } from '../config/env';
import { t } from '../i18n/strings';
import type { NearbyPlayer } from '../types';

const PROXIMITY_LABEL: Record<NearbyPlayer['proximity'], string> = {
  'very-near': 'Very near',
  near: 'Nearby',
  around: 'In the area',
};

export function PartyScreen({ navigation }: TabScreenProps<'Party'>) {
  const { colors, type } = useTheme();
  const world = useWorld();
  const s = useGameStore(
    useShallow((st) => ({
      connection: st.connection,
      party: st.party,
      chat: st.chat,
      nearby: st.nearbyPlayers,
      quests: st.quests,
      activeQuest: st.activeQuest,
      selfId: st.player.id,
      lastChatReadAt: st.lastChatReadAt,
      simulated: st.connection === 'simulated',
      partyError: st.partyError,
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
      joinPartyByCode: st.joinPartyByCode,
    })),
  );
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    a.connectParty();
  }, [a]);

  const party = s.party;
  const me = party?.members.find((m) => m.isSelf);
  const rawQuest = party?.questId ? s.quests.find((q) => q.id === party.questId) : undefined;
  const partyQuest = rawQuest && rawQuest.mode !== 'solo' ? rawQuest : undefined;
  const spots = party ? party.capacity - party.members.length : 0;
  const unread = unreadChatCount(s.chat, s.lastChatReadAt, s.selfId);
  const lastMessage = [...s.chat].reverse().find((m) => !m.system);
  const groupQuests = world.entries.filter((e) => e.quest.mode !== 'solo' && e.status !== 'completed');

  const errorText = s.partyError ? (PARTY_ERROR_TEXT[s.partyError as PartyErrorCode] ?? PARTY_ERROR_TEXT.unknown) : null;

  const share = async () => {
    const message = s.simulated
      ? `Join my Thaw party${partyQuest ? ` for “${partyQuest.title}”` : ''}! Let's explore together – meet in a public spot.`
      : `Join my Thaw party! Open Thaw, then Party, and enter code ${party?.code ?? ''}. Let’s meet somewhere public.`;
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

  const confirmLeave = () => {
    const go = () => a.leaveParty();
    if (Platform.OS === 'web') return go();
    Alert.alert('Leave party?', 'You’ll leave this group. You can start another any time.', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('party.leave'), style: 'destructive', onPress: go },
    ]);
  };

  const join = async () => {
    setJoining(true);
    await a.joinPartyByCode(code);
    setJoining(false);
  };

  const statusLabel = s.simulated ? 'Demo' : s.connection === 'connected' ? 'Live' : s.connection === 'connecting' ? 'Connecting' : 'Offline';

  return (
    <ScreenShell
      title={party?.name ?? t('party.title')}
      subtitle={party ? `${party.members.length} of ${party.capacity}` : 'Explore together'}
      tab
      right={
        party ? (
            <IconButton icon="dots-horizontal" label="Leave party" onPress={confirmLeave} />
        ) : (
          <Chip label={statusLabel} icon={s.simulated ? 'flask-outline' : 'access-point'} />
        )
      }
    >
      {party && s.connection === 'simulated' ? <Chip label="Simulated lobby" icon="flask-outline" /> : null}

      {!party ? (
        <>
          <Card style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              <Critter hue={150} size={48} />
              <Critter hue={28} size={56} mood="happy" />
              <Critter hue={330} size={48} />
            </View>
            <Text style={[type.heading, { textAlign: 'center' }]}>Some quests are better together</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>Party quests stay optional. Every social quest still has a solo version.</Text>
            <Button label={t('party.create')} onPress={a.createParty} style={{ alignSelf: 'stretch' }} />
          </Card>
          {!s.simulated && (
            <Card style={{ gap: 8 }}>
              <Text style={type.heading}>Join with a code</Text>
              <Text style={type.small}>Ask a friend for their 6-character party code.</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                placeholder="ABC234"
                placeholderTextColor={colors.textFaint}
                style={[styles.codeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                accessibilityLabel="Party code"
              />
              <Button label="Join party" onPress={() => void join()} loading={joining} disabled={code.trim().length < 6} />
            </Card>
          )}
          {errorText ? <Notice tone="warn" text={errorText} /> : null}
          {s.simulated && <Text style={type.heading}>{t('party.nearby')}</Text>}
          {!s.simulated ? null : s.nearby.length === 0 ? (
            <EmptyState icon="account-search-outline" title="Nobody around right now." />
          ) : (
            s.nearby.map((p) => (
              <Card key={p.id} style={styles.playerRow}>
                <Critter hue={p.avatarHue} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>
                    {p.name} · Lv {p.level}
                  </Text>
                  <Text style={type.small}>
                    {PROXIMITY_LABEL[p.proximity]} · {p.lookingFor}
                  </Text>
                  {p.isDemo ? <Text style={type.tiny}>{t('party.demoLabel')}</Text> : null}
                </View>
                <Button label="Join" compact variant="secondary" onPress={() => a.joinHostedParty(p.id)} />
              </Card>
            ))
          )}
          {s.simulated ? <Text style={[type.small, { textAlign: 'center' }]}>Distances are rough on purpose. This lobby is a local simulation, not live multiplayer.</Text> : null}
        </>
      ) : picking ? (
        <>
          <Text style={type.heading}>Party quests</Text>
          {groupQuests.length === 0 ? (
            <EmptyState icon="flag-outline" title="No group quests nearby." body="Solo quests stay on the map. Try another area, or turn off Prefer solo in Settings." />
          ) : (
            groupQuests.map((e) => (
              <Pressable
                key={e.quest.id}
                onPress={() => navigation.navigate('QuestDetail', { questId: e.quest.id })}
                accessibilityRole="button"
                accessibilityLabel={`${e.quest.title}, party quest`}
                style={[styles.questPick, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{e.quest.title}</Text>
                  <Text style={type.small}>
                    {e.landmark.name} · {e.quest.xp} XP
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} />
              </Pressable>
            ))
          )}
          <Button label="Back" variant="ghost" onPress={() => setPicking(false)} />
        </>
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <View style={styles.members}>
              {party.members.map((m) => (
                <View key={m.id} style={styles.member} accessible accessibilityLabel={`${m.isSelf ? 'You' : m.name}${m.isDemo ? ', demo' : ''}, ${m.ready ? 'ready' : 'not ready'}`}>
                  <View style={[styles.memberAvatar, { backgroundColor: m.ready ? colors.sageSoft : colors.surfaceMuted }]}>
                    <Critter hue={m.avatarHue} size={40} mood={m.ready ? 'happy' : 'sleepy'} />
                  </View>
                  <Text style={type.tiny} numberOfLines={1}>
                    {m.isSelf ? 'You' : m.name}
                  </Text>
                  <Text style={[type.tiny, { color: m.ready ? colors.primary : colors.textFaint }]}>{m.ready ? 'Ready' : 'Not ready'}</Text>
                  {m.isDemo ? <Text style={type.tiny}>Demo</Text> : null}
                </View>
              ))}
              {Array.from({ length: spots }, (_, i) => (
                <View key={`empty-${i}`} style={styles.member}>
                  <View style={[styles.memberAvatar, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' }]}>
                    <MaterialCommunityIcons name="plus" size={18} color={colors.textFaint} />
                  </View>
                  <Text style={[type.tiny, { color: colors.textFaint }]}>Open</Text>
                </View>
              ))}
            </View>
            <Button label={me?.ready ? t('party.notReady') : t('party.ready')} variant={me?.ready ? 'secondary' : 'primary'} onPress={() => a.setReady(!me?.ready)} />
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={type.tiny}>Group quest</Text>
            {partyQuest ? (
              <>
                <Text style={type.heading}>{partyQuest.title}</Text>
                <Text style={type.small}>{partyQuest.mode === 'party' ? 'Party quest' : 'Group quest'} · {partyQuest.xp} XP</Text>
                <Button
                  label="Open quest"
                  variant="secondary"
                  onPress={() => (s.activeQuest?.questId === partyQuest.id ? navigation.navigate('ActiveQuest') : navigation.navigate('QuestDetail', { questId: partyQuest.id }))}
                />
              </>
            ) : (
              <>
                <Text style={type.body}>No group quest selected.</Text>
                <Button label="Find a quest" onPress={() => setPicking(true)} />
              </>
            )}
          </Card>

          {!s.simulated && party.code ? <Notice icon="ticket-confirmation-outline" text={`Party code ${party.code}. Share it so friends can join.`} /> : null}
          {s.simulated && spots > 0 ? (
            <>
              <Text style={type.heading}>Invite demo explorers</Text>
              {s.nearby
                .filter((p) => !party.members.some((m) => m.id === p.id))
                .map((p) => (
                  <Card key={p.id} style={styles.playerRow}>
                    <Critter hue={p.avatarHue} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.bodyStrong}>
                        {p.name} · Lv {p.level}
                      </Text>
                      <Text style={type.small}>
                        {PROXIMITY_LABEL[p.proximity]} · {p.lookingFor}
                      </Text>
                      {p.isDemo ? <Text style={type.tiny}>{t('party.demoLabel')}</Text> : null}
                    </View>
                    <Button label="Invite" compact variant="secondary" onPress={() => a.invitePlayer(p.id)} />
                  </Card>
                ))}
            </>
          ) : null}

          <Button label="Invite friends" variant="secondary" onPress={() => void share()} />
          {shareNote ? <Notice text={shareNote} /> : null}

          <Pressable onPress={() => navigation.navigate('PartyChat')} accessibilityRole="button" accessibilityLabel={unread ? `Party chat, ${unread} unread` : 'Party chat'} style={[styles.chatPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="chat-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>Party chat</Text>
              <Text style={type.small} numberOfLines={1}>
                {lastMessage ? `${lastMessage.authorName}: ${lastMessage.text}` : 'Say hello'}
              </Text>
            </View>
            {unread > 0 ? (
              <View style={[styles.unread, { backgroundColor: colors.primary }]}>
                <Text style={[type.tiny, { color: colors.onPrimary }]}>{unread}</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} />
            )}
          </Pressable>
        </>
      )}

      <Notice icon="shield-check-outline" text={t('party.safety')} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  member: { alignItems: 'center', width: 72, gap: 2 },
  memberAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  questPick: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  chatPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  codeInput: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 16, fontSize: 20, letterSpacing: 4 },
});
