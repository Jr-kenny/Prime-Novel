import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';
import { useCatalog } from '@/context/CatalogContext';
import { jobProgress, type DownloadJob } from '@/utils/download-jobs';

function JobRow({ job, onResume }: { job: DownloadJob; onResume: (job: DownloadJob) => void }) {
  const colors = useColors();
  const progress = jobProgress(job);
  const statusLabel = job.status === 'running'
    ? 'Downloading'
    : job.status === 'failed'
      ? 'Needs retry'
      : job.status === 'completed'
        ? 'Complete'
        : 'Interrupted';

  return (
    <View style={[styles.jobRow, { borderBottomColor: colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{job.novelTitle}</Text>
        <Text style={[styles.chapter, { color: colors.mutedForeground }]} numberOfLines={1}>
          {progress.completed}/{progress.total} chapters · {statusLabel}
          {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
        </Text>
      </View>
      {job.status !== 'completed' ? (
        <Pressable
          accessibilityLabel={`Resume download for ${job.novelTitle}`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onResume(job)}
          style={[styles.resumeButton, { borderColor: colors.border }]}
        >
          <Feather name="play" size={14} color={colors.primary} />
          <Text style={[styles.resumeLabel, { color: colors.primary }]}>Resume</Text>
        </Pressable>
      ) : (
        <Feather name="check-circle" size={18} color={colors.primary} />
      )}
    </View>
  );
}

export default function DownloadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { downloads, downloadsHydrated, removeDownload, downloadJobs, resumeInterruptedDownloads } = useCatalog();
  const activeJobs = downloadJobs.filter((job) => job.status !== 'completed');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Downloads" />
      {!downloadsHydrated ? (
        <View style={[styles.empty, { paddingBottom: insets.bottom + 40 }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Loading downloads</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          data={downloads}
          keyExtractor={(download) => download.key}
          ListHeaderComponent={activeJobs.length > 0 ? (
            <View>
              <Text style={[styles.section, { color: colors.mutedForeground }]}>IN PROGRESS</Text>
              {activeJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onResume={() => void resumeInterruptedDownloads()}
                />
              ))}
              <Text style={[styles.section, { color: colors.mutedForeground }]}>SAVED CHAPTERS</Text>
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={[styles.empty, { paddingBottom: insets.bottom + 40 }]}>
              <Feather name="download" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No downloads yet</Text>
              {activeJobs.length > 0 ? <Text style={[styles.chapter, { color: colors.mutedForeground }]}>Active downloads appear above.</Text> : null}
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{item.novelTitle}</Text>
                <Text style={[styles.chapter, { color: colors.mutedForeground }]} numberOfLines={1}>Chapter {item.chapter.number} · {item.chapter.title}</Text>
              </View>
              <Pressable accessibilityLabel={`Remove chapter ${item.chapter.number} download`} accessibilityRole="button" hitSlop={10} onPress={() => removeDownload(item.key)}>
                <Feather name="trash-2" size={17} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, paddingHorizontal: 22, marginTop: 18, marginBottom: 8 },
  row: { minHeight: 72, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  jobRow: { minHeight: 72, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, gap: 5 },
  title: { fontFamily: 'Georgia', fontSize: 15 },
  chapter: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  resumeButton: { minHeight: 34, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 6 },
  resumeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
