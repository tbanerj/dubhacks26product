import React, { useCallback, useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Localization from 'expo-localization';
import type { RootScreenProps } from '../navigation/types';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../components/Button';
import { Card, Notice, SettingsRow } from '../components/Paper';
import { useTheme } from '../theme/useTheme';
import { photonApiConfigured, messagingRequest, type MessagingView } from '../services/messagingApi';

const WEEKDAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

export function PlayByTextScreen(_props: RootScreenProps<'PlayByText'>) {
  const { colors, type } = useTheme();
  const [view, setView] = useState<MessagingView | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const zone = Localization.getCalendars()[0]?.timeZone ?? 'America/Los_Angeles';

  const load = useCallback(async () => {
    if (!photonApiConfigured()) return;
    try {
      const next = await messagingRequest('/api/me/messaging');
      setView(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach Thaw text.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!photonApiConfigured()) {
    return (
      <ScreenShell title="Play by text" back>
        <Notice tone="warn" text="Set EXPO_PUBLIC_PHOTON_API_URL to the Photon service, then restart Expo. The Photon secret stays on that service." />
      </ScreenShell>
    );
  }

  const prefs = view?.preferences;
  const selected = new Set((prefs?.weekdays ?? '1,3,5').split(',').map((day) => Number(day)));

  return (
    <ScreenShell title="Play by text" back>
      <Text style={type.body}>
        Text Thaw from the iMessage identity registered on the Photon project. The number can be different for each person. Thaw does not use one public number.
      </Text>
      {error ? <Notice tone="warn" text={error} /> : null}
      <Card style={{ gap: 8 }}>
        <Text style={type.bodyStrong}>{view?.linked ? 'Linked' : 'Not linked'}</Text>
        <Text style={type.small}>{view?.maskedSender ? `Messages identity ${view.maskedSender}` : 'No Messages identity confirmed yet.'}</Text>
        {view?.servingLineHint ? <Text style={type.small}>Last serving line ended in {view.servingLineHint}.</Text> : null}
        {code ? <Text selectable style={type.heading}>{code}</Text> : null}
        <Button
          label="Get a link code"
          loading={busy}
          onPress={() =>
            void run(async () => {
              const issued = await messagingRequest('/api/me/messaging/link-token', { method: 'POST', body: {} });
              if (!issued.code) throw new Error('No code came back.');
              setCode(issued.code);
            })
          }
        />
        <Button
          label="I sent the code"
          variant="secondary"
          disabled={!code || busy}
          onPress={() =>
            void run(async () => {
              const confirmed = await messagingRequest('/api/me/messaging/link-confirm', { method: 'POST', body: {} });
              if (confirmed.ok === false) throw new Error(confirmed.error ?? 'Not confirmed yet.');
              setCode(null);
            })
          }
        />
        {code ? (
          <Button
            label="Share the instruction"
            variant="ghost"
            onPress={() => void Share.share({ message: `Text LINK ${code} to the Thaw line for your registered iMessage user.` })}
          />
        ) : null}
      </Card>

      {view?.linked && prefs ? (
        <>
          <Text style={type.tiny}>REMINDERS</Text>
          <Card style={{ gap: 8 }}>
            <Text style={type.small}>
              Optional. Three prompts a week, Monday Wednesday Friday at 4 PM, quiet hours 8 PM to 10 AM, in {prefs.timezone}. Starting a quest does not turn these on.
            </Text>
            <SettingsRow
              icon="message-text-outline"
              label="Adventure prompts"
              hint={prefs.nextDueAt ? `Next eligible ${prefs.nextDueAt}` : 'Off until you enable them'}
              control={
                <Switch
                  value={prefs.remindersEnabled}
                  disabled={busy}
                  onValueChange={(enabled) =>
                    void run(async () => {
                      await messagingRequest('/api/me/messaging/preferences', {
                        method: 'PATCH',
                        body: { remindersEnabled: enabled, timezone: prefs.timezone || zone },
                      });
                    })
                  }
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                />
              }
            />
            <View style={styles.days}>
              {WEEKDAYS.map((day) => {
                const on = selected.has(day.id);
                return (
                  <Text
                    key={day.id}
                    onPress={() => {
                      const next = new Set(selected);
                      if (on) next.delete(day.id);
                      else next.add(day.id);
                      if (next.size === 0) return;
                      void run(async () => {
                        await messagingRequest('/api/me/messaging/preferences', {
                          method: 'PATCH',
                          body: { weekdays: [...next].sort() },
                        });
                      });
                    }}
                    style={[styles.day, type.small, { color: on ? colors.onPrimary : colors.textSecondary, backgroundColor: on ? colors.primary : colors.surfaceMuted }]}
                  >
                    {day.label}
                  </Text>
                );
              })}
            </View>
            <Text style={type.small}>
              Quiet hours {prefs.quietStart}–{prefs.quietEnd}. Time {prefs.localTime}. {prefs.pauseUntil ? `Paused until ${prefs.pauseUntil}.` : 'Not paused.'}
            </Text>
            <Button label="Pause 1 day" variant="secondary" onPress={() => void run(() => messagingRequest('/api/me/messaging/preferences', { method: 'PATCH', body: { pauseDays: 1 } }).then(() => undefined))} />
            <Button label="Pause 3 days" variant="secondary" onPress={() => void run(() => messagingRequest('/api/me/messaging/preferences', { method: 'PATCH', body: { pauseDays: 3 } }).then(() => undefined))} />
            <Button label="Pause 1 week" variant="secondary" onPress={() => void run(() => messagingRequest('/api/me/messaging/preferences', { method: 'PATCH', body: { pauseDays: 7 } }).then(() => undefined))} />
            <Button label="Resume" variant="ghost" onPress={() => void run(() => messagingRequest('/api/me/messaging/preferences', { method: 'PATCH', body: { resume: true } }).then(() => undefined))} />
            <Button
              label="Disconnect"
              variant="danger"
              onPress={() =>
                void run(async () => {
                  await messagingRequest('/api/me/messaging/link', { method: 'DELETE' });
                })
              }
            />
          </Card>
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, overflow: 'hidden' },
});
