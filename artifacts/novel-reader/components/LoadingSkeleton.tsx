import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.block, { backgroundColor: colors.secondary }, style]} />;
}

function PulsingSkeleton({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.56)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 720, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.56, duration: 720, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export function SearchResultsSkeleton() {
  const colors = useColors();

  return (
    <View accessibilityLabel="Checking enabled sources" accessibilityRole="progressbar" style={styles.searchSkeleton}>
      <View style={styles.searchSkeletonStatus}>
        <Text style={[styles.searchSkeletonTitle, { color: colors.foreground }]}>Checking enabled sources</Text>
        <Text style={[styles.searchSkeletonCopy, { color: colors.mutedForeground }]}>Results will appear as the search completes.</Text>
      </View>
      <PulsingSkeleton>
        {Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={[styles.searchSkeletonRow, { borderBottomColor: colors.border }]}>
            <SkeletonBlock style={styles.searchSkeletonCover} />
            <View style={styles.searchSkeletonCopyBlock}>
              <SkeletonBlock style={[styles.searchSkeletonLine, styles.searchSkeletonLineLong]} />
              <SkeletonBlock style={[styles.searchSkeletonLine, styles.searchSkeletonLineShort]} />
              <SkeletonBlock style={[styles.searchSkeletonLine, styles.searchSkeletonLineTiny]} />
            </View>
            <SkeletonBlock style={styles.searchSkeletonArrow} />
          </View>
        ))}
      </PulsingSkeleton>
    </View>
  );
}

export function NovelDetailsSkeleton() {
  const colors = useColors();

  return (
    <View accessibilityLabel="Loading novel details" accessibilityRole="progressbar" style={styles.novelSkeleton}>
      <View style={styles.novelSkeletonHero}>
        <PulsingSkeleton style={styles.novelSkeletonHeroPulse}>
          <SkeletonBlock style={styles.novelSkeletonCover} />
        </PulsingSkeleton>
        <View style={styles.novelSkeletonIntro}>
          <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonTitle]} />
          <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonAuthor]} />
          <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonMeta]} />
        </View>
      </View>
      <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonDescription]} />
      <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonDescription, styles.novelSkeletonDescriptionSecond]} />
      <View style={[styles.novelSkeletonButton, { backgroundColor: colors.secondary }]} />
      <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonChapterHeading]} />
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} style={[styles.novelSkeletonChapter, { borderBottomColor: colors.border }]}>
          <View style={styles.novelSkeletonChapterCopy}>
            <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonChapterNumber]} />
            <SkeletonBlock style={[styles.novelSkeletonLine, styles.novelSkeletonChapterTitle]} />
          </View>
          <SkeletonBlock style={styles.novelSkeletonDownload} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 6 },
  searchSkeleton: { marginTop: 8 },
  searchSkeletonStatus: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4, gap: 4 },
  searchSkeletonTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  searchSkeletonCopy: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  searchSkeletonRow: { minHeight: 100, paddingHorizontal: 22, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  searchSkeletonCover: { width: 58, height: 82, borderRadius: 5 },
  searchSkeletonCopyBlock: { flex: 1, gap: 9 },
  searchSkeletonLine: { height: 10 },
  searchSkeletonLineLong: { width: '84%' },
  searchSkeletonLineShort: { width: '48%' },
  searchSkeletonLineTiny: { width: '31%', height: 8 },
  searchSkeletonArrow: { width: 17, height: 17, borderRadius: 9 },
  novelSkeleton: { flex: 1, paddingBottom: 32 },
  novelSkeletonHero: { minHeight: 198, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 18 },
  novelSkeletonHeroPulse: { width: 104, height: 150 },
  novelSkeletonCover: { width: 104, height: 150, borderRadius: 4 },
  novelSkeletonIntro: { flex: 1, gap: 13 },
  novelSkeletonLine: { height: 10 },
  novelSkeletonTitle: { width: '92%', height: 25, borderRadius: 5 },
  novelSkeletonAuthor: { width: '54%' },
  novelSkeletonMeta: { width: '42%', height: 8 },
  novelSkeletonDescription: { marginHorizontal: 22, width: '82%' },
  novelSkeletonDescriptionSecond: { width: '67%', marginTop: 10 },
  novelSkeletonButton: { height: 46, marginHorizontal: 22, marginTop: 24, borderRadius: 23 },
  novelSkeletonChapterHeading: { width: 112, height: 19, marginHorizontal: 22, marginTop: 32, marginBottom: 8 },
  novelSkeletonChapter: { minHeight: 68, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  novelSkeletonChapterCopy: { flex: 1, gap: 8 },
  novelSkeletonChapterNumber: { width: 76, height: 8 },
  novelSkeletonChapterTitle: { width: '62%' },
  novelSkeletonDownload: { width: 20, height: 20, borderRadius: 10 },
});
