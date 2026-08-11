import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { BookStatus, useReader } from '@/context/ReaderContext';

const filters: Array<BookStatus | 'All'> = ['All', 'New chapters', 'Continue', 'On hold', 'Plan to read', 'Completed'];

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, toggleFavorite } = useReader();
  const [filter, setFilter] = React.useState<BookStatus | 'All'>('All');
  const visibleBooks = filter === 'All' ? books : books.filter((book) => book.status === filter);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="Everything you keep" title="Library" action="search" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, { backgroundColor: filter === item ? colors.foreground : colors.secondary }]}>
              <Text style={[styles.filterText, { color: filter === item ? colors.background : colors.secondaryForeground }]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.list}>
          {visibleBooks.map((book) => (
            <Pressable key={book.id} onPress={() => router.push('/reader')} style={({ pressed }) => [styles.bookRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <BookCover source={book.cover} width={58} height={82} favorite={book.favorite} />
              <View style={styles.bookDetails}>
                <View style={styles.titleRow}>
                  <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={1}>{book.title}</Text>
                  <Pressable testID={`favorite-${book.id}`} hitSlop={10} onPress={() => toggleFavorite(book.id)}>
                    <Feather name={book.favorite ? 'heart' : 'heart'} size={16} color={book.favorite ? colors.primary : colors.mutedForeground} />
                  </Pressable>
                </View>
                <Text style={[styles.bookAuthor, { color: colors.mutedForeground }]}>{book.author}</Text>
                <View style={styles.statusLine}>
                  <Text style={[styles.bookStatus, { color: book.status === 'New chapters' ? colors.primary : colors.mutedForeground }]}>{book.status}</Text>
                  <Text style={[styles.lastRead, { color: colors.mutedForeground }]}>{book.lastRead}</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${book.progress}%` }]} /></View>
              </View>
            </Pressable>
          ))}
          {visibleBooks.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nothing in this part of your shelf yet.</Text> : null}
        </View>
        <View style={[styles.resurface, { borderTopColor: colors.border }]}>
          <Text style={[styles.resurfaceTitle, { color: colors.foreground }]}>Worth another look</Text>
          <Text style={[styles.resurfaceCopy, { color: colors.mutedForeground }]}>A few stories have been quiet for a while. No pressure—just an open door.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

import React from 'react';
const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { paddingHorizontal: 22, gap: 8, paddingBottom: 20 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18 },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  list: { paddingHorizontal: 22 },
  bookRow: { flexDirection: 'row', gap: 15, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  bookDetails: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookTitle: { flex: 1, fontFamily: 'Georgia', fontSize: 17 },
  bookAuthor: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  bookStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  lastRead: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  progressTrack: { height: 3, marginTop: 7, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  empty: { fontFamily: 'Georgia', fontSize: 17, textAlign: 'center', marginTop: 60, paddingHorizontal: 30 },
  resurface: { marginHorizontal: 22, borderTopWidth: 1, marginTop: 28, paddingTop: 22 },
  resurfaceTitle: { fontFamily: 'Georgia', fontSize: 18 },
  resurfaceCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 7 },
});