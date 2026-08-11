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
  const { books } = useReader();
  const updated = books.filter((book) => book.newChapters);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader eyebrow="While you were away" title="Updates" action="settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={styles.dayRow}><Text style={[styles.day, { color: colors.foreground }]}>Today</Text><Text style={[styles.date, { color: colors.mutedForeground }]}>August 11</Text></View>
        {updated.map((book) => (
          <Pressable key={book.id} onPress={() => router.push('/reader')} style={({ pressed }) => [styles.updateRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <BookCover source={book.cover} width={48} height={68} favorite={book.favorite} />
            <View style={styles.updateCopy}>
              <Text style={[styles.updateTitle, { color: colors.foreground }]}>{book.title}</Text>
              <Text style={[styles.updateMeta, { color: colors.primary }]}>{book.newChapters} new chapters</Text>
              <Text style={[styles.updateHint, { color: colors.mutedForeground }]}>Tap to open the first unread chapter</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
        ))}
        <View style={styles.dayRow}><Text style={[styles.day, { color: colors.foreground }]}>Earlier</Text><Text style={[styles.date, { color: colors.mutedForeground }]}>Last 7 days</Text></View>
        <View style={[styles.quietRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="edit-3" size={16} color={colors.mutedForeground} />
          <Text style={[styles.quietText, { color: colors.mutedForeground }]}>Chapter 87 of The Salt Lighthouse was revised.</Text>
        </View>
        <View style={styles.digest}><Text style={[styles.digestTitle, { color: colors.foreground }]}>A calmer inbox</Text><Text style={[styles.digestCopy, { color: colors.mutedForeground }]}>Following a lot of novels? You can collapse updates into one daily digest from settings.</Text></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dayRow: { paddingHorizontal: 22, marginTop: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  day: { fontFamily: 'Georgia', fontSize: 19 },
  date: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  updateRow: { marginHorizontal: 22, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 14 },
  updateCopy: { flex: 1 },
  updateTitle: { fontFamily: 'Georgia', fontSize: 16 },
  updateMeta: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 5 },
  updateHint: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5 },
  quietRow: { marginHorizontal: 22, marginTop: 4, padding: 13, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quietText: { fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1, lineHeight: 16 },
  digest: { paddingHorizontal: 22, marginTop: 36 },
  digestTitle: { fontFamily: 'Georgia', fontSize: 18 },
  digestCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
});