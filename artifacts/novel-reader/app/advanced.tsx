import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
});
