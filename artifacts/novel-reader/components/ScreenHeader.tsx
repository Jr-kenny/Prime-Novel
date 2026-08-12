import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebLandingButton } from '@/components/WebLandingButton';
import { useColors } from '@/hooks/useColors';

export function ScreenHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: 'settings' | 'search' }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + (process.env.EXPO_OS === 'web' ? 40 : 12) }]}>
      <View style={styles.heading}>
        <WebLandingButton color={colors.foreground} />
        <View style={styles.copy}>
          {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        </View>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action === 'settings' ? 'Open More' : 'Search novels'}
          testID={`header-${action}`}
          hitSlop={12}
          onPress={() => (action === 'settings' ? router.push('/more') : router.push('/discover'))}
          style={({ pressed }) => [styles.icon, { backgroundColor: colors.secondary, opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name={action === 'settings' ? 'sliders' : 'search'} size={18} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  copy: { minWidth: 0 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.6, marginBottom: 4 },
  title: { fontFamily: 'Georgia', fontSize: 30, lineHeight: 34 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
