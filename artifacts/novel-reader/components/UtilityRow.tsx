import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type IconName = ComponentProps<typeof Feather>['name'];

export function UtilityRow({
  description,
  icon,
  onPress,
  compact = false,
  showChevron = Boolean(onPress),
  showDivider = true,
  testID,
  title,
}: {
  compact?: boolean;
  description?: string;
  icon: IconName;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
  testID?: string;
  title: string;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        compact && styles.compactRow,
        showDivider && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.68 : 1 },
      ]}
    >
      <View style={[styles.icon, compact && styles.compactIcon, { backgroundColor: compact ? 'transparent' : colors.secondary }]}>
        <Feather name={icon} size={compact ? 21 : 18} color={compact ? colors.primary : colors.foreground} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text> : null}
      </View>
      {showChevron ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, gap: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactIcon: { width: 24, height: 24, borderRadius: 12 },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
});
