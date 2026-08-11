import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReaderSettingsControls } from '@/components/ReaderSettingsControls';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { getReaderPalette } from '@/utils/reader-style';

export default function ReaderSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { readerPreferences, updateReaderPreferences } = useReader();
  const palette = getReaderPalette(readerPreferences.theme, colors);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar backgroundColor={palette.background} style={palette.statusBarStyle} />
      <SubscreenHeader palette={palette} title="Reader" />
      <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 48 }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <ReaderSettingsControls palette={palette} preferences={readerPreferences} onChange={updateReaderPreferences} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
