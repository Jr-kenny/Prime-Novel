import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';
import { inspectRecoverableData, recoverSavedData, type RecoveryPreview } from '@/utils/data-recovery';

export default function DataRecoveryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<RecoveryPreview>();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void inspectRecoverableData()
      .then(setPreview)
      .catch(() => setMessage('Prime Novel could not inspect the saved records safely.'))
      .finally(() => setBusy(false));
  }, []);

  const recover = async () => {
    if (!preview || busy) return;
    const recoverable = preview.recoverableBooks + preview.recoverableHistory + preview.recoverableDownloads;
    if (recoverable === 0) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await recoverSavedData();
      setMessage('Saved records were restored. Close Prime Novel completely and open it again to reload them.');
      setPreview(await inspectRecoverableData());
    } catch {
      setMessage('Recovery stopped without deleting anything. Your existing records were left untouched.');
    } finally {
      setBusy(false);
    }
  };

  const recoverable = preview ? preview.recoverableBooks + preview.recoverableHistory + preview.recoverableDownloads : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
      <SubscreenHeader eyebrow="PRIME NOVEL" title="Recover saved data" />
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="archive" size={22} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Your existing data comes first</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>Prime Novel checks its protected backups, earlier download records, and reading history. Recovery only fills empty areas and won’t replace records that are already visible.</Text>
        </View>

        {busy && !preview ? <ActivityIndicator color={colors.primary} /> : null}
        {preview ? (
          <View style={[styles.summary, { borderColor: colors.border }]}>
            <Text style={[styles.row, { color: colors.foreground }]}>Library: {preview.currentBooks} visible, {preview.recoverableBooks} recoverable</Text>
            <Text style={[styles.row, { color: colors.foreground }]}>History: {preview.currentHistory} visible, {preview.recoverableHistory} recoverable</Text>
            <Text style={[styles.row, { color: colors.foreground }]}>Downloads: {preview.currentDownloads} visible, {preview.recoverableDownloads} recoverable</Text>
          </View>
        ) : null}

        {message ? <Text style={[styles.message, { color: colors.foreground }]}>{message}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || recoverable === 0}
          onPress={() => void recover()}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.primary, opacity: busy || recoverable === 0 ? 0.45 : pressed ? 0.78 : 1 }]}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{recoverable > 0 ? 'Recover saved data' : 'No hidden records found'}</Text>}
        </Pressable>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Don’t clear app storage or uninstall Prime Novel before running recovery.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 16 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 9 },
  title: { fontFamily: 'Georgia', fontSize: 20 },
  copy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  summary: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, gap: 9 },
  row: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  message: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  action: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
