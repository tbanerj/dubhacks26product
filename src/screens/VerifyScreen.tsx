import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { verifyDemo, verifyWithServer, type VerifyOutcome } from '../services/verification';
import { haptic } from '../utils/haptics';
import { t } from '../i18n/strings';

type Phase =
  | { kind: 'capture' }
  | { kind: 'checking' }
  | { kind: 'rejected'; feedback: string; observations: string | null }
  | { kind: 'error'; message: string; canRetry: boolean };

export function VerifyScreen({ navigation }: RootScreenProps<'Verify'>) {
  const world = useWorld();
  const active = useGameStore((s) => s.activeQuest);
  const demoMode = useGameStore((s) => s.settings.demoMode);
  const hue = useGameStore((s) => s.player.avatarHue);
  const completeActiveQuest = useGameStore((s) => s.completeActiveQuest);
  const applyServerReward = useGameStore((s) => s.applyServerReward);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'capture' });
  const [pickError, setPickError] = useState<string | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<'accept' | 'reject'>('accept');
  const submitting = useRef(false);

  const entry = world.active;
  if (!active || !entry) {
    return (
      <ScreenShell title={t('verify.title')} back>
        <EmptyState icon="camera-off-outline" title="No quest to verify." body="Accept a quest and check in first." />
      </ScreenShell>
    );
  }
  if (!active.checkedIn) {
    return (
      <ScreenShell title={t('verify.title')} back>
        <EmptyState icon="map-marker-alert-outline" title="Check in first" body={`Get to ${entry.landmark.name} and check in before adding evidence.`} action={<Button label="Back to quest" onPress={() => navigation.goBack()} />} />
      </ScreenShell>
    );
  }

  const pick = async (source: 'camera' | 'library') => {
    setPickError(null);
    try {
      const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPickError(source === 'camera' ? 'Camera access is off. Enable it in Settings, or choose a photo instead.' : 'Photo access is off. Enable it in Settings, or use the camera.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      setImageUri(res.assets[0].uri);
      setPhase({ kind: 'capture' });
    } catch (e) {
      setPickError(source === 'camera' ? 'The camera isn’t available here. Try choosing a photo instead.' : `Couldn’t open photos: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleOutcome = (o: VerifyOutcome) => {
    if (o.kind === 'error') {
      if (o.code === 'quest_rate_limited' || o.code === 'network' || o.code === 'unavailable' || o.code === 'rate_limited') setPhase({ kind: 'error', message: o.message, canRetry: true });
      else setPhase({ kind: 'error', message: o.message, canRetry: false });
      return;
    }
    if (o.kind === 'rejected') {
      haptic.warning();
      setPhase({ kind: 'rejected', feedback: o.feedback, observations: o.observations });
      return;
    }
    // Accepted.
    if (demoMode) {
      const done = completeActiveQuest({ accepted: true, confidence: o.confidence, feedback: o.feedback, observations: o.observations, source: 'demo' });
      if (!done.ok) {
        setPhase({ kind: 'error', message: 'This quest was already completed.', canRetry: false });
        return;
      }
    } else {
      if (!o.reward) {
        setPhase({ kind: 'error', message: 'Your photo passed, but the reward couldn’t be confirmed. Pull to refresh your profile.', canRetry: false });
        return;
      }
      if (o.reward.duplicate) {
        useGameStore.setState({ activeQuest: null });
        setPhase({ kind: 'error', message: 'You’ve already completed this quest – rewards are only granted once.', canRetry: false });
        return;
      }
      applyServerReward(o.reward);
    }
    haptic.success();
    setImageUri(null); // Thaw doesn't keep evidence photos.
    navigation.replace('Reward');
  };

  const submit = async () => {
    if (!imageUri || submitting.current) return; // guard double-taps
    submitting.current = true;
    setPhase({ kind: 'checking' });
    try {
      const outcome = demoMode ? await verifyDemo(demoOutcome) : await verifyWithServer(entry.quest, entry.landmark.name, imageUri);
      handleOutcome(outcome);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ScreenShell title={t('verify.title')} subtitle={entry.quest.title} back>
      <Notice
        tone={demoMode ? 'demo' : 'info'}
        icon={demoMode ? 'flask-outline' : 'shield-check-outline'}
        text={
          demoMode
            ? 'Demo mode: the check is simulated and your photo never leaves this device.'
            : 'Your photo is checked by Google Gemini on Thaw’s server for this quest only and isn’t stored. Location data is stripped before upload.'
        }
      />

      <Card tint={colors.white} style={{ gap: spacing.sm }}>
        <Text style={type.tiny}>WHAT TO CAPTURE</Text>
        <Text style={type.body}>{entry.quest.evidence}</Text>
        <Text style={type.small}>No faces needed. Only photograph people who have said yes. Screenshots won’t pass.</Text>
      </Card>

      {phase.kind === 'checking' ? (
        <Card tint={colors.butterSoft} style={styles.checking}>
          <Critter hue={hue} size={80} mood="wow" />
          <Text style={type.heading} accessibilityLiveRegion="polite">
            {t('verify.checking')}
          </Text>
          <Text style={type.small}>{demoMode ? 'Running the simulated demo check.' : 'Gemini is looking at your photo…'}</Text>
        </Card>
      ) : imageUri ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.polaroid}>
            <Image source={{ uri: imageUri }} style={styles.photo} accessibilityLabel="Your evidence photo" resizeMode="cover" />
            <Text style={styles.caption} numberOfLines={1}>
              {entry.landmark.name}
            </Text>
          </View>
          <View style={styles.row}>
            <Button label={t('verify.retake')} icon="camera-retake-outline" variant="secondary" compact onPress={() => void pick('camera')} style={{ flex: 1 }} />
            <Button label="Pick another" icon="image-multiple" variant="secondary" compact onPress={() => void pick('library')} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable style={styles.bigPick} onPress={() => void pick('camera')} accessibilityRole="button" accessibilityLabel={t('verify.camera')}>
            <MaterialCommunityIcons name="camera" size={36} color={colors.ink} />
            <Text style={type.subheading}>{t('verify.camera')}</Text>
          </Pressable>
          <Pressable style={[styles.bigPick, { backgroundColor: colors.skySoft }]} onPress={() => void pick('library')} accessibilityRole="button" accessibilityLabel={t('verify.library')}>
            <MaterialCommunityIcons name="image-multiple" size={36} color={colors.ink} />
            <Text style={type.subheading}>{t('verify.library')}</Text>
          </Pressable>
        </View>
      )}

      {pickError && <Notice tone="warn" icon="alert-circle-outline" text={pickError} />}

      {phase.kind === 'rejected' && (
        <Card tint={colors.sunsetSoft} style={{ gap: spacing.xs }}>
          <Text style={type.heading}>{t('verify.rejected')}</Text>
          <Text style={type.body}>{phase.feedback}</Text>
          {phase.observations && <Text style={type.small}>Seen: {phase.observations}</Text>}
        </Card>
      )}
      {phase.kind === 'error' && <Notice tone="warn" icon="alert-circle-outline" text={phase.message} />}

      {demoMode && phase.kind !== 'checking' && (
        <Card tint={colors.paper} style={{ gap: spacing.xs }}>
          <Text style={type.tiny}>DEMO: NEXT SIMULATED RESULT</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {(['accept', 'reject'] as const).map((o) => (
              <Pressable
                key={o}
                onPress={() => setDemoOutcome(o)}
                accessibilityRole="radio"
                accessibilityLabel={o === 'accept' ? 'Simulate acceptance' : 'Simulate rejection to test retry'}
                accessibilityState={{ checked: demoOutcome === o }}
                style={[styles.segBtn, demoOutcome === o && { backgroundColor: o === 'accept' ? colors.grass : colors.sunset }]}
              >
                <Text style={styles.segText}>{o === 'accept' ? 'Accept' : 'Reject (test retry)'}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {phase.kind !== 'checking' && !(phase.kind === 'error' && !phase.canRetry) && (
        <Button
          label={phase.kind === 'rejected' || phase.kind === 'error' ? t('verify.retry') : t('verify.submit')}
          icon="send"
          variant="sunset"
          disabled={!imageUri}
          onPress={() => void submit()}
          accessibilityHint={imageUri ? undefined : 'Take or choose a photo first'}
        />
      )}
      {phase.kind === 'error' && !phase.canRetry && <Button label="Back to the map" variant="secondary" onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })} />}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  bigPick: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.ink,
    backgroundColor: colors.butterSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  polaroid: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    paddingBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    transform: [{ rotate: '-1.5deg' }],
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 3, backgroundColor: colors.paperDeep },
  caption: { position: 'absolute', bottom: 6, left: 12, right: 12, fontFamily: fonts.display, fontSize: 15, color: colors.inkSoft },
  checking: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  segment: { flexDirection: 'row', gap: spacing.xs },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radii.md, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  segText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
});
