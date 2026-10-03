import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { ReaderFont, ReaderMode, ReaderPreferences, ReaderTheme } from '@/context/ReaderContext';
import type { ReaderPalette } from '@/utils/reader-style';

function Stepper({ label, value, onDecrease, onIncrease, palette }: { label: string; value: string; onDecrease: () => void; onIncrease: () => void; palette: ReaderPalette }) {
  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`Decrease ${label}`} accessibilityRole="button" onPress={onDecrease} style={[styles.stepButton, { borderColor: palette.border }]}>
          <Text style={[styles.stepText, { color: palette.text }]}>−</Text>
        </Pressable>
        <Text style={[styles.value, { color: palette.muted }]}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} accessibilityRole="button" onPress={onIncrease} style={[styles.stepButton, { borderColor: palette.border }]}>
          <Text style={[styles.stepText, { color: palette.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Choice({ label, selected, onPress, dot, palette }: { label: string; selected: boolean; onPress: () => void; dot?: string; palette: ReaderPalette }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { backgroundColor: selected ? palette.accent : palette.surface, borderColor: selected ? palette.accent : palette.border }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot, borderColor: palette.border }]} /> : null}
      <Text style={[styles.choiceText, { color: selected ? palette.background : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onChange, palette, description }: { label: string; value: boolean; onChange: (value: boolean) => void; palette: ReaderPalette; description?: string }) {
  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={styles.toggleCopy}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        {description ? <Text style={[styles.description, { color: palette.muted }]}>{description}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} onValueChange={onChange} trackColor={{ false: palette.border, true: palette.accent }} thumbColor={value ? palette.text : palette.muted} value={value} />
    </View>
  );
}

export function ReaderSettingsControls({ preferences, onChange, palette }: { preferences: ReaderPreferences; onChange: (changes: Partial<ReaderPreferences>) => void; palette: ReaderPalette }) {
  const step = (key: 'lineHeight' | 'paragraphSpacing' | 'margins', amount: number) => {
    const bounds = { lineHeight: [24, 60], paragraphSpacing: [8, 48], margins: [14, 48] }[key];
    onChange({ [key]: Math.max(bounds[0], Math.min(bounds[1], preferences[key] + amount)) });
  };

  const changeTextSize = (amount: number) => {
    const nextTextSize = Math.max(14, Math.min(36, preferences.textSize + amount));
    const scale = nextTextSize / preferences.textSize;
    onChange({
      textSize: nextTextSize,
      lineHeight: Math.max(24, Math.min(60, Math.round(preferences.lineHeight * scale))),
      paragraphSpacing: Math.max(8, Math.min(48, Math.round(preferences.paragraphSpacing * scale))),
    });
  };

  return (
    <>
      <Text style={[styles.section, { color: palette.muted }]}>TYPE</Text>
      <Stepper label="Text size" value={`${preferences.textSize}`} onDecrease={() => changeTextSize(-1)} onIncrease={() => changeTextSize(1)} palette={palette} />
      <Stepper label="Line height" value={`${preferences.lineHeight}`} onDecrease={() => step('lineHeight', -1)} onIncrease={() => step('lineHeight', 1)} palette={palette} />
      <Stepper label="Paragraph spacing" value={`${preferences.paragraphSpacing}`} onDecrease={() => step('paragraphSpacing', -2)} onIncrease={() => step('paragraphSpacing', 2)} palette={palette} />
      <Toggle label="Paragraph indentation" value={preferences.paragraphIndent} onChange={(value) => onChange({ paragraphIndent: value })} palette={palette} />
      <Stepper label="Margins" value={`${preferences.margins}`} onDecrease={() => step('margins', -2)} onIncrease={() => step('margins', 2)} palette={palette} />

      <Text style={[styles.section, { color: palette.muted }]}>FONTS</Text>
      <View style={styles.choiceRow}>
        <Choice label="Serif" selected={preferences.font === 'serif'} onPress={() => onChange({ font: 'serif' as ReaderFont })} palette={palette} />
        <Choice label="Sans" selected={preferences.font === 'sans'} onPress={() => onChange({ font: 'sans' as ReaderFont })} palette={palette} />
        <Choice label="Merriweather" selected={preferences.font === 'merriweather'} onPress={() => onChange({ font: 'merriweather' as ReaderFont })} palette={palette} />
        <Choice label="Atkinson" selected={preferences.font === 'atkinson'} onPress={() => onChange({ font: 'atkinson' as ReaderFont })} palette={palette} />
      </View>

      <Text style={[styles.section, { color: palette.muted }]}>THEME</Text>
      <View style={styles.choiceRow}>
        <Choice label="Paper" dot="#e8dccb" selected={preferences.theme === 'paper'} onPress={() => onChange({ theme: 'paper' as ReaderTheme })} palette={palette} />
        <Choice label="Soft dark" dot="#55534d" selected={preferences.theme === 'soft-dark'} onPress={() => onChange({ theme: 'soft-dark' as ReaderTheme })} palette={palette} />
        <Choice label="Black" dot="#111111" selected={preferences.theme === 'black'} onPress={() => onChange({ theme: 'black' as ReaderTheme })} palette={palette} />
        <Choice label="White" dot="#ffffff" selected={preferences.theme === 'white'} onPress={() => onChange({ theme: 'white' as ReaderTheme })} palette={palette} />
      </View>

      <Text style={[styles.section, { color: palette.muted }]}>NAVIGATION</Text>
      <View style={styles.choiceRow}>
        <Choice label="Vertical" selected={preferences.mode === 'vertical'} onPress={() => onChange({ mode: 'vertical' as ReaderMode })} palette={palette} />
        <Choice label="Pages" selected={preferences.mode === 'horizontal'} onPress={() => onChange({ mode: 'horizontal' as ReaderMode })} palette={palette} />
      </View>

      <Text style={[styles.section, { color: palette.muted }]}>READER</Text>
      <Toggle description="Hide controls and system bars for distraction-free reading." label="Fullscreen" value={preferences.fullscreen} onChange={(value) => onChange({ fullscreen: value })} palette={palette} />
      <Toggle label="Keep screen awake" value={preferences.keepScreenAwake} onChange={(value) => onChange({ keepScreenAwake: value })} palette={palette} />
      <Toggle label="Lock rotation" value={preferences.lockRotation} onChange={(value) => onChange({ lockRotation: value })} palette={palette} />
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 25, marginBottom: 6 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  toggleCopy: { flex: 1, gap: 3 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 30, height: 30, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: 'Inter_500Medium', fontSize: 18, lineHeight: 20 },
  value: { minWidth: 26, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 12, fontVariant: ['tabular-nums'] },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 34, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  choiceText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});
