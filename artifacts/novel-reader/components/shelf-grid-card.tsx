import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '@/context/ReaderContext';
import { BookCover } from '@/components/BookCover';
import { useColors } from '@/hooks/useColors';

export function ShelfGridCard({ book, index, width, onPress }: { book: Book; index: number; width: number; onPress: () => void }) {
  const colors = useColors();
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const coverHeight = Math.round(width * 1.42);

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 7) * 35).duration(260)} style={[styles.card, { width }, pressStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.97, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 16, stiffness: 260 });
        }}
      >
        <BookCover source={book.cover} width={width} height={coverHeight} favorite={book.favorite} />
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
        <View style={styles.metaLine}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>{book.author}</Text>
          <Text style={[styles.progress, { color: colors.primary }]}>{book.progress}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.secondary }]}>
          <View style={[styles.fill, { backgroundColor: colors.primary, width: `${book.progress}%` }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 26 },
  title: { fontFamily: 'Georgia', fontSize: 16, lineHeight: 20, marginTop: 9 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  meta: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10 },
  progress: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 2 },
});
