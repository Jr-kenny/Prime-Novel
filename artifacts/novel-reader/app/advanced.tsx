import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <Switch accessibilityLabel={label} onValueChange={onChange} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={value ? colors.primaryForeground : colors.mutedForeground} value={value} />
    </View>
  );
}

const downloadConcurrencyOptions = [1, 2, 3, 6, 12];

function DownloadConcurrencyRow({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const colors = useColors();

  return (
    <View style={[styles.concurrencyBlock, { borderBottomColor: colors.border }]}>
      <View style={styles.concurrencyCopy}>
        <Text style={[styles.label, { color: colors.foreground }]}>Concurrent downloads</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>Choose how many chapters can download at once.</Text>
      </View>
      <View style={styles.options}>
        {downloadConcurrencyOptions.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              accessibilityLabel={`${option} concurrent downloads`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => onChange(option)}
              style={[styles.option, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
            >
              <Text style={[styles.optionText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AdvancedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSetting } = useApp();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Advanced" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <View style={[styles.list, { borderTopColor: colors.border }]}>
          <ToggleRow label="Bookmark from QR" value={settings.autoBookmarkFromShare} onChange={(value) => setSetting('autoBookmarkFromShare', value)} />
          <DownloadConcurrencyRow value={settings.downloadConcurrency} onChange={(value) => setSetting('downloadConcurrency', value)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 58, paddingHorizontal: 22, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  concurrencyBlock: { paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  concurrencyCopy: { gap: 4 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  options: { flexDirection: 'row', gap: 8, marginTop: 12 },
  option: { minWidth: 42, height: 36, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
