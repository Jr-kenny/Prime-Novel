import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useReader } from '@/context/ReaderContext';

function ProgressLine({ progress }: { progress: number }) {
  const colors = useColors();
  return <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} /></View>;
}

export default function ReadingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, activeBook, setActiveBook } = useReader();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="Your quiet shelf" title="Reading" action="settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={styles.primarySection}>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>PICKING UP WHERE YOU LEFT OFF</Text>
          <View style={styles.heroRow}>
            <BookCover source={activeBook.cover} width={118} height={178} favorite={activeBook.favorite} />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>{activeBook.title}</Text>
              <Text style={[styles.author, { color: colors.mutedForeground }]}>{activeBook.author}</Text>
              <View style={styles.chapterLine}>
                <Text style={[styles.chapter, { color: colors.foreground }]}>Chapter {activeBook.chapter}</Text>
                <Text style={[styles.of, { color: colors.mutedForeground }]}> of {activeBook.totalChapters}</Text>
              </View>
              <ProgressLine progress={activeBook.progress} />
              <Pressable
                testID="continue-reading"
                accessibilityRole="button"
                onPress={() => router.push('/reader')}
                style={({ pressed }) => [styles.continue, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={[styles.continueText, { color: colors.primaryForeground }]}>Continue</Text>
                <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>In progress</Text>
          <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{books.length} novels</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {books.map((book) => (
            <Pressable key={book.id} testID={`book-${book.id}`} onPress={() => setActiveBook(book.id)} style={({ pressed }) => [styles.miniBook, { opacity: pressed ? 0.65 : 1 }]}>
              <BookCover source={book.cover} width={74} height={108} favorite={book.favorite} />
              <Text style={[styles.miniTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
              <Text style={[styles.miniMeta, { color: colors.mutedForeground }]}>{book.progress}% read</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="bookmark" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTitle, { color: colors.foreground }]}>A small place to return to</Text>
            <Text style={[styles.noteCopy, { color: colors.mutedForeground }]}>Your reading position is saved automatically, even when you are offline.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  primarySection: { paddingHorizontal: 22, paddingTop: 8 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2, marginBottom: 14 },
  heroRow: { flexDirection: 'row', gap: 18 },
  heroCopy: { flex: 1, justifyContent: 'center', paddingBottom: 2 },
  heroTitle: { fontFamily: 'Georgia', fontSize: 24, lineHeight: 28, marginBottom: 7 },
  author: { fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 20 },
  chapterLine: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  chapter: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  of: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: '100%', borderRadius: 2 },
  continue: { height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionHeader: { paddingHorizontal: 22, marginTop: 34, marginBottom: 15, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 21 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  carousel: { paddingHorizontal: 22, gap: 18 },
  miniBook: { width: 84 },
  miniTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, marginTop: 8 },
  miniMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  note: { marginHorizontal: 22, marginTop: 38, padding: 15, borderWidth: 1, borderRadius: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noteTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 3 },
  noteCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
});
