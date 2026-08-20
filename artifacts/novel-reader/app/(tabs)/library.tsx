import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShelfGridCard } from '@/components/shelf-grid-card';
import { ShelfListRow } from '@/components/shelf-list-row';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { BookStatus, useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { splitShelfBooks } from '@/utils/shelves';

const filters: Array<BookStatus | 'All'> = ['All', 'New chapters', 'Continue', 'On hold', 'Plan to read', 'Completed'];

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { settings } = useApp();
  const { books, hydrated, toggleFavorite, setActiveBook } = useReader();
  const [filter, setFilter] = useState<BookStatus | 'All'>('All');
  const visibleBooks = useMemo(() => {
    const byStatus = filter === 'All' ? books : books.filter((book) => book.status === filter);
    return category ? byStatus.filter((book) => book.genre === category) : byStatus;
  }, [books, category, filter]);
  const { priorityBooks, otherBooks } = splitShelfBooks(visibleBooks);
  const showShelfLayout = settings.libraryLayout === 'shelf';
  const gridCardWidth = Math.max(120, Math.floor((width - 44 - 14) / 2));
  const openChapters = (bookId: string) => {
    setActiveBook(bookId);
    router.push('/chapters');
  };

  const listHeader = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={({ pressed }) => [styles.filter, { backgroundColor: filter === item ? colors.foreground : colors.secondary, opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={[styles.filterText, { color: filter === item ? colors.background : colors.secondaryForeground }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {showShelfLayout && priorityBooks.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Keep going</Text>
            <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{priorityBooks.length} priority reads</Text>
          </View>
          <View style={styles.list}>
            {priorityBooks.map((book, index) => (
              <ShelfListRow key={book.id} book={book} index={index} onPress={() => openChapters(book.id)} onToggleFavorite={() => toggleFavorite(book.id)} />
            ))}
          </View>
        </>
      ) : null}
      {hydrated && visibleBooks.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nothing in this part of your shelf yet.</Text> : null}
      {showShelfLayout && otherBooks.length > 0 ? (
        <View style={styles.anotherLookHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Another look</Text>
          <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>More from your shelf</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow={category ?? 'Everything you keep'} title="Library" action="search" />
      {!hydrated ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>Loading your library</Text>
        </View>
      ) : <FlatList
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        data={showShelfLayout ? otherBooks : visibleBooks}
        keyExtractor={(book) => book.id}
        ListFooterComponent={(
          <View style={[styles.resurface, { borderTopColor: colors.border }]}>
            <Text style={[styles.resurfaceTitle, { color: colors.foreground }]}>Worth another look</Text>
            <Text style={[styles.resurfaceCopy, { color: colors.mutedForeground }]}>A few stories have been quiet for a while. No pressure, just an open door.</Text>
          </View>
        )}
        ListHeaderComponent={listHeader}
        numColumns={2}
        renderItem={({ item, index }) => <ShelfGridCard book={item} index={index} onPress={() => openChapters(item.id)} width={gridCardWidth} />}
        showsVerticalScrollIndicator={false}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { paddingHorizontal: 22, gap: 8, paddingBottom: 20 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18 },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  sectionHeader: { paddingHorizontal: 22, marginTop: 4, marginBottom: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  anotherLookHeader: { paddingHorizontal: 22, marginTop: 32, marginBottom: 18, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 21 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  list: { paddingHorizontal: 22 },
  gridRow: { paddingHorizontal: 22, justifyContent: 'space-between', gap: 14 },
  empty: { fontFamily: 'Georgia', fontSize: 17, textAlign: 'center', marginTop: 60, paddingHorizontal: 30 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  resurface: { marginHorizontal: 22, borderTopWidth: 1, marginTop: 12, paddingTop: 22 },
  resurfaceTitle: { fontFamily: 'Georgia', fontSize: 18 },
  resurfaceCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 7 },
});
