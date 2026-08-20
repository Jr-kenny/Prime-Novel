import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';

function recoveredTitle(bookId: string) {
  const value = bookId.includes('http') ? bookId.slice(bookId.indexOf('http')) : bookId;
  try {
    const url = new URL(value);
    const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname;
    return decodeURIComponent(segment).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Recovered novel';
  }
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, hydrated: appHydrated } = useApp();
  const { books, hydrated: readerHydrated, setActiveBook, setActiveChapter } = useReader();
  const entries = history.map((entry) => ({ entry, book: books.find((book) => book.id === entry.bookId) }));

  const openEntry = (bookId: string, chapter: number) => {
    setActiveBook(bookId);
    setActiveChapter(chapter, bookId);
    router.push('/reader');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="History" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {!appHydrated || !readerHydrated ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Loading saved history</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="clock" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
          </View>
        ) : (
          <View style={[styles.list, { borderTopColor: colors.border }]}>
            {entries.map(({ entry, book }) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                disabled={!book}
                onPress={() => openEntry(entry.bookId, entry.chapter)}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
              >
                {book || entry.bookCover ? <BookCover source={book?.cover ?? entry.bookCover!} width={42} height={62} favorite={book?.favorite} /> : (
                  <View style={[styles.recoveredCover, { backgroundColor: colors.secondary }]}>
                    <Feather name="book-open" size={18} color={colors.primary} />
                  </View>
                )}
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{book?.title ?? entry.bookTitle ?? recoveredTitle(entry.bookId)}</Text>
                  <Text style={[styles.chapter, { color: colors.mutedForeground }]} numberOfLines={1}>Chapter {entry.chapter}</Text>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.openedAt)}</Text>
                </View>
                {book ? <Feather name="chevron-right" size={17} color={colors.mutedForeground} /> : <Text style={[styles.recovered, { color: colors.mutedForeground }]}>Recover from More</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 78, paddingHorizontal: 22, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 4 },
  recoveredCover: { width: 42, height: 62, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  recovered: { fontFamily: 'Inter_500Medium', fontSize: 9 },
  title: { fontFamily: 'Georgia', fontSize: 15 },
  chapter: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  time: { fontFamily: 'Inter_400Regular', fontSize: 10 },
});
