import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore, partySizeOf } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, EmptyState, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { PinArt } from '../components/PinArt';
import { CATEGORY_STYLE, MODE_STYLE, RARITY_STYLE, THEME_STYLE } from '../theme/palette';
import { colors, spacing, type } from '../theme/tokens';
import { formatDistance } from '../utils/format';
import { walkingMinutes } from '../game/geo';
import { t } from '../i18n/strings';

export function QuestDetailScreen({ navigation, route }: RootScreenProps<'QuestDetail'>) {
  const { questId } = route.params;
  const world = useWorld();
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
  const cat = CATEGORY_STYLE[landmark.category];
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

  return (
    <ScreenShell title={quest.title} subtitle={`${cat.label} · ${landmark.name}`} back>
      <Card tint={colors.white} style={{ gap: spacing.md }}>
        <View style={styles.chips}>
          <Chip label={mode.label} icon={mode.icon} bg={mode.bg} fg={mode.fg} />
          <Chip label={quest.difficulty[0]!.toUpperCase() + quest.difficulty.slice(1)} icon="signal-cellular-outline" />
          <Chip label={`~${quest.durationMin} min`} icon="timer-outline" />
          <Chip label={`${quest.xp} XP`} icon="lightning-bolt-outline" bg={colors.butterSoft} />
          {quest.mode !== 'solo' && <Chip label={`${quest.minParty}–${quest.maxParty} players`} icon="account-group" />}
        </View>
        <Text style={type.body}>{quest.description}</Text>
        <View style={styles.where}>
          <MaterialCommunityIcons name={cat.icon} size={22} color={cat.color} />
          <View style={{ flex: 1 }}>
            <Text style={type.bodyStrong}>{landmark.name}</Text>
            <Text style={type.small}>
              {formatDistance(distanceM, units)} away · about {walkingMinutes(distanceM)} min walk
              {landmark.blurb ? ` · ${landmark.blurb}` : ''}
            </Text>
          </View>
        </View>
        <Button
          label="Show on map"
          icon="map-marker-radius"
          variant="secondary"
          compact
          onPress={() => navigation.navigate('Tabs', { screen: 'Explore', params: { focusLandmarkId: landmark.id } })}
        />
      </Card>

      <Card tint={colors.paper} style={{ gap: spacing.sm }}>
        <Text style={type.heading}>How to complete it</Text>
        {quest.instructions.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={type.bodyStrong}>{i + 1}</Text>
            </View>
            <Text style={[type.body, { flex: 1 }]}>{step}</Text>
          </View>
        ))}
        <View style={styles.evidence}>
          <MaterialCommunityIcons name="camera-outline" size={18} color={colors.forest} />
          <Text style={[type.small, { flex: 1, color: colors.ink }]}>Evidence: {quest.evidence}</Text>
        </View>
        {quest.soloAlternative && (
          <View style={styles.evidence}>
            <MaterialCommunityIcons name="walk" size={18} color={colors.forest} />
            <Text style={[type.small, { flex: 1, color: colors.ink }]}>Solo option: {quest.soloAlternative}</Text>
          </View>
        )}
      </Card>

      <Card tint={THEME_STYLE[quest.collectible.theme].base} style={styles.reward}>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={84} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.tiny}>COLLECTIBLE REWARD</Text>
          <Text style={type.heading}>{quest.collectible.name}</Text>
          <Text style={type.small}>
            {RARITY_STYLE[quest.collectible.rarity].label} · {THEME_STYLE[quest.collectible.theme].label}
          </Text>
        </View>
      </Card>

      {quest.safetyNotes.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          {quest.safetyNotes.map((n, i) => (
            <Notice key={i} icon="shield-check-outline" text={n} />
          ))}
        </View>
      )}

      <Text style={[type.small, { textAlign: 'center' }]}>
        {quest.source === 'gemini' ? 'Quest written by Gemini, then safety-checked by Thaw.' : 'Built-in Thaw quest.'} Place details may be incomplete; trust posted signs on site.
      </Text>

      {status === 'completed' ? (
        <Button label={t('quest.completed')} icon="check-decagram" disabled onPress={() => undefined} />
      ) : status === 'active' ? (
        <Button label={t('quest.continue')} icon="flag-checkered" variant="sunset" onPress={() => navigation.replace('ActiveQuest')} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {(partyShort || needsParty) && <Notice tone="warn" icon="account-group" text={`${t('quest.needsParty', { min: quest.minParty, max: quest.maxParty })} Your party: ${partySize}.`} />}
          {partyShort ? (
            <>
              <Button label={t('quest.findParty')} icon="account-plus" variant="sunset" onPress={() => navigation.navigate('Tabs', { screen: 'Party' })} />
              {quest.soloAlternative && <Button label={t('quest.playSolo')} icon="walk" variant="secondary" onPress={() => confirmAccept(true)} />}
            </>
          ) : (
            <>
              <Button label={t('quest.accept')} icon="flag-variant" variant="sunset" onPress={() => confirmAccept(false)} />
              {quest.mode !== 'solo' && quest.soloAlternative && <Button label={t('quest.playSolo')} icon="walk" variant="ghost" onPress={() => confirmAccept(true)} />}
            </>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  where: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.butter,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidence: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.white, padding: spacing.sm, borderRadius: 10 },
  reward: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
