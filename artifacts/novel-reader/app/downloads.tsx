import { Feather } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';
import { useCatalog } from '@/context/CatalogContext';

export default function DownloadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { downloads, removeDownload } = useCatalog();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Downloads" />
      {downloads.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: insets.bottom + 40 }]}>
          <Feather name="download" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No downloads yet</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          data={downloads}
          keyExtractor={(download) => download.key}
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
  row: { minHeight: 72, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, gap: 5 },
  title: { fontFamily: 'Georgia', fontSize: 15 },
  chapter: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});
