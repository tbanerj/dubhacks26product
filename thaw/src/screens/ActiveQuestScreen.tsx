import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, MetaRow, Notice, ProgressBar } from '../components/Paper';
import { Button } from '../components/Button';
import { PinArt } from '../components/PinArt';
import { MODE_STYLE } from '../theme/palette';
import { useTheme } from '../theme/useTheme';
import { formatDistance } from '../utils/format';
import { CHECK_IN_RADIUS_M, walkingMinutes } from '../game/geo';
import { t } from '../i18n/strings';

export function ActiveQuestScreen({ navigation }: RootScreenProps<'ActiveQuest'>) {
  const world = useWorld();
  const { colors, type } = useTheme();
  const active = useGameStore((s) => s.activeQuest);
  const units = useGameStore((s) => s.settings.units);
  const demoMode = useGameStore((s) => s.settings.demoMode);
  const party = useGameStore((s) => s.party);
  const { checkIn, simulateWalkTo, abandonQuest } = useGameStore.getState();
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const entry = world.active;
  if (!active || !entry) {
    return (
      <ScreenShell title="No active quest" back>
        <EmptyState icon="flag-outline" title="You’re free to roam." body="Pick a quest on the map to start an adventure." action={<Button label="Find a quest" onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })} />} />
      </ScreenShell>
    );
  }

  const { quest, landmark, distanceM } = entry;
  const inRange = distanceM <= CHECK_IN_RADIUS_M;
  const checkedIn = active.checkedIn;
  const approach = Math.max(0, Math.min(1, 1 - (distanceM - CHECK_IN_RADIUS_M) / 1500));
  const mode = MODE_STYLE[active.soloVersion ? 'solo' : quest.mode];

  const openDirections = () => {
    const { latitude, longitude } = landmark.coordinate;
    const label = encodeURIComponent(landmark.name);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`
        : Platform.OS === 'android'
          ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
          : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
    void Linking.openURL(url).catch(() => setCheckMsg('Couldn’t open a maps app on this device.'));
  };

  const doCheckIn = () => {
    const go = async () => {
      if (!useGameStore.getState().settings.demoMode) await useGameStore.getState().refreshGps();
      const res = checkIn();
      if (!res.ok) setCheckMsg(t('active.tooFar', { distance: formatDistance(res.distanceM ?? distanceM, units), radius: formatDistance(CHECK_IN_RADIUS_M, units) }));
      else setCheckMsg(null);
    };
    void go();
  };

  const drop = () => {
    abandonQuest();
    navigation.goBack();
  };

  return (
    <ScreenShell
      title={quest.title}
      subtitle={landmark.name}
      back
      footer={
        <View style={{ gap: 8 }}>
          {checkedIn ? (
            <Button label={t('active.addEvidence')} onPress={() => navigation.navigate('Verify')} />
          ) : (
            <Button label={t('active.checkIn')} onPress={doCheckIn} />
          )}
          {!checkedIn && <Button label="Walking directions" variant="secondary" onPress={openDirections} />}
          <Button label={t('quest.abandon')} variant="ghost" onPress={drop} />
        </View>
      }
    >
      <View style={[styles.hero, { backgroundColor: colors.sageSoft }]}>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={96} />
      </View>
      <MetaRow
        items={[
          { icon: mode.icon, label: mode.label },
          { icon: 'walk', label: checkedIn ? 'Checked in' : `${walkingMinutes(distanceM)} min walk` },
          { icon: 'timer-outline', label: `${quest.durationMin} min` },
          { icon: 'star-four-points-outline', label: `${quest.xp} XP` },
        ]}
      />

      <Card style={{ gap: 10 }}>
        <Text style={type.heading}>{checkedIn ? 'Your mission' : inRange ? 'You’re here' : 'Head over'}</Text>
        {!checkedIn && (
          <>
            <ProgressBar fraction={inRange ? 1 : approach} label="Distance progress" />
            <Text style={type.small}>
              {formatDistance(distanceM, units)} away. Check in within {formatDistance(CHECK_IN_RADIUS_M, units)}. Watch the road, not your phone.
            </Text>
          </>
        )}
        {quest.instructions.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.sageSoft }]}>
              <Text style={[type.bodyStrong, { color: colors.primary }]}>{i + 1}</Text>
            </View>
            <Text style={[type.body, { flex: 1 }]}>{active.soloVersion && quest.soloAlternative && i === quest.instructions.length - 1 ? quest.soloAlternative : s}</Text>
          </View>
        ))}
        <View style={styles.step}>
          <MaterialCommunityIcons name="camera-outline" size={18} color={colors.primary} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>Evidence: {quest.evidence}</Text>
        </View>
      </Card>

      {!checkedIn && demoMode && (
        <Button
          label={t('active.simWalk')}
          variant="secondary"
          onPress={() => {
            simulateWalkTo(landmark.id);
            setCheckMsg('Simulated position moved next to the landmark. Now check in.');
          }}
        />
      )}
      {checkMsg && <Notice tone={checkMsg.startsWith('Simulated') ? 'demo' : 'warn'} text={checkMsg} />}
      {quest.mode !== 'solo' && !active.soloVersion && (
        <Notice icon="account-group" text={party ? `Playing with ${party.members.length} in ${party.name}.` : 'No party yet. You can still play solo, or form a party.'} />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { height: 160, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
