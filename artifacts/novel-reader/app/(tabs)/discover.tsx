import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useReader } from '@/context/ReaderContext';
import { useCatalog } from '@/context/CatalogContext';
import type { PrimeNovel } from '@/utils/prime-source-adapters';

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, setActiveBook } = useReader();
  const { results, searching, search, searchError, clearResults } = useCatalog();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      clearResults();
      return;
    }
    const timer = setTimeout(() => {
      void search(trimmedQuery);
    }, 320);
    return () => clearTimeout(timer);
  }, [clearResults, query, search]);

  const submitSearch = () => {
    if (query.trim().length < 1) return;
    void search(query);
  };

  const openNovel = (novel: PrimeNovel) => {
    router.push({ pathname: '/novel', params: { sourceId: novel.sourceId, sourceRecordId: novel.sourceRecordId ?? '', title: novel.title, url: novel.url, coverUrl: novel.coverUrl ?? '' } });
  };

  const clearSearch = () => {
    setQuery('');
    clearResults();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="Find your next world" title="Discover" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Search novels"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            placeholder="Search novels"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
          />
          {query ? <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={clearSearch}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
          <Pressable accessibilityLabel="Search" accessibilityRole="button" disabled={query.trim().length < 1 || searching} hitSlop={10} onPress={submitSearch}>
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="arrow-right" size={17} color={query.trim().length >= 1 ? colors.primary : colors.mutedForeground} />}
          </Pressable>
        </View>
        {query.trim().length >= 1 ? (
          <>
            <View style={styles.resultHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Results</Text>
            </View>
            {searchError ? <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>{searchError}</Text> : null}
            <View style={styles.resultsList}>
              {results.map((novel) => {
                return (
                  <Pressable key={novel.id} onPress={() => openNovel(novel)} style={({ pressed }) => [styles.resultRow, { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
                    <BookCover source={novel.coverUrl || require('@/assets/images/cover-lighthouse.jpg')} width={58} height={82} />
                    <View style={styles.resultCopy}>
                      <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={2}>{novel.title}</Text>
                      {novel.author ? <Text style={[styles.resultAuthor, { color: colors.mutedForeground }]} numberOfLines={1}>{novel.author}</Text> : null}
                      <Text style={[styles.resultSource, { color: colors.primary }]}>{novel.genres?.[0] ?? 'Story'}</Text>
                    </View>
                    <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </View>
            {!searching && results.length === 0 && !searchError ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No novels found.</Text> : null}
          </>
        ) : (
          books.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>From your library</Text>
              <View style={styles.coverGrid}>
                {books.map((book) => (
                  <Pressable key={book.id} onPress={() => { setActiveBook(book.id); router.push('/chapters'); }} style={({ pressed }) => [styles.discoverBook, { opacity: pressed ? 0.7 : 1 }]}>
                    <BookCover source={book.cover} width={112} height={164} favorite={book.favorite} />
                    <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
                    <Text style={[styles.bookGenre, { color: colors.mutedForeground }]}>{book.genre}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>Search for a novel to add it to your shelf.</Text>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBox: { marginHorizontal: 22, height: 46, borderWidth: 1, borderRadius: 23, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  resultHeader: { paddingHorizontal: 22, marginTop: 22, marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 20, paddingHorizontal: 22, marginTop: 22 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  sectionCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingHorizontal: 22, marginTop: 5 },
  resultsList: { marginTop: 8 },
  resultRow: { minHeight: 100, paddingHorizontal: 22, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  resultCopy: { flex: 1, gap: 5 },
  resultTitle: { fontFamily: 'Georgia', fontSize: 16, lineHeight: 20 },
  resultAuthor: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  resultSource: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  empty: { fontFamily: 'Georgia', fontSize: 17, textAlign: 'center', marginTop: 60, paddingHorizontal: 30 },
  coverGrid: { paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  discoverBook: { width: 112 },
  bookTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, marginTop: 8 },
  bookGenre: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
});
