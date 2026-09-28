import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';
import type { AppRelease } from '@/utils/app-updates';
import {
  loadLastUpdateCheck,
  runUpdateCheck,
  updateStatusCopy,
  type UpdateCheckResult,
  type UpdateCheckState,
} from '@/utils/update-check';
import {
  downloadAndInstallUpdate,
  updateInstallPhaseCopy,
  type UpdateInstallPhase,
} from '@/utils/app-update-install';

type ScreenState = UpdateCheckState;

function statusBadge(state: ScreenState, result?: UpdateCheckResult): { label: string; tone: 'neutral' | 'positive' | 'warning' | 'danger' } {
  switch (state) {
    case 'checking':
      return { label: 'Checking for updates...', tone: 'neutral' };
    case 'up-to-date':
      return { label: "You're up to date", tone: 'positive' };
    case 'available':
      return { label: `Update available — Version ${result?.availableVersion ?? 'new'}`, tone: 'warning' };
    case 'error':
      return { label: 'Unable to check for updates', tone: 'danger' };
    default:
      return { label: 'Ready to check', tone: 'neutral' };
  }
}

export default function AppUpdateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ScreenState>('idle');
  const [result, setResult] = useState<UpdateCheckResult>();
  const [release, setRelease] = useState<AppRelease>();
  const [message, setMessage] = useState<string>();
  const [lastCheckedAt, setLastCheckedAt] = useState<number | undefined>();
  const [installPhase, setInstallPhase] = useState<UpdateInstallPhase>('idle');
  const [installProgress, setInstallProgress] = useState(0);
  const version = Constants.expoConfig?.version ?? result?.currentVersion ?? '1.0.0';

  const checkForUpdates = useCallback(async () => {
    setState('checking');
    setMessage(undefined);
    const next = await runUpdateCheck();
    setResult(next);
    setRelease(next.release);
    setLastCheckedAt(next.checkedAt);
    setState(next.state);
    if (next.state === 'error') {
      setMessage(next.errorMessage);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadLastUpdateCheck()
      .then((last) => {
        if (!cancelled && last?.checkedAt) setLastCheckedAt(last.checkedAt);
      })
      .catch(() => {});
    void checkForUpdates();
    return () => {
      cancelled = true;
    };
  }, [checkForUpdates]);

  const downloadAndInstall = async () => {
    if (!release || installPhase === 'downloading' || installPhase === 'installing' || installPhase === 'preparing') return;
    setInstallPhase('preparing');
    setInstallProgress(0);
    setMessage(undefined);
    const installResult = await downloadAndInstallUpdate(release, (progress) => {
      setInstallPhase(progress.phase);
      setInstallProgress(progress.progress);
      if (progress.message) setMessage(progress.message);
    });
    setInstallPhase(installResult.phase);
    if (installResult.message) setMessage(installResult.message);
  };

  const busy = installPhase === 'preparing' || installPhase === 'downloading' || installPhase === 'installing';
  const installCopy = installPhase === 'idle' && state === 'available'
    ? `Download Prime Novel ${release?.version ?? ''} and install it on this device.`
    : message ?? updateInstallPhaseCopy(installPhase);

  const badge = statusBadge(state, result);
  const statusCopy = updateStatusCopy(result ?? { state, currentVersion: version });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader eyebrow="PRIME NOVEL" title="App updates" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.versionIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="download-cloud" size={22} color={colors.primary} />
          </View>
          <View style={styles.versionCopy}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>CURRENT VERSION</Text>
            <Text style={[styles.version, { color: colors.foreground }]}>Prime Novel {version}</Text>
            <View style={[styles.badge, { backgroundColor: badge.tone === 'positive' ? colors.secondary : badge.tone === 'danger' ? colors.destructive : colors.secondary }]}>
              <Text style={[styles.badgeText, { color: badge.tone === 'danger' ? colors.destructiveForeground : colors.secondaryForeground }]}>{badge.label}</Text>
            </View>
            <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>{statusCopy}</Text>
            {lastCheckedAt ? (
              <Text style={[styles.checkedAt, { color: colors.mutedForeground }]}>
                Last checked {new Date(lastCheckedAt).toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>

        {release?.notes?.length ? (
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>WHAT’S NEW</Text>
            {release.notes.map((note) => <Text key={note} style={[styles.note, { color: colors.foreground }]}>• {note}</Text>)}
          </View>
        ) : null}

        {message && state !== 'error' ? <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text> : null}

        {state === 'available' ? (
          <View style={[styles.installCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.installTitle, { color: colors.foreground }]}>Update in the app</Text>
            <Text style={[styles.installCopy, { color: colors.mutedForeground }]}>{installCopy}</Text>
            {busy || installPhase === 'ready-to-install' || installPhase === 'installed' || installPhase === 'error' ? (
              <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: installPhase === 'error' ? colors.destructive : colors.primary,
                      width: `${Math.max(8, Math.round(installProgress * 100))}%`,
                    },
                  ]}
                />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Download and install update"
              disabled={busy}
              onPress={() => void downloadAndInstall()}
              style={({ pressed }) => [
                styles.primaryAction,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.55 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryActionText, { color: colors.primaryForeground }]}>
                {installPhase === 'preparing' || installPhase === 'downloading'
                  ? 'Downloading update...'
                  : installPhase === 'installing'
                    ? 'Opening installer...'
                    : installPhase === 'installed'
                      ? 'Installer opened'
                      : installPhase === 'error'
                        ? 'Try install again'
                        : 'Download and install'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" disabled={state === 'checking' || busy} onPress={() => void checkForUpdates()} style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border, opacity: state === 'checking' || busy ? 0.45 : pressed ? 0.72 : 1 }]}>
          <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>{state === 'checking' ? 'Checking for updates...' : 'Check for app updates'}</Text>
        </Pressable>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          {Platform.OS === 'android'
            ? 'Android will ask you to approve the install. Your library, reading progress, and downloads stay on the phone.'
            : 'After downloading, follow the install steps Apple provides for this release.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backAction}>
          <Text style={[styles.backActionText, { color: colors.primary }]}>Back to More</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 14 },
  versionCard: { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: 'row', gap: 13, alignItems: 'center' },
  versionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  versionCopy: { flex: 1, gap: 6 },
  cardLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.3 },
  version: { fontFamily: 'Georgia', fontSize: 20 },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  cardCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  checkedAt: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  notesCard: { borderWidth: 1, borderRadius: 18, padding: 17, gap: 8 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  installCard: { borderWidth: 1, borderRadius: 18, padding: 17, gap: 10 },
  installTitle: { fontFamily: 'Georgia', fontSize: 18 },
  installCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  message: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  primaryAction: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  secondaryAction: { minHeight: 50, borderWidth: 1, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, paddingHorizontal: 4 },
  backAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  backActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
