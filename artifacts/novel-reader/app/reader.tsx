import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { ReaderTheme, useReader } from '@/context/ReaderContext';

const paragraphs = [
  'The lamp had been burning for three hours when Mara saw the first ship.',
  'It was not a ship in any ordinary sense. There was no hull to catch the moonlight, no wake behind it, only a slow constellation of windows moving across the black water. She stood with one hand on the brass rail and watched it pass beneath the lighthouse.',
  'In the morning, she would tell herself it had been fog. She would say the sea makes shapes of anything a person needs to see. But for now, she kept the lamp lit.',
];

export default function ReaderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeBook, readerTheme, setReaderTheme, advanceReading, addBookmark, bookmarks } = useReader();
  const isDark = readerTheme !== 'paper';
  const readerBackground = readerTheme === 'paper' ? '#f2eadf' : readerTheme === 'black' ? '#050505' : '#242422';
  const readerText = readerTheme === 'paper' ? '#322b25' : '#eee8de';
  const themeOptions: ReaderTheme[] = ['paper', 'soft-dark', 'black'];
  return (
    <View style={[styles.screen, { backgroundColor: readerBackground }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + (process.env.EXPO_OS === 'web' ? 40 : 10) }]}>
        <Pressable testID="reader-back" hitSlop={12} onPress={() => router.back()}><Feather name="chevron-left" size={23} color={readerText} /></Pressable>
        <Text style={[styles.topTitle, { color: readerText }]} numberOfLines={1}>{activeBook.title}</Text>
        <Pressable testID="reader-bookmark" hitSlop={12} onPress={addBookmark}><Feather name="bookmark" size={19} color={bookmarks.length > 2 ? colors.primary : readerText} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.article, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={[styles.chapterLabel, { color: readerTheme === 'paper' ? colors.primary : colors.tint }]}>CHAPTER {activeBook.chapter}</Text>
        <Text style={[styles.chapterTitle, { color: readerText }]}>The ship beneath the lamp</Text>
        <Text style={[styles.byline, { color: readerTheme === 'paper' ? '#84776a' : '#a39a8e' }]}>{activeBook.author} · 8 min read</Text>
        {paragraphs.map((paragraph, index) => <Text key={paragraph} style={[styles.paragraph, { color: readerText, marginTop: index === 0 ? 28 : 20 }]}>{paragraph}</Text>)}
        <View style={[styles.rule, { backgroundColor: readerTheme === 'paper' ? '#d8cabb' : '#494742' }]} />
        <Text style={[styles.paragraph, { color: readerText }]}>The next evening, she climbed the stairs before sunset. The weather had turned, and the windows trembled in their frames. Out beyond the glass, the horizon was a thin line drawn in charcoal.</Text>
        <Text style={[styles.paragraph, { color: readerText }]}>She brought the old notebook with her. On its first page, in a hand she did not recognize, someone had written: <Text style={styles.italic}>Keep watch for what returns.</Text></Text>
        <Pressable testID="next-chapter" onPress={advanceReading} style={({ pressed }) => [styles.nextButton, { borderColor: readerTheme === 'paper' ? colors.primary : colors.tint, opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.nextText, { color: readerTheme === 'paper' ? colors.primary : colors.tint }]}>Mark chapter read</Text>
          <Feather name="arrow-right" size={16} color={readerTheme === 'paper' ? colors.primary : colors.tint} />
        </Pressable>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, backgroundColor: readerBackground }]}>
        <View style={[styles.ambientTrack, { backgroundColor: isDark ? '#494742' : '#d8cabb' }]}><View style={[styles.ambientFill, { backgroundColor: readerTheme === 'paper' ? colors.primary : colors.tint, width: `${activeBook.progress}%` }]} /></View>
        <View style={styles.controls}>
          {themeOptions.map((theme) => <Pressable key={theme} onPress={() => setReaderTheme(theme)} style={[styles.themeDot, { backgroundColor: theme === 'paper' ? '#e8dccb' : theme === 'soft-dark' ? '#55534d' : '#111', borderColor: readerTheme === theme ? colors.primary : 'transparent' }]} />)}
          <Text style={[styles.position, { color: isDark ? '#aaa398' : '#8c7d6c' }]}>{activeBook.progress}%</Text>
          <Feather name="list" size={19} color={isDark ? '#b8afa4' : '#786d60'} />
          <Feather name="type" size={19} color={isDark ? '#b8afa4' : '#786d60'} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, textAlign: 'center', marginHorizontal: 20 },
  article: { paddingHorizontal: 28, paddingTop: 28 },
  chapterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4 },
  chapterTitle: { fontFamily: 'Georgia', fontSize: 32, lineHeight: 38, marginTop: 9 },
  byline: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 10 },
  paragraph: { fontFamily: 'Georgia', fontSize: 18, lineHeight: 31 },
  italic: { fontStyle: 'italic' },
  rule: { height: 1, width: 46, marginVertical: 28 },
  nextButton: { marginTop: 34, borderWidth: 1, borderRadius: 22, height: 44, paddingHorizontal: 18, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9 },
  nextText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22 },
  ambientTrack: { height: 2, borderRadius: 2, overflow: 'hidden' },
  ambientFill: { height: '100%' },
  controls: { height: 47, flexDirection: 'row', alignItems: 'center', gap: 13 },
  themeDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  position: { fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 'auto' },
});