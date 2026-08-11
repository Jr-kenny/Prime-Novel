import { Image, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function BookCover({ source, width, height, favorite = false }: { source: number; width: number; height: number; favorite?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.frame, { width, height, borderColor: colors.border }]}>
      <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {favorite ? <View style={[styles.corner, { borderTopColor: colors.primary }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, backgroundColor: '#ddd' },
  corner: { position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTopWidth: 22, borderLeftWidth: 22, borderLeftColor: 'transparent' },
});