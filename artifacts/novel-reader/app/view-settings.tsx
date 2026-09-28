import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIconPicker } from '@/components/AppIconPicker';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { AppIconId } from '@/utils/app-icon';
import { applyAppIcon } from '@/utils/app-icon-switch';

function Choice({ label, selected, onPress, dot }: { label: string; selected: boolean; onPress: () => void; dot?: string }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: selected ? colors.foreground : colors.secondary, borderColor: selected ? colors.foreground : colors.border, opacity: pressed ? 0.72 : 1 }]}>
      {dot ? <View style={[styles.choiceDot, { backgroundColor: dot, borderColor: selected ? colors.background : colors.border }]} /> : null}
      <Text style={[styles.choiceText, { color: selected ? colors.background : colors.secondaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export default function ViewSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSetting } = useApp();

  const handleChangeAppIcon = async (iconId: AppIconId) => {
    setSetting('appIcon', iconId);
    const result = await applyAppIcon(iconId);
    if (!result.applied && result.error && Platform.OS !== 'web') {
      Alert.alert('App icon', result.error);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="View" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 48 }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: colors.mutedForeground }]}>APP</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>App theme</Text>
        <View style={styles.choiceRow}>
          <Choice label="Cream" selected={settings.appTheme === 'cream'} onPress={() => setSetting('appTheme', 'cream')} dot="#e8dccb" />
          <Choice label="White" selected={settings.appTheme === 'white'} onPress={() => setSetting('appTheme', 'white')} dot="#ffffff" />
          <Choice label="Dark" selected={settings.appTheme === 'dark'} onPress={() => setSetting('appTheme', 'dark')} dot="#171614" />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Choose the appearance used throughout Prime Novel.</Text>

        <Text style={[styles.section, styles.iconSection, { color: colors.mutedForeground }]}>APP ICON</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Home screen icon</Text>
        <AppIconPicker value={settings.appIcon} onChange={(iconId) => void handleChangeAppIcon(iconId)} />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Your selection is saved and applied to the launcher icon on this device.</Text>

        <Text style={[styles.section, styles.librarySection, { color: colors.mutedForeground }]}>LIBRARY</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Layout</Text>
        <View style={styles.choiceRow}>
          <Choice label="Shelf" selected={settings.libraryLayout === 'shelf'} onPress={() => setSetting('libraryLayout', 'shelf')} />
          <Choice label="Grid" selected={settings.libraryLayout === 'grid'} onPress={() => setSetting('libraryLayout', 'grid')} />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Choose how the library arranges its books.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 10, marginBottom: 18 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, marginBottom: 10 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 36, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  choiceDot: { width: 13, height: 13, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  choiceText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 12 },
  iconSection: { marginTop: 30 },
  librarySection: { marginTop: 30 },
});
