import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { UpdateFrequency } from '@/context/AppContext';

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { backgroundColor: selected ? colors.foreground : colors.secondary, borderColor: selected ? colors.foreground : colors.border }]}>
      <Text style={[styles.choiceText, { color: selected ? colors.background : colors.secondaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <Switch accessibilityLabel={label} onValueChange={onChange} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={value ? colors.primaryForeground : colors.mutedForeground} value={value} />
    </View>
  );
}

export default function UpdateSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSetting } = useApp();
  const frequencies: Array<{ label: string; value: UpdateFrequency }> = [
    { label: 'Manual', value: 'manual' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Updates" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 48 }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: colors.mutedForeground }]}>CATALOGUE UPDATES</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Update frequency</Text>
        <View style={styles.choiceRow}>
          {frequencies.map((frequency) => (
            <Choice key={frequency.value} label={frequency.label} selected={settings.updateFrequency === frequency.value} onPress={() => setSetting('updateFrequency', frequency.value)} />
          ))}
        </View>
        <View style={styles.spacer} />
        <ToggleRow label="Only update ongoing novels" value={settings.onlyUpdateOngoing} onChange={(value) => setSetting('onlyUpdateOngoing', value)} />
        <ToggleRow label="Download new chapters on update" value={settings.downloadOnUpdate} onChange={(value) => setSetting('downloadOnUpdate', value)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 10, marginBottom: 18 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, marginBottom: 10 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 36, paddingHorizontal: 15, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  spacer: { height: 20 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
