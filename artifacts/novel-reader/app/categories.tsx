import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books } = useReader();
  const categories = [...new Set(books.map((book) => book.genre))].sort((left, right) => left.localeCompare(right));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Categories" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.list, { borderTopColor: colors.border }]}>
          {categories.map((category) => {
            const count = books.filter((book) => book.genre === category).length;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/library', params: { category } })}
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
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 58, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  count: { fontFamily: 'Inter_500Medium', fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { fontFamily: 'Georgia', fontSize: 17, textAlign: 'center', marginTop: 54 },
});
