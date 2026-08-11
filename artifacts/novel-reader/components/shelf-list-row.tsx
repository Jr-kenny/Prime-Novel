import { Feather } from '@expo/vector-icons';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '@/context/ReaderContext';
import { BookCover } from '@/components/BookCover';
import { useColors } from '@/hooks/useColors';

export function ShelfListRow({ book, index, onPress, onToggleFavorite }: { book: Book; index: number; onPress: () => void; onToggleFavorite: () => void }) {
  const colors = useColors();
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 7) * 35).duration(260)} style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.985, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 16, stiffness: 260 });
        }}
        style={[styles.row, { borderBottomColor: colors.border }]}
      >
        <BookCover source={book.cover} width={58} height={82} favorite={book.favorite} />
        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{book.title}</Text>
            <Pressable
              accessibilityLabel={`${book.favorite ? 'Remove' : 'Add'} ${book.title} favorite`}
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Feather name="heart" size={16} color={book.favorite ? colors.primary : colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.author, { color: colors.mutedForeground }]}>{book.author}</Text>
          <View style={styles.statusLine}>
            <Text style={[styles.status, { color: book.status === 'New chapters' ? colors.primary : colors.mutedForeground }]}>{book.status}</Text>
            <Text style={[styles.lastRead, { color: colors.mutedForeground }]}>{book.lastRead}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.secondary }]}>
            <View style={[styles.fill, { backgroundColor: colors.primary, width: `${book.progress}%` }]} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 15, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  details: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: 'Georgia', fontSize: 17 },
  author: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  lastRead: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  track: { height: 3, marginTop: 7, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
