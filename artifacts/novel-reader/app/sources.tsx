import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function SourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (process.env.EXPO_OS === 'web' ? 40 : 12) }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}><Feather name="chevron-left" size={23} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Your Sources</Text>
        <View style={{ width: 23 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Collections you’ve added live here quietly. Reading stays available when a source is having a bad day.</Text>
        <View style={[styles.sourceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sourceTop}><View style={[styles.statusDot, { backgroundColor: colors.primary }]} /><Text style={[styles.sourceName, { color: colors.foreground }]}>My reading shelf</Text><Feather name="more-horizontal" size={18} color={colors.mutedForeground} /></View>
          <Text style={[styles.sourceStatus, { color: colors.mutedForeground }]}>Healthy · Checked just now</Text>
          <Text style={[styles.sourceCount, { color: colors.foreground }]}>3 novels</Text>
          <View style={styles.sourceActions}><Text style={[styles.action, { color: colors.primary }]}>Refresh</Text><Text style={[styles.action, { color: colors.mutedForeground }]}>View novels</Text></View>
        </View>
        <Text style={[styles.addLabel, { color: colors.foreground }]}>Add a collection</Text>
        <Text style={[styles.addHint, { color: colors.mutedForeground }]}>Paste a link. We’ll check it and show you what’s inside.</Text>
        <View style={[styles.linkInput, { borderColor: colors.border, backgroundColor: colors.card }]}><Feather name="link" size={16} color={colors.mutedForeground} /><TextInput testID="source-link" placeholder="https://" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} /></View>
        <Pressable style={({ pressed }) => [styles.connect, { backgroundColor: colors.foreground, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.connectText, { color: colors.background }]}>Check collection</Text></Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Georgia', fontSize: 22 },
  intro: { fontFamily: 'Georgia', fontSize: 17, lineHeight: 26, marginBottom: 25 },
  sourceCard: { borderWidth: 1, borderRadius: 13, padding: 16 },
  sourceTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sourceName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  sourceStatus: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 14 },
  sourceCount: { fontFamily: 'Georgia', fontSize: 25, marginTop: 13 },
  sourceActions: { flexDirection: 'row', gap: 18, marginTop: 14 },
  action: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  addLabel: { fontFamily: 'Georgia', fontSize: 20, marginTop: 38 },
  addHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  linkInput: { height: 48, borderWidth: 1, borderRadius: 10, marginTop: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  connect: { height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  connectText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});