import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { useGameStore } from '../store/useGameStore';
import * as Auth from '../services/auth';
import { isSupabaseConfigured } from '../config/env';

export type AuthMode = 'signIn' | 'signUp' | 'checkEmail' | 'forgot' | 'newPassword';

function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const { colors, type, radii, spacing } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={type.bodyStrong}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        style={{
          minHeight: 48,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingRight: 48,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.bg,
        }}
      />
      {error ? (
        <Text style={[type.small, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function AuthScreen({ navigation, route }: RootScreenProps<'Auth'>) {
  const { colors, type, spacing } = useTheme();
  const [mode, setMode] = useState<AuthMode>(route.params?.mode ?? 'signIn');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(route.params?.message ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const hue = useGameStore((s) => s.player.avatarHue);

  const emailErr = touched ? Auth.validateEmail(email) : null;
  const pwErr = touched && (mode === 'signUp' || mode === 'newPassword') ? Auth.validatePassword(password) : null;
  const nameErr = touched && mode === 'signUp' ? Auth.validateDisplayName(name) : null;

  const go = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setTouched(false);
    setPassword('');
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setTouched(true);
    if (mode === 'signIn') {
      if (Auth.validateEmail(email) || !password) return;
      void run(async () => {
        const r = await Auth.signIn(email, password);
        if (r.ok) return;
        if (r.code === 'email_not_confirmed') go('checkEmail');
        else setError(r.error);
      });
    } else if (mode === 'signUp') {
      if (Auth.validateEmail(email) || Auth.validatePassword(password) || Auth.validateDisplayName(name)) return;
      void run(async () => {
        const r = await Auth.signUp(email, password, name);
        if (!r.ok) setError(r.error);
        else if (r.data.needsConfirmation) go('checkEmail');
      });
    } else if (mode === 'forgot') {
      if (Auth.validateEmail(email)) return;
      void run(async () => {
        const r = await Auth.sendPasswordReset(email);
        if (r.ok) setInfo('If an account exists for that email, a reset link is on its way. Open it on this device.');
        else setError(r.error);
      });
    } else if (mode === 'newPassword') {
      if (Auth.validatePassword(password)) return;
      void run(async () => {
        const r = await Auth.updatePassword(password);
        if (r.ok) {
          setInfo('Password updated. You’re signed in.');
          setTimeout(() => navigation.goBack(), 900);
        } else setError(r.error);
      });
    }
  };

  const resend = () =>
    void run(async () => {
      const r = await Auth.resendConfirmation(email);
      if (r.ok) setInfo('Sent. Check your inbox, including spam.');
      else setError(r.error);
    });

  if (!isSupabaseConfigured()) {
    return (
      <ScreenShell title="Accounts" back>
        <Notice tone="warn" text="Accounts aren’t configured in this build. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env and restart with npx expo start -c." />
      </ScreenShell>
    );
  }

  const titles: Record<AuthMode, [string, string]> = {
    signIn: ['Welcome back', 'Log in to keep exploring.'],
    signUp: ['Create your explorer', 'One account keeps your pins, XP and parties on every device.'],
    checkEmail: ['Check your inbox', 'One quick step to prove it’s really you.'],
    forgot: ['Reset password', 'We’ll email you a link.'],
    newPassword: ['Choose a new password', 'Make it something only you know.'],
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell title={titles[mode][0]} subtitle={titles[mode][1]} back keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.avatar, { backgroundColor: colors.sageSoft }]}>
            <Critter hue={hue} size={76} mood={mode === 'checkEmail' ? 'wow' : 'happy'} />
          </View>
        </View>

        {mode === 'checkEmail' ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <MaterialCommunityIcons name="email-check-outline" size={28} color={colors.primary} />
              <Text style={[type.body, { flex: 1 }]}>
                We sent a verification link to <Text style={type.bodyStrong}>{email.trim() || 'your email'}</Text>. Tap it to confirm your address.
              </Text>
            </View>
            <Text style={type.small}>Opened the link on another device? Your email is still verified. Come back and sign in.</Text>
            <Button label="I’ve verified – sign in" icon="login" onPress={() => go('signIn')} />
            <Button label="Resend email" icon="email-sync-outline" variant="secondary" compact onPress={resend} loading={busy} disabled={!!Auth.validateEmail(email)} />
          </Card>
        ) : (
          <Card style={{ gap: spacing.md }}>
            {mode === 'signUp' && (
              <Field label="Explorer name" value={name} onChangeText={setName} placeholder="Explorer" maxLength={24} autoCapitalize="words" textContentType="nickname" error={nameErr} />
            )}
            {mode !== 'newPassword' && (
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                inputMode="email"
                error={emailErr}
                returnKeyType={mode === 'forgot' ? 'send' : 'next'}
                onSubmitEditing={mode === 'forgot' ? submit : undefined}
              />
            )}
            {(mode === 'signIn' || mode === 'signUp' || mode === 'newPassword') && (
              <View>
                <Field
                  label={mode === 'newPassword' ? 'New password' : 'Password'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  maxLength={72}
                  error={pwErr}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eye} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'} hitSlop={8}>
                  <MaterialCommunityIcons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
                </Pressable>
                {mode !== 'signIn' && !pwErr && <Text style={type.small}>At least {Auth.MIN_PASSWORD} characters, with letters and numbers.</Text>}
              </View>
            )}

            {error && <Notice tone="warn" icon="alert-circle-outline" text={error} />}
            {info && <Notice icon="check-circle-outline" text={info} />}

            <Button
              label={mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save password'}
              icon={mode === 'signUp' ? 'account-plus' : mode === 'forgot' ? 'email-fast-outline' : 'login'}
              onPress={submit}
              loading={busy}
            />
            {mode === 'signIn' && <Button label="Forgot password?" variant="ghost" compact onPress={() => go('forgot')} />}
          </Card>
        )}

        {(mode === 'signIn' || mode === 'signUp') && (
          <View style={styles.switch}>
            <Text style={type.body}>{mode === 'signIn' ? 'New to Thaw?' : 'Already exploring?'}</Text>
            <Button label={mode === 'signIn' ? 'Create an account' : 'Sign in'} variant="secondary" compact onPress={() => go(mode === 'signIn' ? 'signUp' : 'signIn')} />
          </View>
        )}
        {(mode === 'forgot' || mode === 'checkEmail') && <Button label="Back to sign in" variant="ghost" compact onPress={() => go('signIn')} />}

        {(mode === 'signUp' || mode === 'checkEmail') && (
          <Text style={[type.small, { textAlign: 'center' }]}>By creating an account you agree to play safely: public places only, and never share personal contact details.</Text>
        )}
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  eye: { position: 'absolute', right: 12, top: 36, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
});
