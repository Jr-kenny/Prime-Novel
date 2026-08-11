import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useReader } from '@/context/ReaderContext';

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books } = useReader();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="Find your next world" title="Discover" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput placeholder="Search your sources" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} />
        </View>
        <Pressable onPress={() => router.push('/sources')} style={({ pressed }) => [styles.addSource, { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.addIcon, { backgroundColor: colors.primary }]}><Feather name="plus" size={18} color={colors.primaryForeground} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.addTitle, { color: colors.accentForeground }]}>Add a collection</Text><Text style={[styles.addCopy, { color: colors.secondaryForeground }]}>Paste a link to bring in a new source.</Text></View>
          <Feather name="arrow-up-right" size={16} color={colors.accentForeground} />
        </Pressable>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>From your sources</Text>
        <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>A little browsing, without the noise of a public storefront.</Text>
        <View style={styles.coverGrid}>
          {books.map((book) => (
            <Pressable key={book.id} onPress={() => router.push('/reader')} style={({ pressed }) => [styles.discoverBook, { opacity: pressed ? 0.7 : 1 }]}>
              <BookCover source={book.cover} width={112} height={164} favorite={book.favorite} />
              <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
              <Text style={[styles.bookGenre, { color: colors.mutedForeground }]}>{book.genre}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBox: { marginHorizontal: 22, height: 46, borderWidth: 1, borderRadius: 23, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  addSource: { margin: 22, padding: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  addIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  addCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 20, paddingHorizontal: 22, marginTop: 5 },
  sectionCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingHorizontal: 22, marginTop: 5 },
  coverGrid: { paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  discoverBook: { width: 112 },
  bookTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, marginTop: 8 },
  bookGenre: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
});