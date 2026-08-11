import { router } from 'expo-router';
import { UtilityRow } from '@/components/UtilityRow';

export function AndroidMoreAction() {
  return <UtilityRow compact icon="share-2" onPress={() => router.push('/share-link' as never)} showChevron={false} showDivider={false} testID="more-share-link" title="Add share link" />;
}
