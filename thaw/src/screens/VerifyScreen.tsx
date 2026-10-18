import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haptic } from '../utils/haptics';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState, Notice } from '../components/Paper';
import { Button, IconButton } from '../components/Button';
import { useTheme } from '../theme/useTheme';
import { isLiveVerificationConfigured, verifyEvidence, type EvidenceImage } from '../services/gemini';
import type { VerificationResult } from '../types';
import { t } from '../i18n/strings';

type Phase = { kind: 'capture' } | { kind: 'checking' } | { kind: 'rejected'; result: VerificationResult } | { kind: 'error'; message: string };

export function VerifyScreen({ navigation }: RootScreenProps<'Verify'>) {
  const insets = useSafeAreaInsets();
  const { colors, type } = useTheme();
  const world = useWorld();
  const active = useGameStore((s) => s.activeQuest);
  const demoMode = useGameStore((s) => s.settings.demoMode);
  const account = useGameStore((s) => s.account);
  const completeActiveQuest = useGameStore((s) => s.completeActiveQuest);
  const recordLiveReward = useGameStore((s) => s.recordLiveReward);
  const setPendingEvidenceUri = useGameStore((s) => s.setPendingEvidenceUri);
  const [image, setImage] = useState<EvidenceImage | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'capture' });
  const [pickError, setPickError] = useState<string | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<'accept' | 'reject'>('accept');
  const submitting = useRef(false);
  const live = isLiveVerificationConfigured();

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
        setPickError(source === 'camera' ? 'Camera permission is off. You can choose a photo from your library, or enable the camera in Settings.' : 'Photo access is off. Enable it in Settings, or use the camera.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: live, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset) return;
      setImage({ uri: asset.uri, base64: asset.base64 ?? null, mimeType: asset.mimeType ?? 'image/jpeg' });
      if (phase.kind === 'rejected' || phase.kind === 'error') setPhase({ kind: 'capture' });
    } catch (e) {
      setPickError(source === 'camera' ? 'The camera isn’t available here. Try a photo from your library.' : `Couldn’t open photos: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const submit = async () => {
    if (!image || submitting.current || phase.kind === 'checking') return;
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
      if (!demoMode && res.result.source !== 'gemini') {
        setPhase({ kind: 'error', message: res.result.feedback });
        return;
      }
      const done = account && res.result.source === 'gemini' ? await recordLiveReward(res.result) : completeActiveQuest(res.result);
      if (done.ok) {
        haptic.success();
        setPendingEvidenceUri(image.uri);
        navigation.replace('Reward');
      } else {
        const message =
          done.reason === 'duplicate'
            ? 'This quest was already completed. Rewards are only granted once.'
            : done.reason === 'rate-limited'
              ? 'Wait a few seconds between quests, then submit again.'
              : done.reason === 'daily-limit'
                ? 'You’ve hit today’s quest limit. Come back tomorrow for more.'
                : done.reason === 'network'
                  ? 'Couldn’t save this quest. Check your connection. Your photo is still here.'
                  : done.reason === 'auth'
                    ? 'Your session expired. Please sign in again.'
                    : 'This quest couldn’t be saved.';
        setPhase({ kind: 'error', message });
      }
    } finally {
      submitting.current = false;
    }
  };

  const instruction = entry.quest.evidence;

  return (
    <View style={[styles.root, { backgroundColor: '#121815' }]}>
      {image ? (
        <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} accessibilityLabel="Your evidence photo" resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <MaterialCommunityIcons name="camera-outline" size={36} color="#F4F3EC" />
        </View>
      )}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="close" label="Close" glass color="#1C2420" onPress={() => navigation.goBack()} />
        <View style={styles.instruction}>
          <Text style={[type.small, { color: '#1C2420', textAlign: 'center' }]} numberOfLines={2}>
            {instruction}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {phase.kind === 'checking' && (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={[type.bodyStrong, { color: '#1C2420' }]}>{t('verify.checking')}</Text>
            <Text style={[type.small, { color: '#1C2420' }]}>{live ? t('verify.checkingLive') : t('verify.checkingDemo')}</Text>
          </View>
        )}
        {phase.kind === 'rejected' && (
          <View style={styles.banner}>
            <Text style={[type.bodyStrong, { color: '#1C2420' }]}>{t('verify.rejected')}</Text>
            <Text style={[type.small, { color: '#1C2420' }]}>{phase.result.feedback}</Text>
          </View>
        )}
        {phase.kind === 'error' && <Notice tone="warn" text={`${phase.message} Your photo is still here.`} />}
        {pickError && <Notice tone="warn" text={pickError} />}
        <Text style={[type.tiny, { color: '#F4F3EC', textAlign: 'center' }]}>{live ? t('verify.liveNote') : t('verify.demoNote')}</Text>

        {!live && demoMode && phase.kind !== 'checking' && (
          <View style={styles.demoRow} accessibilityRole="radiogroup" accessibilityLabel="Demo verification result">
            {(['accept', 'reject'] as const).map((o) => (
              <Pressable key={o} onPress={() => setDemoOutcome(o)} accessibilityRole="radio" accessibilityState={{ checked: demoOutcome === o }} style={[styles.demoBtn, demoOutcome === o && { backgroundColor: colors.surface }]}>
                <Text style={[type.tiny, { color: demoOutcome === o ? colors.text : '#F4F3EC' }]}>{o === 'accept' ? 'Demo: accept' : 'Demo: reject'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {image && phase.kind !== 'checking' ? (
          <View style={styles.actions}>
            <Button label={t('verify.retake')} variant="secondary" onPress={() => void pick('camera')} style={{ flex: 1 }} />
            <Button label={phase.kind === 'rejected' || phase.kind === 'error' ? t('verify.retry') : t('verify.submit')} onPress={() => void submit()} style={{ flex: 1 }} />
          </View>
        ) : phase.kind !== 'checking' ? (
          <View style={styles.shutterRow}>
            <Pressable onPress={() => void pick('library')} accessibilityRole="button" accessibilityLabel={t('verify.library')} style={styles.side}>
              <MaterialCommunityIcons name="image-outline" size={26} color="#F4F3EC" />
            </Pressable>
            <Pressable onPress={() => void pick('camera')} accessibilityRole="button" accessibilityLabel={t('verify.camera')} style={[styles.shutter, { borderColor: '#F4F3EC' }]}>
              <View style={[styles.shutterCore, { backgroundColor: colors.surface }]} />
            </Pressable>
            <View style={styles.side} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  instruction: { flex: 1, backgroundColor: 'rgba(248,248,243,0.92)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, gap: 10 },
  banner: { backgroundColor: 'rgba(248,248,243,0.94)', borderRadius: 16, padding: 12, gap: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 58, height: 58, borderRadius: 29 },
  demoRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  demoBtn: { minHeight: 36, paddingHorizontal: 10, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
