import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useReader } from '@/context/ReaderContext';

export default function UpdatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, setActiveBook } = useReader();
  const updated = books.filter((book) => book.newChapters);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="While you were away" title="Updates" action="settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {updated.length > 0 ? (
          <>
            <View style={styles.dayRow}><Text style={[styles.day, { color: colors.foreground }]}>New chapters</Text></View>
            {updated.map((book) => (
              <Pressable key={book.id} onPress={() => { setActiveBook(book.id); router.push('/chapters'); }} style={({ pressed }) => [styles.updateRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                <BookCover source={book.cover} width={48} height={68} favorite={book.favorite} />
                <View style={styles.updateCopy}>
                  <Text style={[styles.updateTitle, { color: colors.foreground }]}>{book.title}</Text>
                  <Text style={[styles.updateMeta, { color: colors.primary }]}>{book.newChapters} new chapters</Text>
                  <Text style={[styles.updateHint, { color: colors.mutedForeground }]}>Tap to open the first unread chapter</Text>
                </View>
                <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </>
        ) : (
          <View style={styles.empty}>
            <Feather name="bell-off" size={18} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No new chapters yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 72 },
  emptyText: { fontFamily: 'Georgia', fontSize: 16 },
  dayRow: { paddingHorizontal: 22, marginTop: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  day: { fontFamily: 'Georgia', fontSize: 19 },
  updateRow: { marginHorizontal: 22, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 14 },
  updateCopy: { flex: 1 },
  updateTitle: { fontFamily: 'Georgia', fontSize: 16 },
  updateMeta: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 5 },
  updateHint: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5 },
});
