import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { ReaderPalette } from '@/utils/reader-style';

export function SubscreenHeader({ eyebrow, title, palette }: { eyebrow?: string; title: string; palette?: Pick<ReaderPalette, 'background' | 'text' | 'accent'> }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const foreground = palette?.text ?? colors.foreground;
  const accent = palette?.accent ?? colors.primary;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/more');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette?.background ?? colors.background, paddingTop: insets.top + (process.env.EXPO_OS === 'web' ? 40 : 12) }]}>
      <Pressable accessibilityLabel={`Back from ${title}`} accessibilityRole="button" hitSlop={12} onPress={goBack} style={styles.back}>
        <Feather name="chevron-left" size={23} color={foreground} />
      </Pressable>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: foreground }]}>{title}</Text>
      </View>
      <View style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  balance: { width: 38 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.6, marginBottom: 4 },
  title: { fontFamily: 'Georgia', fontSize: 28, lineHeight: 32 },
});
