import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_ICON_OPTIONS, type AppIconId, type AppIconOption } from '@/utils/app-icon';
import { useColors } from '@/hooks/useColors';

function IconPreview({ option, selected, colors }: { option: AppIconOption; selected: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={[
        styles.preview,
        {
          backgroundColor: option.previewBackground,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.mark, { backgroundColor: option.previewMark }]} />
      <View style={[styles.markStem, { backgroundColor: option.previewMark }]} />
    </View>
  );
}

export function AppIconPicker({
  value,
  onChange,
}: {
  value: AppIconId;
  onChange: (iconId: AppIconId) => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.grid}>
      {APP_ICON_OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`App icon ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.78 : 1 }]}
          >
            <IconPreview option={option} selected={selected} colors={colors} />
            <Text style={[styles.label, { color: selected ? colors.foreground : colors.mutedForeground }]}>{option.label}</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  item: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    gap: 6,
    alignItems: 'center',
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 22,
    height: 16,
    borderRadius: 3,
  },
  markStem: {
    width: 4,
    height: 14,
    borderRadius: 2,
    marginTop: -12,
    marginLeft: 14,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
