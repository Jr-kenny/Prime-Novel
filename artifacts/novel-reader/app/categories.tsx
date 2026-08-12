import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { PRIME_SOURCE_REGISTRY } from '@/data/prime-sources';

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books } = useReader();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const libraryCategories = books.map((book) => book.genre);
  const sourceCategories = PRIME_SOURCE_REGISTRY.flatMap((source) => source.coverage ?? []);
  const categories = [...new Set([...libraryCategories, ...sourceCategories])].sort((left, right) => left.localeCompare(right));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Categories" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        {category ? (
          <View style={[styles.selected, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.selectedEyebrow, { color: colors.primary }]}>Browse the catalogue</Text>
            <Text style={[styles.selectedTitle, { color: colors.foreground }]}>{category}</Text>
            <Text style={[styles.selectedCopy, { color: colors.mutedForeground }]}>Search Prime Novel’s enabled sources for {category.toLocaleLowerCase()} stories.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/discover', params: { q: category } })}
              style={({ pressed }) => [styles.selectedAction, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
            >
              <Text style={[styles.selectedActionText, { color: colors.primaryForeground }]}>Search {category}</Text>
              <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.list, { borderTopColor: colors.border }]}>
          {categories.map((category) => {
            const count = books.filter((book) => book.genre === category).length;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/categories', params: { category } })}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
              >
                <Feather name="bookmark" size={17} color={colors.primary} />
                <Text style={[styles.name, { color: colors.foreground }]}>{category}</Text>
                <Text style={[styles.count, { color: colors.mutedForeground }]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
        {categories.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No categories yet.</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  selected: { marginHorizontal: 22, marginBottom: 22, padding: 17, borderWidth: 1, borderRadius: 16, gap: 8 },
  selectedEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  selectedTitle: { fontFamily: 'Georgia', fontSize: 25 },
  selectedCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  selectedAction: { minHeight: 42, paddingHorizontal: 15, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  selectedActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 58, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  count: { fontFamily: 'Inter_500Medium', fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { fontFamily: 'Georgia', fontSize: 17, textAlign: 'center', marginTop: 54 },
});
