import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, Notice, ProgressBar } from '../components/Paper';
import { Button } from '../components/Button';
import { CATEGORY_STYLE, MODE_STYLE } from '../theme/palette';
import { colors, fonts, spacing, type } from '../theme/tokens';
import { formatDistance } from '../utils/format';
import { CHECK_IN_RADIUS_M, walkingMinutes } from '../game/geo';
import { t } from '../i18n/strings';

type StepState = 'done' | 'current' | 'todo';

function Step({ n, title, detail, state }: { n: number; title: string; detail?: string; state: StepState }) {
  return (
    <View style={styles.step} accessible accessibilityLabel={`Step ${n}: ${title}. ${state === 'done' ? 'Done' : state === 'current' ? 'Current step' : 'Not started'}`}>
      <View style={[styles.dot, state === 'done' && { backgroundColor: colors.grass }, state === 'current' && { backgroundColor: colors.sunset }]}>
        {state === 'done' ? <MaterialCommunityIcons name="check-bold" size={16} color={colors.ink} /> : <Text style={styles.dotText}>{n}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.subheading, state === 'todo' && { color: colors.inkFaint }]}>{title}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export function ActiveQuestScreen({ navigation }: RootScreenProps<'ActiveQuest'>) {
  const world = useWorld();
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
        <EmptyState icon="flag-outline" title="You’re free to roam." body="Pick a quest on the map to start an adventure." action={<Button label="Find a quest" icon="compass-outline" onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })} />} />
      </ScreenShell>
    );
  }

  const { quest, landmark, distanceM } = entry;
  const inRange = distanceM <= CHECK_IN_RADIUS_M;
  const checkedIn = active.checkedIn;
  const cat = CATEGORY_STYLE[landmark.category];
  const approach = Math.max(0, Math.min(1, 1 - (distanceM - CHECK_IN_RADIUS_M) / 1500));

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
    const res = checkIn();
    if (!res.ok) setCheckMsg(t('active.tooFar', { distance: formatDistance(res.distanceM ?? distanceM, units), radius: formatDistance(CHECK_IN_RADIUS_M, units) }));
    else setCheckMsg(null);
  };

  return (
    <ScreenShell title={quest.title} subtitle={`${MODE_STYLE[active.soloVersion ? 'solo' : quest.mode].label} quest · ${landmark.name}`} back>
      <Card tint={colors.white} style={{ gap: spacing.md }}>
        <Step n={1} title="Quest accepted" state="done" />
        <Step
          n={2}
          title={checkedIn ? `Checked in at ${landmark.name}` : `Get to ${landmark.name}`}
          detail={checkedIn ? undefined : `${formatDistance(distanceM, units)} away · ~${walkingMinutes(distanceM)} min walk`}
          state={checkedIn ? 'done' : 'current'}
        />
        <Step n={3} title="Capture photo evidence" detail={quest.evidence} state={checkedIn ? 'current' : 'todo'} />
        <Step n={4} title="Verification & rewards" state="todo" />
      </Card>

      {!checkedIn && (
        <Card tint={colors.paper} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MaterialCommunityIcons name={cat.icon} size={24} color={cat.color} />
            <Text style={[type.heading, { flex: 1 }]}>{inRange ? 'You’re here!' : 'Head over'}</Text>
            <Text style={type.bodyStrong}>{formatDistance(distanceM, units)}</Text>
          </View>
          <ProgressBar fraction={inRange ? 1 : approach} color={colors.sunset} label="Distance progress" />
          <Text style={type.small}>Check in within {formatDistance(CHECK_IN_RADIUS_M, units)} of the spot. Watch the road, not your phone.</Text>
          <Button label={t('active.checkIn')} icon="map-marker-check-outline" variant={inRange ? 'sunset' : 'secondary'} onPress={doCheckIn} />
          {!inRange && <Button label="Walking directions" icon="directions" variant="ghost" compact onPress={openDirections} />}
          {!inRange && demoMode && (
            <Button
              label={t('active.simWalk')}
              icon="foot-print"
              variant="secondary"
              compact
              onPress={() => {
                simulateWalkTo(landmark.id);
                setCheckMsg('Simulated position moved next to the landmark. Now check in.');
              }}
            />
          )}
          {checkMsg && <Notice tone={checkMsg.startsWith('Simulated') ? 'demo' : 'warn'} text={checkMsg} />}
        </Card>
      )}

      {checkedIn && (
        <Card tint={colors.butterSoft} style={{ gap: spacing.sm }}>
          <Text style={type.heading}>Your mission</Text>
          {quest.instructions.map((s, i) => (
            <Text key={i} style={type.body}>
              {i + 1}. {active.soloVersion && quest.soloAlternative && i === quest.instructions.length - 1 ? quest.soloAlternative : s}
            </Text>
          ))}
          {active.soloVersion && quest.soloAlternative && <Notice icon="walk" text={`Solo version: ${quest.soloAlternative}`} />}
          <Button label={t('active.addEvidence')} icon="camera" variant="sunset" onPress={() => navigation.navigate('Verify')} />
        </Card>
      )}

      {quest.mode !== 'solo' && !active.soloVersion && (
        <Notice icon="account-group" text={party ? `Playing with ${party.members.length} in ${party.name}. Party bonus applies.` : 'No party yet – you can still play solo, or form a party in the Party tab.'} />
      )}

      <Button
        label={t('quest.abandon')}
        icon="flag-remove-outline"
        variant="danger"
        compact
        onPress={() => {
          abandonQuest();
          navigation.goBack();
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontFamily: fonts.bodyBold, color: colors.ink },
});
