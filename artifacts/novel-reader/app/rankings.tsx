import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';

export default function RankingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, setActiveBook } = useReader();
  const { history, readingSessions } = useApp();

  const rankedBooks = useMemo(() => {
    const activity = new Map<string, { opens: number; sessions: number; minutes: number }>();
    history.forEach((entry) => {
      const current = activity.get(entry.bookId) ?? { opens: 0, sessions: 0, minutes: 0 };
      activity.set(entry.bookId, { ...current, opens: current.opens + 1 });
    });
    readingSessions.forEach((session) => {
      const current = activity.get(session.bookId) ?? { opens: 0, sessions: 0, minutes: 0 };
      activity.set(session.bookId, { ...current, sessions: current.sessions + 1, minutes: current.minutes + session.durationMs / 60_000 });
    });
    return books
      .map((book) => {
        const stats = activity.get(book.id) ?? { opens: 0, sessions: 0, minutes: 0 };
        return { book, stats, score: stats.opens * 10 + stats.sessions * 3 + stats.minutes };
      })
      .sort((left, right) => right.score - left.score || left.book.title.localeCompare(right.book.title));
  }, [books, history, readingSessions]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Rankings" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>Your reading activity</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Most opened on this device.</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>Prime Novel keeps this list local until a shared reader analytics service is connected. Nothing here is presented as a global popularity claim.</Text>
        </View>
        {rankedBooks.length > 0 ? (
          <View style={[styles.list, { borderTopColor: colors.border }]}>
            {rankedBooks.map(({ book, stats }, index) => (
              <Pressable
                key={book.id}
                onPress={() => { setActiveBook(book.id); router.push('/chapters'); }}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
              >
                <Text style={[styles.rank, { color: colors.primary }]}>{String(index + 1).padStart(2, '0')}</Text>
                <BookCover source={book.cover} width={48} height={70} favorite={book.favorite} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
                  <Text style={[styles.bookMeta, { color: colors.mutedForeground }]}>{stats.opens} opens · {stats.sessions} reading sessions</Text>
                </View>
                <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Feather name="bar-chart-2" size={20} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your rankings will build as you read.</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Open a novel and start reading to see activity here.</Text>
            <Pressable onPress={() => router.push('/discover')} style={({ pressed }) => [styles.emptyAction, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}>
              <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>Discover novels</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 24, gap: 8 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { fontFamily: 'Georgia', fontSize: 27, lineHeight: 32 },
  copy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, maxWidth: 500 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 94, paddingHorizontal: 22, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 23, fontFamily: 'Inter_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  rowCopy: { flex: 1, gap: 6 },
  bookTitle: { fontFamily: 'Georgia', fontSize: 16, lineHeight: 20 },
  bookMeta: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 64, gap: 10 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 18, textAlign: 'center' },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyAction: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', marginTop: 8 },
  emptyActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
