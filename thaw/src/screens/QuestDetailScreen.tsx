import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore, partySizeOf } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, MetaRow, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { PinArt } from '../components/PinArt';
import { MODE_STYLE, RARITY_STYLE, THEME_STYLE } from '../theme/palette';
import { useTheme } from '../theme/useTheme';
import { formatDistance } from '../utils/format';
import { walkingMinutes } from '../game/geo';
import { t } from '../i18n/strings';

export function QuestDetailScreen({ navigation, route }: RootScreenProps<'QuestDetail'>) {
  const { questId } = route.params;
  const world = useWorld();
  const { colors, type } = useTheme();
  const entry = world.entries.find((e) => e.quest.id === questId);
  const units = useGameStore((s) => s.settings.units);
  const party = useGameStore((s) => s.party);
  const activeQuestId = useGameStore((s) => s.activeQuest?.questId ?? null);
  const acceptQuest = useGameStore((s) => s.acceptQuest);
  const markSeen = useGameStore((s) => s.markSeen);
  const [needsParty, setNeedsParty] = useState(false);

  useEffect(() => {
    markSeen([questId]);
  }, [questId, markSeen]);

  if (!entry) {
    return (
      <ScreenShell title="Quest" back>
        <EmptyState icon="map-marker-question-outline" title="This quest isn’t nearby any more." body="It may be out of range or the world was refreshed." />
        <Button label="Back to the map" onPress={() => navigation.goBack()} />
      </ScreenShell>
    );
  }

  const { quest, landmark, status, distanceM } = entry;
  const mode = MODE_STYLE[quest.mode];
  const partySize = partySizeOf(party);
  const partyShort = quest.mode === 'party' && partySize < quest.minParty;

  const doAccept = (solo: boolean) => {
    const res = acceptQuest(quest.id, { solo });
    if (res.ok) navigation.replace('ActiveQuest');
    else if (res.reason === 'needs-party') setNeedsParty(true);
  };

  const confirmAccept = (solo: boolean) => {
    if (activeQuestId && activeQuestId !== quest.id) {
      const msg = 'You already have a quest in progress. Switch to this one?';
      if (Platform.OS === 'web') {
        doAccept(solo);
        return;
      }
      Alert.alert('Switch quests?', msg, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Switch', onPress: () => doAccept(solo) },
      ]);
      return;
    }
    doAccept(solo);
  };

  const footer = (
    <View style={{ gap: 8 }}>
      {status === 'completed' ? (
        <Button label={t('quest.completed')} icon="check-decagram" disabled onPress={() => undefined} />
      ) : status === 'active' ? (
        <Button label={t('quest.continue')} onPress={() => navigation.replace('ActiveQuest')} />
      ) : partyShort ? (
        <>
          <Button label={t('quest.findParty')} onPress={() => navigation.navigate('Tabs', { screen: 'Party' })} />
          {quest.soloAlternative ? <Button label={t('quest.playSolo')} variant="secondary" onPress={() => confirmAccept(true)} /> : null}
        </>
      ) : (
        <>
          <Button label={quest.mode === 'solo' ? 'Start quest' : t('quest.accept')} onPress={() => confirmAccept(false)} />
          {quest.mode !== 'solo' && quest.soloAlternative ? <Button label={t('quest.playSolo')} variant="secondary" onPress={() => confirmAccept(true)} /> : null}
        </>
      )}
      <Button label="Show on map" variant="secondary" onPress={() => navigation.navigate('Tabs', { screen: 'Explore', params: { focusLandmarkId: landmark.id } })} />
    </View>
  );

  return (
    <ScreenShell title={quest.title} subtitle={landmark.name} back footer={footer}>
      <View style={[styles.hero, { backgroundColor: colors.sageSoft }]}>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={120} />
      </View>
      <MetaRow
        items={[
          { icon: mode.icon, label: mode.label },
          { icon: 'walk', label: `${walkingMinutes(distanceM)} min walk` },
          { icon: 'timer-outline', label: `${quest.durationMin} min` },
          { icon: 'star-four-points-outline', label: `${quest.xp} XP` },
        ]}
      />
      <Text style={type.body}>{quest.description}</Text>
      <Text style={type.small}>
        {formatDistance(distanceM, units)} away{landmark.blurb ? ` · ${landmark.blurb}` : ''}
      </Text>

      <Card style={{ gap: 12 }}>
        <Text style={type.heading}>How to complete it</Text>
        {quest.instructions.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.sageSoft }]}>
              <Text style={[type.bodyStrong, { color: colors.primary }]}>{i + 1}</Text>
            </View>
            <Text style={[type.body, { flex: 1 }]}>{step}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={styles.evidence}>
          <MaterialCommunityIcons name="camera-outline" size={18} color={colors.primary} />
          <Text style={[type.body, { flex: 1 }]}>Evidence: {quest.evidence}</Text>
        </View>
        {quest.soloAlternative ? (
          <View style={styles.evidence}>
            <MaterialCommunityIcons name="walk" size={18} color={colors.primary} />
            <Text style={[type.body, { flex: 1 }]}>Solo option: {quest.soloAlternative}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.reward}>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.tiny}>Collectible</Text>
          <Text style={type.subheading}>{quest.collectible.name}</Text>
          <Text style={type.small}>
            {RARITY_STYLE[quest.collectible.rarity].label} · {THEME_STYLE[quest.collectible.theme].label}
          </Text>
        </View>
      </Card>

      {(partyShort || needsParty) && <Notice tone="warn" icon="account-group" text={`${t('quest.needsParty', { min: quest.minParty, max: quest.maxParty })} Your party: ${partySize}.`} />}
      {quest.safetyNotes.map((n, i) => (
        <Notice key={i} icon="shield-check-outline" text={n} />
      ))}
      <Text style={[type.small, { textAlign: 'center' }]}>
        {quest.source === 'gemini' ? 'Quest written by Gemini, then safety-checked by Thaw.' : 'Built-in Thaw quest.'} Place details may be incomplete; trust posted signs on site.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { height: 180, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  evidence: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reward: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
