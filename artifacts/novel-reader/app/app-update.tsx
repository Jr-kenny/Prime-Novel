import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';
import { compareAppVersions, currentAppVersion, fetchAppRelease, platformRelease, releaseUrl, type AppRelease } from '@/utils/app-updates';
import { createPreUpdateBackup } from '@/utils/data-recovery';

type UpdateState = 'idle' | 'checking' | 'current' | 'available' | 'error';

const installerFlags = 1;

function installerAction() {
  return 'android.intent.action.VIEW';
}

export default function AppUpdateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<UpdateState>('idle');
  const [release, setRelease] = useState<AppRelease>();
  const [message, setMessage] = useState<string>();
  const version = Constants.expoConfig?.version ?? currentAppVersion();

  const checkForUpdates = useCallback(async () => {
    setState('checking');
    setMessage(undefined);
    try {
      const nextRelease = await fetchAppRelease();
      setRelease(nextRelease);
      setState(compareAppVersions(nextRelease.version, version) > 0 ? 'available' : 'current');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'The update check could not be completed.');
    }
  }, [version]);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  const downloadUpdate = async () => {
    if (!release) return;
    const target = platformRelease(release);
    if (!target?.url) {
      setMessage(Platform.OS === 'ios' ? 'The iOS release is not available yet.' : 'No download is attached to this release.');
      return;
    }

    const url = releaseUrl(target.url);
    if (Platform.OS !== 'android' || !FileSystem.documentDirectory) {
      await Linking.openURL(url);
      return;
    }

    setState('checking');
    setMessage('Downloading the update');
    try {
      await createPreUpdateBackup();
      const directory = `${FileSystem.documentDirectory}prime-novel/updates/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const destination = `${directory}Prime-Novel-${release.version}.apk`;
      const result = await FileSystem.downloadAsync(url, destination);
      if (result.status < 200 || result.status >= 300) throw new Error(`Download returned ${result.status}.`);
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync(installerAction(), {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: installerFlags,
      });
      setState('available');
      setMessage('Android opened the installer. Approve the update there.');
    } catch (error) {
      setState('available');
      setMessage(error instanceof Error ? error.message : 'The update download could not be completed.');
    }
  };

  const statusCopy = state === 'checking'
    ? 'Checking Prime Novel releases'
    : state === 'current'
      ? `You’re running the latest release, ${version}.`
      : state === 'available'
        ? `Prime Novel ${release?.version ?? 'new'} is ready to download.`
        : state === 'error'
          ? message ?? 'The update check could not be completed.'
          : 'Prime Novel checks for a newer release when you open this screen.';

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
            <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>{statusCopy}</Text>
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
          <Pressable accessibilityRole="button" onPress={() => void downloadUpdate()} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}>
            <Text style={[styles.primaryActionText, { color: colors.primaryForeground }]}>Download update</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" disabled={state === 'checking'} onPress={() => void checkForUpdates()} style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border, opacity: state === 'checking' ? 0.45 : pressed ? 0.72 : 1 }]}>
          <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>{state === 'checking' ? 'Checking' : 'Check for app updates'}</Text>
        </Pressable>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Android will ask you to approve the downloaded APK before installing it. Your library, reading progress, and downloads stay on the phone.</Text>
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
  versionCopy: { flex: 1, gap: 4 },
  cardLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.3 },
  version: { fontFamily: 'Georgia', fontSize: 20 },
  cardCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  notesCard: { borderWidth: 1, borderRadius: 18, padding: 17, gap: 8 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  message: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  primaryAction: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  secondaryAction: { minHeight: 50, borderWidth: 1, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, paddingHorizontal: 4 },
  backAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  backActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
