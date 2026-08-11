import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UtilityRow } from '@/components/UtilityRow';
import { AndroidMoreAction } from '@/components/android-more-action';
import { useColors } from '@/hooks/useColors';

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="More" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.list, { borderBottomColor: colors.border, borderTopColor: colors.border }]}>
          <UtilityRow compact icon="download" onPress={() => router.push('/downloads')} showChevron={false} testID="more-downloads" title="Downloads" />
          <UtilityRow compact icon="clock" onPress={() => router.push('/history')} showChevron={false} testID="more-history" title="History" />
          <UtilityRow compact icon="bookmark" onPress={() => router.push('/categories')} showChevron={false} testID="more-categories" title="Categories" />
          <UtilityRow compact icon="bar-chart-2" onPress={() => router.push('/analytics')} showChevron={false} testID="more-analytics" title="Analytics" />
          <UtilityRow compact icon="book-open" onPress={() => router.push('/reader-settings')} showChevron={false} testID="more-reader" title="Reader" />
          <UtilityRow compact icon="grid" onPress={() => router.push('/view-settings')} showChevron={false} testID="more-view" title="View" />
          <UtilityRow compact icon="refresh-cw" onPress={() => router.push('/update-settings')} showChevron={false} testID="more-updates" title="Updates" />
          <UtilityRow compact icon="tool" onPress={() => router.push('/advanced')} showChevron={false} testID="more-advanced" title="Advanced" />
          <AndroidMoreAction />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
