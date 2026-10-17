import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { haptic } from '../utils/haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { isPerceptronConfigured, verifyEvidence, type EvidenceImage } from '../services/perceptron';
import type { VerificationResult } from '../types';
import { t } from '../i18n/strings';

type Phase = { kind: 'capture' } | { kind: 'checking' } | { kind: 'rejected'; result: VerificationResult } | { kind: 'error'; message: string };

export function VerifyScreen({ navigation }: RootScreenProps<'Verify'>) {
  const world = useWorld();
  const active = useGameStore((s) => s.activeQuest);
  const demoMode = useGameStore((s) => s.settings.demoMode);
  const completeActiveQuest = useGameStore((s) => s.completeActiveQuest);
  const [image, setImage] = useState<EvidenceImage | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'capture' });
  const [pickError, setPickError] = useState<string | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<'accept' | 'reject'>('accept');
  const submitting = useRef(false);
  const live = isPerceptronConfigured();

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
        setPickError(source === 'camera' ? 'Camera permission is off. You can choose a photo from your library instead, or enable it in Settings.' : 'Photo access is off. Enable it in Settings, or use the camera.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: live, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset) return;
      setImage({ uri: asset.uri, base64: asset.base64 ?? null, mimeType: asset.mimeType ?? 'image/jpeg' });
      setPhase({ kind: 'capture' });
    } catch (e) {
      setPickError(source === 'camera' ? 'The camera isn’t available here (simulators have none). Try choosing a photo instead.' : `Couldn’t open photos: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const submit = async () => {
    if (!image || submitting.current) return; // guard double-taps
    submitting.current = true;
    setPhase({ kind: 'checking' });
    try {
      const res = await verifyEvidence({ quest: entry.quest, landmarkName: entry.landmark.name, image }, { demoOutcome });
      if (!res.ok) {
        setPhase({ kind: 'error', message: res.error.message });
        return;
      }
      if (!res.result.accepted) {
        haptic.warning();
        setPhase({ kind: 'rejected', result: res.result });
        return;
      }
      const done = completeActiveQuest(res.result);
      if (done.ok) {
        haptic.success();
        setImage(null); // drop the photo reference; Thaw doesn't keep evidence photos
        navigation.replace('Reward');
      } else {
        setPhase({ kind: 'error', message: done.reason === 'duplicate' ? 'This quest was already completed – rewards are only granted once.' : 'This quest is no longer active.' });
      }
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ScreenShell title={t('verify.title')} subtitle={entry.quest.title} back>
      <Notice tone={live ? 'info' : 'demo'} icon={live ? 'shield-check-outline' : 'flask-outline'} text={live ? t('verify.liveNote') : t('verify.demoNote')} />

      <Card tint={colors.white} style={{ gap: spacing.sm }}>
        <Text style={type.tiny}>WHAT TO CAPTURE</Text>
        <Text style={type.body}>{entry.quest.evidence}</Text>
        <Text style={type.small}>No faces needed. Only photograph people who have said yes.</Text>
      </Card>

      {phase.kind === 'checking' ? (
        <Card tint={colors.butterSoft} style={styles.checking}>
          <Critter hue={useGameStore.getState().player.avatarHue} size={80} mood="wow" />
          <Text style={type.heading} accessibilityLiveRegion="polite">
            {t('verify.checking')}
          </Text>
          <Text style={type.small}>{live ? 'Asking Perceptron to look at your photo.' : 'Running the simulated demo check.'}</Text>
        </Card>
      ) : image ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.polaroid}>
            <Image source={{ uri: image.uri }} style={styles.photo} accessibilityLabel="Your evidence photo" resizeMode="cover" />
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
          <Text style={type.body}>{phase.result.feedback}</Text>
          {phase.result.observations && <Text style={type.small}>Seen: {phase.result.observations}</Text>}
        </Card>
      )}
      {phase.kind === 'error' && <Notice tone="warn" icon="wifi-off" text={`${phase.message} Your photo is still here – try again.`} />}

      {!live && demoMode && phase.kind !== 'checking' && (
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

      {phase.kind !== 'checking' && (
        <Button
          label={phase.kind === 'rejected' || phase.kind === 'error' ? t('verify.retry') : t('verify.submit')}
          icon="send"
          variant="sunset"
          disabled={!image}
          onPress={() => void submit()}
          accessibilityHint={image ? undefined : 'Take or choose a photo first'}
        />
      )}
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
