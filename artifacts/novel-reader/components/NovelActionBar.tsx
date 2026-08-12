import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function NovelActionBar({
  inLibrary,
  favorite,
  downloadComplete = false,
  downloadDisabled = false,
  downloadBusy = false,
  downloadLabel = 'Download all',
  onLibraryPress,
  onFavoritePress,
  onDownloadPress,
}: {
  inLibrary: boolean;
  favorite: boolean;
  downloadComplete?: boolean;
  downloadDisabled?: boolean;
  downloadBusy?: boolean;
  downloadLabel?: string;
  onLibraryPress: () => void;
  onFavoritePress: () => void;
  onDownloadPress: () => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={inLibrary ? 'Remove novel from library' : 'Add novel to library'}
        accessibilityRole="button"
        onPress={onLibraryPress}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
        testID="novel-library-action"
      >
        <Feather name={inLibrary ? 'minus-circle' : 'plus'} size={15} color={colors.primary} />
        <Text style={[styles.label, { color: colors.foreground }]}>{inLibrary ? 'Remove' : 'Add to library'}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={favorite ? 'Remove novel favorite' : 'Favorite novel'}
        accessibilityRole="button"
        onPress={onFavoritePress}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: favorite ? `${colors.destructive}18` : colors.card,
            borderColor: favorite ? colors.destructive : colors.border,
            opacity: pressed ? 0.72 : 1,
          },
        ]}
        testID="novel-favorite-action"
      >
        <Feather fill={favorite ? colors.destructive : 'transparent'} name="heart" size={15} color={favorite ? colors.destructive : colors.mutedForeground} />
        <Text style={[styles.label, { color: favorite ? colors.destructive : colors.foreground }]}>Favorite</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={downloadComplete ? 'All chapters saved offline' : 'Download all chapters'}
        accessibilityRole="button"
        disabled={downloadDisabled || downloadBusy}
        onPress={onDownloadPress}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.card, borderColor: colors.border, opacity: downloadDisabled ? 0.42 : pressed ? 0.72 : 1 }]}
        testID="novel-download-action"
      >
        {downloadBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={downloadComplete ? 'check-circle' : 'download-cloud'} size={15} color={colors.primary} />}
        <Text style={[styles.label, { color: colors.foreground }]}>{downloadLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 22, marginTop: 20, flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 42, paddingHorizontal: 7, borderWidth: StyleSheet.hairlineWidth, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
