import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ShelfGridCard } from '@/components/shelf-grid-card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { splitShelfBooks } from '@/utils/shelves';
import { useReader } from '@/context/ReaderContext';

function ProgressLine({ progress }: { progress: number }) {
  const colors = useColors();
  return <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} /></View>;
}

export default function ReadingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { books, activeBook, hydrated, setActiveBook } = useReader();
  const { priorityBooks, otherBooks } = splitShelfBooks(books);
  const gridCardWidth = Math.max(120, Math.floor((width - 44 - 14) / 2));
  const openChapters = (bookId: string) => {
    setActiveBook(bookId);
    router.push('/chapters');
  };

  if (!hydrated) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader eyebrow="Your quiet shelf" title="Reading" action="settings" />
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Loading your saved library</Text>
        </View>
      </View>
    );
  }

  if (!activeBook) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader eyebrow="Your quiet shelf" title="Reading" action="settings" />
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your shelf is ready.</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Search Discover to find a novel and start reading.</Text>
          <Pressable onPress={() => router.push('/discover')} style={({ pressed }) => [styles.emptyAction, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}>
            <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>Find a novel</Text>
            <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

  const listHeader = (
    <>
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
              style={({ pressed }) => [styles.continue, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
            >
              <Text style={[styles.continueText, { color: colors.primaryForeground }]}>Continue</Text>
              <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>In progress</Text>
        <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{priorityBooks.length} priority reads</Text>
      </View>
      <ScrollView horizontal decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {priorityBooks.map((book, index) => (
          <Animated.View key={book.id} entering={FadeInRight.delay(index * 55).duration(280)}>
            <Pressable testID={`book-${book.id}`} onPress={() => openChapters(book.id)} style={({ pressed }) => [styles.miniBook, { opacity: pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <BookCover source={book.cover} width={74} height={108} favorite={book.favorite} />
              <Text style={[styles.miniTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
              <Text style={[styles.miniMeta, { color: colors.mutedForeground }]}>{book.progress}% read</Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
      {otherBooks.length > 0 ? (
        <View style={styles.anotherLookHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Another look</Text>
          <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>More from your shelf</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="Your quiet shelf" title="Reading" action="settings" />
      <FlatList
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        data={otherBooks}
        keyExtractor={(book) => book.id}
        ListFooterComponent={(
          <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bookmark" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noteTitle, { color: colors.foreground }]}>A small place to return to</Text>
              <Text style={[styles.noteCopy, { color: colors.mutedForeground }]}>Your reading position is saved automatically, even when you are offline.</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={listHeader}
        numColumns={2}
        renderItem={({ item, index }) => <ShelfGridCard book={item} index={index} onPress={() => openChapters(item.id)} width={gridCardWidth} />}
        showsVerticalScrollIndicator={false}
      />
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
  anotherLookHeader: { paddingHorizontal: 22, marginTop: 34, marginBottom: 18, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 21 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  carousel: { paddingHorizontal: 22, gap: 18 },
  miniBook: { width: 84 },
  miniTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, marginTop: 8 },
  miniMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  gridRow: { paddingHorizontal: 22, justifyContent: 'space-between', gap: 14 },
  note: { marginHorizontal: 22, marginTop: 12, padding: 15, borderWidth: 1, borderRadius: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noteTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 3 },
  noteCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 70 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 23 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  emptyAction: { height: 44, minWidth: 150, paddingHorizontal: 18, borderRadius: 22, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
