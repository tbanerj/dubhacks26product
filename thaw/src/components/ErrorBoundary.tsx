import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Critter } from './Critter';

interface State {
  error: Error | null;
}

/** Last line of defence: a friendly recovery screen instead of a white screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('Thaw crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Critter hue={28} size={96} mood="sleepy" />
        <Text style={styles.title}>Thaw slipped on some ice.</Text>
        <Text style={styles.body}>Something went wrong on this screen. Your progress is saved.</Text>
        <Button
          label="Try again"
          icon="refresh"
          onPress={() => {
            this.props.onReset?.();
            this.setState({ error: null });
          }}
        />
      </View>
    );
  }
}

// System fonts here on purpose: custom fonts may be what failed.
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.paper },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
});
