import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { formatCount, formatReadingTime, isReadingBook, readChapterCount, unreadChapterCount, wordsReadForBook } from '@/utils/analytics';

function SectionTitle({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{children}</Text>;
}

function StatCell({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCell, { borderBottomColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books } = useReader();
  const { readingSessions } = useApp();

  const analytics = useMemo(() => {
    const totalReadingTime = readingSessions.reduce((sum, session) => sum + session.durationMs, 0);
    const totalReadChapters = books.reduce((sum, book) => sum + readChapterCount(book), 0);
    const totalUnreadChapters = books.reduce((sum, book) => sum + unreadChapterCount(book), 0);
    const genreCounts = new Map<string, number>();

    books.forEach((book) => {
      genreCounts.set(book.genre, (genreCounts.get(book.genre) ?? 0) + 1);
    });

    const topGenre = [...genreCounts.entries()].sort((left, right) => right[1] - left[1])[0];
    const topNovel = [...books].sort((left, right) => wordsReadForBook(right) - wordsReadForBook(left))[0];

    return {
      totalReadingTime,
      totalReadChapters,
      totalUnreadChapters,
      totalWords: books.reduce((sum, book) => sum + wordsReadForBook(book), 0),
      readingNovels: books.filter(isReadingBook).length,
      completedNovels: books.filter((book) => book.status === 'Completed').length,
      topGenre,
      topNovel,
      novels: [...books].sort((left, right) => wordsReadForBook(right) - wordsReadForBook(left)),
    };
  }, [books, readingSessions]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Analytics" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 48 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle>Overview</SectionTitle>
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <StatCell label="Reading time" value={formatReadingTime(analytics.totalReadingTime)} />
          <StatCell label="Words read" value={formatCount(analytics.totalWords)} />
          <StatCell label="Novels" value={formatCount(books.length)} />
          <StatCell label="Chapters read" value={formatCount(analytics.totalReadChapters)} />
        </View>

        <SectionTitle>Library</SectionTitle>
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <StatCell label="Reading" value={formatCount(analytics.readingNovels)} />
          <StatCell label="Completed" value={formatCount(analytics.completedNovels)} />
          <StatCell label="Unread chapters" value={formatCount(analytics.totalUnreadChapters)} />
        </View>

        <SectionTitle>Top genre</SectionTitle>
        <View style={[styles.highlightRow, { borderBottomColor: colors.border }]}>
          <Feather name="bookmark" size={18} color={colors.primary} />
          <Text style={[styles.highlightTitle, { color: colors.foreground }]}>{analytics.topGenre?.[0] ?? 'No genre data'}</Text>
          <Text style={[styles.highlightMeta, { color: colors.mutedForeground }]}>{analytics.topGenre?.[1] ?? 0} novels</Text>
        </View>

        <SectionTitle>Top novel</SectionTitle>
        {analytics.topNovel ? (
          <View style={[styles.topNovel, { borderBottomColor: colors.border }]}>
            <BookCover source={analytics.topNovel.cover} width={64} height={94} favorite={analytics.topNovel.favorite} />
            <View style={styles.topNovelCopy}>
              <Text style={[styles.topNovelTitle, { color: colors.foreground }]}>{analytics.topNovel.title}</Text>
              <Text style={[styles.topNovelMeta, { color: colors.mutedForeground }]}>{formatCount(readChapterCount(analytics.topNovel))} chapters read</Text>
              <Text style={[styles.topNovelMeta, { color: colors.mutedForeground }]}>{formatCount(wordsReadForBook(analytics.topNovel))} words</Text>
            </View>
          </View>
        ) : null}

        <SectionTitle>By novel</SectionTitle>
        <View style={[styles.novelList, { borderTopColor: colors.border }]}>
          {analytics.novels.map((book) => (
            <View key={book.id} style={[styles.novelRow, { borderBottomColor: colors.border }]}>
              <View style={styles.novelCopy}>
                <Text style={[styles.novelTitle, { color: colors.foreground }]} numberOfLines={1}>{book.title}</Text>
                <Text style={[styles.novelMeta, { color: colors.mutedForeground }]}>{formatCount(readChapterCount(book))} read · {formatCount(unreadChapterCount(book))} unread</Text>
              </View>
              <Text style={[styles.novelWords, { color: colors.mutedForeground }]}>{formatCount(wordsReadForBook(book))}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 20, marginTop: 26, marginBottom: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth },
  statCell: { width: '50%', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  statValue: { fontFamily: 'Inter_600SemiBold', fontSize: 20, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  highlightRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  highlightTitle: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  highlightMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  topNovel: { flexDirection: 'row', gap: 14, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  topNovelCopy: { flex: 1, justifyContent: 'center', gap: 6 },
  topNovelTitle: { fontFamily: 'Georgia', fontSize: 18 },
  topNovelMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  novelList: { borderTopWidth: StyleSheet.hairlineWidth },
  novelRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  novelCopy: { flex: 1, gap: 4 },
  novelTitle: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  novelMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  novelWords: { fontFamily: 'Inter_500Medium', fontSize: 12, fontVariant: ['tabular-nums'] },
});
