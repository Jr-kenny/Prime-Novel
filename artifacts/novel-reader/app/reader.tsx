import { Feather } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  GestureResponderEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useCatalog } from '@/context/CatalogContext';
import { useColors } from '@/hooks/useColors';
import { Book, ReaderFont, ReaderMode, ReaderPreferences, ReaderTheme, useReader } from '@/context/ReaderContext';
import { getReaderFont, getReaderPalette, ReaderPalette } from '@/utils/reader-style';
import { WebLandingButton } from '@/components/WebLandingButton';

const KEEP_AWAKE_TAG = 'prime-novel-reader';
const emptyBook: Book = {
  id: '',
  title: '',
  author: '',
  cover: '',
  sourceId: '',
  wordsPerChapter: 0,
  chapter: 1,
  totalChapters: 1,
  progress: 0,
  status: 'Plan to read',
  lastRead: '',
  genre: '',
  description: '',
};

const coreParagraphs = [
  'The lamp had been burning for three hours when Mara saw the first ship.',
  'It was not a ship in any ordinary sense. There was no hull to catch the moonlight, no wake behind it, only a slow constellation of windows moving across the black water. She stood with one hand on the brass rail and watched it pass beneath the lighthouse.',
  'In the morning, she would tell herself it had been fog. She would say the sea makes shapes of anything a person needs to see. But for now, she kept the lamp lit.',
  'The next evening, she climbed the stairs before sunset. The weather had turned, and the windows trembled in their frames. Out beyond the glass, the horizon was a thin line drawn in charcoal.',
  'She brought the old notebook with her. On its first page, in a hand she did not recognize, someone had written: Keep watch for what returns.',
];

function getChapterTitle(chapter: number) {
  if (chapter === 142) return 'The ship beneath the lamp';
  if (chapter % 3 === 0) return 'The weather turns';
  if (chapter % 2 === 0) return 'A light across the water';
  return 'What returns in the dark';
}

function getChapterParagraphs(chapter: number) {
  if (chapter === 142) return coreParagraphs;
  return [
    `The lamp had been burning since dusk when Mara returned for chapter ${chapter}. The sea had kept its promise and brought something new to the horizon.`,
    ...coreParagraphs.slice(1),
  ];
}

function initialHorizontalChapters(chapter: number, totalChapters: number) {
  const firstChapter = Math.max(1, chapter - 1);
  const lastChapter = Math.min(totalChapters, chapter + 1);
  return Array.from({ length: lastChapter - firstChapter + 1 }, (_, index) => firstChapter + index);
}

function scrollProgress(offset: number, maxOffset: number) {
  if (maxOffset <= 0) return 0;
  return Math.max(0, Math.min(1, offset / maxOffset));
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  palette,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  palette: ReaderPalette;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          onPress={onDecrease}
          style={[styles.stepButton, { borderColor: palette.border }]}
        >
          <Feather name="minus" size={14} color={palette.text} />
        </Pressable>
        <Text style={[styles.stepValue, { color: palette.muted }]}>{value}</Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          onPress={onIncrease}
          style={[styles.stepButton, { borderColor: palette.border }]}
        >
          <Feather name="plus" size={14} color={palette.text} />
        </Pressable>
      </View>
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  palette,
  testID,
  dot,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  palette: ReaderPalette;
  testID?: string;
  dot?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[
        styles.choiceChip,
        { backgroundColor: selected ? palette.accent : palette.surface, borderColor: selected ? palette.accent : palette.border },
      ]}
    >
      {dot ? <View style={[styles.choiceDot, { backgroundColor: dot, borderColor: palette.border }]} /> : null}
      <Text style={[styles.choiceText, { color: selected ? palette.background : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  palette,
  testID,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  palette: ReaderPalette;
  testID: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.settingDescription, { color: palette.muted }]}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        testID={testID}
        trackColor={{ false: palette.border, true: palette.accent }}
        thumbColor={value ? palette.text : palette.muted}
        value={value}
      />
    </View>
  );
}

function SettingsSection({ label, children, palette }: { label: string; children: React.ReactNode; palette: ReaderPalette }) {
  return (
    <View style={styles.settingsSection}>
      <Text style={[styles.settingsSectionLabel, { color: palette.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

function ReaderSettingsPanel({
  preferences,
  palette,
  isChapterRead,
  onChange,
  onClose,
  onOpenNovel,
  onMarkRead,
  onMarkUnread,
}: {
  preferences: ReaderPreferences;
  palette: ReaderPalette;
  isChapterRead: boolean;
  onChange: (changes: Partial<ReaderPreferences>) => void;
  onClose: () => void;
  onOpenNovel: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}) {
  const step = (key: 'lineHeight' | 'paragraphSpacing' | 'margins', amount: number) => {
    const nextValue = preferences[key] + amount;
    const bounds = {
      lineHeight: [24, 60],
      paragraphSpacing: [8, 48],
      margins: [14, 48],
    }[key];
    onChange({ [key]: Math.max(bounds[0], Math.min(bounds[1], nextValue)) });
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
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.settingsOverlay} testID="reader-settings-panel">
      <Pressable accessibilityLabel="Close reader settings" onPress={onClose} style={styles.settingsScrim} />
      <Animated.View entering={SlideInUp.duration(240)} exiting={SlideOutDown.duration(180)} style={[styles.settingsPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.settingsHeader}>
          <View>
            <Text style={[styles.settingsTitle, { color: palette.text }]}>Reader settings</Text>
            <Text style={[styles.settingsSubtitle, { color: palette.muted }]}>Make the page feel like yours.</Text>
          </View>
          <Pressable accessibilityLabel="Close reader settings" accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={palette.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
          <SettingsSection label="TYPE" palette={palette}>
            <Stepper label="Text size" value={`${preferences.textSize}`} onDecrease={() => changeTextSize(-1)} onIncrease={() => changeTextSize(1)} palette={palette} />
            <Stepper label="Line height" value={`${preferences.lineHeight}`} onDecrease={() => step('lineHeight', -1)} onIncrease={() => step('lineHeight', 1)} palette={palette} />
            <Stepper label="Paragraph spacing" value={`${preferences.paragraphSpacing}`} onDecrease={() => step('paragraphSpacing', -2)} onIncrease={() => step('paragraphSpacing', 2)} palette={palette} />
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: palette.text }]}>Paragraph indentation</Text>
              <Switch
                accessibilityLabel="Paragraph indentation"
                onValueChange={(value) => onChange({ paragraphIndent: value })}
                trackColor={{ false: palette.border, true: palette.accent }}
                thumbColor={preferences.paragraphIndent ? palette.text : palette.muted}
                value={preferences.paragraphIndent}
              />
            </View>
            <Stepper label="Margins" value={`${preferences.margins}`} onDecrease={() => step('margins', -2)} onIncrease={() => step('margins', 2)} palette={palette} />
            <Text style={[styles.settingGroupLabel, { color: palette.muted }]}>Fonts</Text>
            <View style={styles.choiceRow}>
              <ChoiceChip label="Serif" selected={preferences.font === 'serif'} onPress={() => onChange({ font: 'serif' as ReaderFont })} palette={palette} testID="font-serif" />
              <ChoiceChip label="Sans" selected={preferences.font === 'sans'} onPress={() => onChange({ font: 'sans' as ReaderFont })} palette={palette} testID="font-sans" />
              <ChoiceChip label="Merriweather" selected={preferences.font === 'merriweather'} onPress={() => onChange({ font: 'merriweather' as ReaderFont })} palette={palette} testID="font-merriweather" />
              <ChoiceChip label="Atkinson" selected={preferences.font === 'atkinson'} onPress={() => onChange({ font: 'atkinson' as ReaderFont })} palette={palette} testID="font-atkinson" />
            </View>
          </SettingsSection>

          <SettingsSection label="THEME" palette={palette}>
            <View style={styles.choiceRow}>
              <ChoiceChip label="Paper" selected={preferences.theme === 'paper'} onPress={() => onChange({ theme: 'paper' })} palette={palette} testID="theme-paper" dot="#f2eadf" />
              <ChoiceChip label="Soft dark" selected={preferences.theme === 'soft-dark'} onPress={() => onChange({ theme: 'soft-dark' })} palette={palette} testID="theme-soft-dark" dot="#242422" />
              <ChoiceChip label="Black" selected={preferences.theme === 'black'} onPress={() => onChange({ theme: 'black' })} palette={palette} testID="theme-black" dot="#050505" />
              <ChoiceChip label="White" selected={preferences.theme === 'white'} onPress={() => onChange({ theme: 'white' })} palette={palette} testID="theme-white" dot="#ffffff" />
            </View>
          </SettingsSection>

          <SettingsSection label="NAVIGATION" palette={palette}>
            <View style={styles.choiceRow}>
              <ChoiceChip label="Vertical" selected={preferences.mode === 'vertical'} onPress={() => onChange({ mode: 'vertical' as ReaderMode })} palette={palette} testID="mode-vertical" />
              <ChoiceChip label="Pages" selected={preferences.mode === 'horizontal'} onPress={() => onChange({ mode: 'horizontal' as ReaderMode })} palette={palette} testID="mode-horizontal" />
            </View>
          </SettingsSection>

          <SettingsSection label="READER" palette={palette}>
            <ToggleRow
              description="Hide the reading controls for an uninterrupted page."
              label="Fullscreen"
              onValueChange={(value) => onChange({ fullscreen: value })}
              palette={palette}
              testID="toggle-fullscreen"
              value={preferences.fullscreen}
            />
            <ToggleRow
              description="Keep the screen awake while you read."
              label="Keep screen awake"
              onValueChange={(value) => onChange({ keepScreenAwake: value })}
              palette={palette}
              testID="toggle-keep-awake"
              value={preferences.keepScreenAwake}
            />
            <ToggleRow
              description="Keep the reader in its current orientation."
              label="Lock rotation"
              onValueChange={(value) => onChange({ lockRotation: value })}
              palette={palette}
              testID="toggle-lock-rotation"
              value={preferences.lockRotation}
            />
          </SettingsSection>

          <SettingsSection label="NOVEL" palette={palette}>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenNovel}
              style={[styles.manualAction, { borderColor: palette.border }]}
            >
              <Text style={[styles.manualActionText, { color: palette.text }]}>Novel details and actions</Text>
              <Feather name="book-open" size={16} color={palette.accent} />
            </Pressable>
          </SettingsSection>

          <SettingsSection label="CHAPTER" palette={palette}>
            <Pressable
              accessibilityRole="button"
              onPress={isChapterRead ? onMarkUnread : onMarkRead}
              testID="reader-manual-mark"
              style={[styles.manualAction, { borderColor: palette.border }]}
            >
              <Text style={[styles.manualActionText, { color: palette.text }]}>{isChapterRead ? 'Mark chapter unread' : 'Mark chapter read'}</Text>
              <Feather name="check-circle" size={16} color={palette.accent} />
            </Pressable>
          </SettingsSection>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function Paragraphs({
  paragraphs,
  preferences,
  palette,
  startOffset = 0,
  keyPrefix,
}: {
  paragraphs: string[];
  preferences: ReaderPreferences;
  palette: ReaderPalette;
  startOffset?: number;
  keyPrefix: string;
}) {
  const readerFont = getReaderFont(preferences.font);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text
          key={`${keyPrefix}-${index}`}
          style={[
            styles.paragraph,
            {
              color: palette.text,
              fontFamily: readerFont.body,
              fontSize: preferences.textSize,
              lineHeight: preferences.lineHeight,
              marginTop: index === 0 && startOffset === 0 ? 28 : preferences.paragraphSpacing,
            },
          ]}
        >
          {preferences.paragraphIndent && index > 0 ? '\u2003\u2003' : ''}
          {paragraph}
        </Text>
      ))}
    </>
  );
}

export default function ReaderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hydrated: appHydrated, recordHistory, recordReadingSession } = useApp();
  const { getChapter } = useCatalog();
  const { width } = useWindowDimensions();
  const {
    activeBook: selectedBook,
    readerPreferences,
    updateReaderPreferences,
    advanceReading,
    setActiveChapter,
    addBookmark,
    bookmarks,
    getReadingPosition,
    saveReadingPosition,
    markChapterRead,
    markChapterUnread,
    isChapterRead,
    hydrated,
  } = useReader();
  const activeBook = selectedBook ?? emptyBook;
  const hasActiveBook = Boolean(selectedBook);
  const palette = getReaderPalette(readerPreferences.theme, colors);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loadedChapters, setLoadedChapters] = useState<number[]>([activeBook.chapter]);
  const [horizontalChapters, setHorizontalChapters] = useState<number[]>(() => initialHorizontalChapters(activeBook.chapter, activeBook.totalChapters));
  const [horizontalPageIndex, setHorizontalPageIndex] = useState(() => Math.max(0, initialHorizontalChapters(activeBook.chapter, activeBook.totalChapters).indexOf(activeBook.chapter)));
  const [chapterContent, setChapterContent] = useState<Record<number, string[]>>({});
  const [chapterErrors, setChapterErrors] = useState<Record<number, string>>({});
  const [loadingChapters, setLoadingChapters] = useState<Set<number>>(new Set());
  const chapterContentRef = useRef<Record<number, string[]>>({});
  const loadingChaptersRef = useRef<Set<number>>(new Set());
  const activeBookIdRef = useRef(activeBook.id);
  const readerMountedRef = useRef(true);
  const verticalRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);
  const horizontalChapterRefs = useRef<Record<number, ScrollView | null>>({});
  const horizontalChapterReachedEndRef = useRef<Set<number>>(new Set());
  const verticalChapterOffsetsRef = useRef<Record<number, number>>({});
  const verticalContentHeightRef = useRef(0);
  const verticalViewportHeightRef = useRef(0);
  const horizontalChapterContentHeightsRef = useRef<Record<number, number>>({});
  const horizontalChapterViewportHeightsRef = useRef<Record<number, number>>({});
  const restoredHorizontalPositionsRef = useRef<Set<string>>(new Set());
  const restoringHorizontalPositionsRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const hasScrolledRef = useRef(false);
  const advancingRef = useRef(false);
  const suppressVerticalSaveRef = useRef(false);
  const lastPositionWriteRef = useRef(0);
  const lastPositionChapterRef = useRef<number | null>(null);
  const horizontalPageIndexRef = useRef(horizontalPageIndex);
  const finalChapterMarkedRef = useRef<number | null>(null);
  const chromeProgress = useSharedValue(1);
  const pageWidth = Math.max(width, 320);
  const horizontalItems = useMemo(() => horizontalChapters, [horizontalChapters]);
  const hasNextChapter = activeBook.chapter < activeBook.totalChapters;
  const isCurrentChapterRead = isChapterRead(activeBook.chapter);
  const chromeVisible = controlsVisible || settingsOpen;
  const chromeTopHeight = insets.top + (Platform.OS === 'web' ? 40 : 10) + 23 + 12;
  const readerContentTopPadding = chromeTopHeight + 28;
  const readerContentBottomPadding = insets.bottom + 110;
  const isRemoteBook = Boolean(activeBook.sourceUrl);

  useEffect(() => {
    activeBookIdRef.current = activeBook.id;
    chapterContentRef.current = {};
    loadingChaptersRef.current = new Set();
    setChapterContent({});
    setChapterErrors({});
    setLoadingChapters(new Set());
  }, [activeBook.id]);

  useEffect(() => {
    readerMountedRef.current = true;
    return () => {
      readerMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const chaptersToLoad = Array.from(new Set(readerPreferences.mode === 'horizontal' ? horizontalItems : loadedChapters));
    const remoteChapters = chaptersToLoad
      .map((chapterNumber) => activeBook.chapters?.find((chapter) => chapter.number === chapterNumber))
      .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter));
    if (!isRemoteBook || remoteChapters.length === 0) return;

    remoteChapters.forEach((chapter) => {
      if (chapterContentRef.current[chapter.number] || loadingChaptersRef.current.has(chapter.number)) return;
      const bookId = activeBook.id;
      loadingChaptersRef.current.add(chapter.number);
      setLoadingChapters(new Set(loadingChaptersRef.current));
      void getChapter(chapter, activeBook.sourceId)
        .then((content) => {
          if (!readerMountedRef.current || activeBookIdRef.current !== bookId) return;
          chapterContentRef.current = { ...chapterContentRef.current, [chapter.number]: content.paragraphs };
          setChapterContent((current) => ({ ...current, [chapter.number]: content.paragraphs }));
          setChapterErrors((current) => {
            const next = { ...current };
            delete next[chapter.number];
            return next;
          });
        })
        .catch((error: unknown) => {
          if (!readerMountedRef.current || activeBookIdRef.current !== bookId) return;
          setChapterErrors((current) => ({ ...current, [chapter.number]: error instanceof Error ? error.message : 'Chapter could not be loaded.' }));
        })
        .finally(() => {
          if (activeBookIdRef.current !== bookId) return;
          loadingChaptersRef.current.delete(chapter.number);
          if (readerMountedRef.current) setLoadingChapters(new Set(loadingChaptersRef.current));
        });
    });
  }, [activeBook.chapters, activeBook.id, activeBook.sourceId, getChapter, horizontalItems, isRemoteBook, loadedChapters, readerPreferences.mode]);

  useEffect(() => {
    if (!hydrated || !appHydrated || !hasActiveBook) return;

    recordHistory({ bookId: activeBook.id, chapter: activeBook.chapter });
    let lastRecordedAt = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      recordReadingSession(activeBook.id, now - lastRecordedAt, 0);
      lastRecordedAt = now;
    }, 15_000);

    return () => {
      clearInterval(interval);
      recordReadingSession(activeBook.id, Date.now() - lastRecordedAt, 0);
    };
  }, [activeBook.chapter, activeBook.id, appHydrated, hasActiveBook, hydrated, recordHistory, recordReadingSession]);

  useEffect(() => {
    chromeProgress.value = withTiming(chromeVisible ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [chromeProgress, chromeVisible]);

  const chromeTopStyle = useAnimatedStyle(() => ({
    opacity: chromeProgress.value,
    transform: [{ translateY: -100 * (1 - chromeProgress.value) }],
  }));
  const chromeBottomStyle = useAnimatedStyle(() => ({
    opacity: chromeProgress.value,
    transform: [{ translateY: 100 * (1 - chromeProgress.value) }],
  }));

  useEffect(() => {
    setControlsVisible(!readerPreferences.fullscreen);
  }, [readerPreferences.fullscreen]);

  useEffect(() => {
    if (!hydrated) return;
    const chapters = initialHorizontalChapters(activeBook.chapter, activeBook.totalChapters);
    const initialPageIndex = Math.max(0, chapters.indexOf(activeBook.chapter));
    setLoadedChapters([activeBook.chapter]);
    setHorizontalChapters(chapters);
    horizontalPageIndexRef.current = initialPageIndex;
    setHorizontalPageIndex(initialPageIndex);
    horizontalChapterRefs.current = {};
    horizontalChapterReachedEndRef.current.clear();
    verticalChapterOffsetsRef.current = {};
    verticalContentHeightRef.current = 0;
    verticalViewportHeightRef.current = 0;
    horizontalChapterContentHeightsRef.current = {};
    horizontalChapterViewportHeightsRef.current = {};
    restoredHorizontalPositionsRef.current.clear();
    restoringHorizontalPositionsRef.current.clear();
    hasScrolledRef.current = false;
    finalChapterMarkedRef.current = null;
  }, [hydrated, activeBook.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (readerPreferences.mode === 'horizontal') {
      const chapters = initialHorizontalChapters(activeBook.chapter, activeBook.totalChapters);
      const initialPageIndex = Math.max(0, chapters.indexOf(activeBook.chapter));
      setHorizontalChapters(chapters);
      horizontalPageIndexRef.current = initialPageIndex;
      setHorizontalPageIndex(initialPageIndex);
      restoredHorizontalPositionsRef.current.clear();
      restoringHorizontalPositionsRef.current.clear();
      horizontalChapterReachedEndRef.current.clear();
      horizontalChapterContentHeightsRef.current = {};
      horizontalChapterViewportHeightsRef.current = {};
      return;
    }

    setLoadedChapters([activeBook.chapter]);
    horizontalChapterReachedEndRef.current.clear();
    verticalChapterOffsetsRef.current = {};
    hasScrolledRef.current = false;
    finalChapterMarkedRef.current = null;
  }, [hydrated, readerPreferences.mode, activeBook.id]);

  useEffect(() => {
    if (!hydrated) return;
    requestAnimationFrame(() => {
      if (readerPreferences.mode === 'horizontal') {
        const currentIndex = horizontalItems.findIndex((chapter) => chapter === activeBook.chapter);
        if (currentIndex < 0) return;
        horizontalPageIndexRef.current = currentIndex;
        setHorizontalPageIndex(currentIndex);
        horizontalRef.current?.scrollTo({ x: currentIndex * pageWidth, animated: false });
        restoreHorizontalChapter(activeBook.chapter);
      } else {
        restoreVerticalPosition();
      }
    });
  }, [hydrated, activeBook.id, horizontalItems, pageWidth, readerPreferences.mode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root');
    const previous = {
      html: document.documentElement.style.backgroundColor,
      body: document.body.style.backgroundColor,
      root: root?.style.backgroundColor ?? '',
    };
    document.documentElement.style.backgroundColor = palette.background;
    document.body.style.backgroundColor = palette.background;
    if (root) root.style.backgroundColor = palette.background;
    return () => {
      document.documentElement.style.backgroundColor = previous.html;
      document.body.style.backgroundColor = previous.body;
      if (root) root.style.backgroundColor = previous.root;
    };
  }, [palette.background]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void SystemUI.setBackgroundColorAsync(palette.background).catch(() => {});
    }
  }, [palette.background]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (readerPreferences.fullscreen) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, [readerPreferences.fullscreen]);

  useEffect(() => {
    if (!readerPreferences.keepScreenAwake) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [readerPreferences.keepScreenAwake]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const applyRotationPreference = async () => {
      try {
        if (!readerPreferences.lockRotation) {
          await ScreenOrientation.unlockAsync();
          return;
        }

        const orientation = await ScreenOrientation.getOrientationAsync();
        if (cancelled) return;

        const isLandscape = orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        await ScreenOrientation.lockAsync(isLandscape ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT);
      } catch {
        // Orientation locking is unavailable in some preview environments.
      }
    };

    void applyRotationPreference();
    return () => {
      cancelled = true;
      void ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, [readerPreferences.lockRotation]);

  const savePosition = (chapter: number, position: Partial<{ verticalOffset: number; pageIndex: number; chapterProgress: number }>) => {
    const now = Date.now();
    if (now - lastPositionWriteRef.current < 220 && position.verticalOffset !== undefined && lastPositionChapterRef.current === chapter) return;
    lastPositionWriteRef.current = now;
    lastPositionChapterRef.current = chapter;
    saveReadingPosition({ chapter, ...position }, activeBook.id);
  };

  const restoreVerticalPosition = () => {
    const position = getReadingPosition(activeBook.id, activeBook.chapter);
    const chapterTop = verticalChapterOffsetsRef.current[activeBook.chapter] ?? 0;
    const followingChapter = loadedChapters
      .filter((chapter) => chapter > activeBook.chapter)
      .sort((left, right) => left - right)[0];
    const contentHeight = verticalContentHeightRef.current;
    const viewportHeight = verticalViewportHeightRef.current;
    const chapterEnd = followingChapter === undefined
      ? contentHeight
      : verticalChapterOffsetsRef.current[followingChapter] ?? contentHeight;
    const chapterMaxOffset = contentHeight > 0 && viewportHeight > 0
      ? Math.max(0, chapterEnd - chapterTop - viewportHeight)
      : 0;
    const chapterOffset = position.chapterProgress > 0 && chapterMaxOffset > 0
      ? chapterMaxOffset * position.chapterProgress
      : position.verticalOffset;

    requestAnimationFrame(() => {
      verticalRef.current?.scrollTo({ y: Math.max(0, chapterTop + chapterOffset), animated: false });
    });
  };

  const advanceToNextChapter = () => {
    if (advancingRef.current || !hasNextChapter) return;
    advancingRef.current = true;
    suppressVerticalSaveRef.current = true;
    const nextChapter = advanceReading();
    if (nextChapter) {
      setLoadedChapters((chapters) => (chapters.includes(nextChapter) ? chapters : [...chapters, nextChapter]));
      hasScrolledRef.current = false;
    }
    setTimeout(() => {
      advancingRef.current = false;
      suppressVerticalSaveRef.current = false;
    }, 300);
  };

  const visibleVerticalChapter = (offset: number) => {
    let visibleChapter = loadedChapters[0] ?? activeBook.chapter;
    loadedChapters.forEach((chapter) => {
      const chapterTop = verticalChapterOffsetsRef.current[chapter];
      if (chapterTop !== undefined && chapterTop <= offset + 24) visibleChapter = chapter;
    });
    return visibleChapter;
  };

  const handleVerticalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offset = Math.max(0, contentOffset.y);
    if (offset > 20) hasScrolledRef.current = true;
    const currentChapter = visibleVerticalChapter(offset);
    if (currentChapter !== activeBook.chapter && currentChapter < activeBook.chapter) {
      setActiveChapter(currentChapter);
    }
    const chapterTop = verticalChapterOffsetsRef.current[currentChapter] ?? 0;
    const followingChapter = loadedChapters
      .filter((chapter) => chapter > currentChapter)
      .sort((left, right) => left - right)[0];
    const chapterEnd = followingChapter === undefined
      ? contentSize.height
      : verticalChapterOffsetsRef.current[followingChapter] ?? contentSize.height;
    const chapterMaxOffset = Math.max(1, chapterEnd - chapterTop - layoutMeasurement.height);
    const chapterOffset = Math.max(0, offset - chapterTop);
    if (!suppressVerticalSaveRef.current) savePosition(currentChapter, { verticalOffset: chapterOffset, chapterProgress: scrollProgress(chapterOffset, chapterMaxOffset) });
    const reachedEnd = contentSize.height > layoutMeasurement.height + 40 && offset + layoutMeasurement.height >= contentSize.height - 80;
    if (hasScrolledRef.current && reachedEnd) {
      if (hasNextChapter) {
        advanceToNextChapter();
      } else if (finalChapterMarkedRef.current !== activeBook.chapter) {
        finalChapterMarkedRef.current = activeBook.chapter;
        markChapterRead(activeBook.chapter);
      }
    }
  };

  const handleVerticalScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const currentChapter = visibleVerticalChapter(offset);
    const chapterTop = verticalChapterOffsetsRef.current[currentChapter] ?? 0;
    const followingChapter = loadedChapters
      .filter((chapter) => chapter > currentChapter)
      .sort((left, right) => left - right)[0];
    const chapterEnd = followingChapter === undefined
      ? event.nativeEvent.contentSize.height
      : verticalChapterOffsetsRef.current[followingChapter] ?? event.nativeEvent.contentSize.height;
    const chapterMaxOffset = Math.max(1, chapterEnd - chapterTop - event.nativeEvent.layoutMeasurement.height);
    const chapterOffset = Math.max(0, offset - chapterTop);
    savePosition(currentChapter, { verticalOffset: chapterOffset, chapterProgress: scrollProgress(chapterOffset, chapterMaxOffset) });
  };

  const restoreHorizontalChapter = (chapter: number) => {
    if (!hydrated || !horizontalChapterRefs.current[chapter]) return;
    const positionKey = `${activeBook.id}:${chapter}`;
    if (restoredHorizontalPositionsRef.current.has(positionKey)) return;
    const contentHeight = horizontalChapterContentHeightsRef.current[chapter] ?? 0;
    const viewportHeight = horizontalChapterViewportHeightsRef.current[chapter] ?? 0;
    if (contentHeight <= 0 || viewportHeight <= 0) return;
    const position = getReadingPosition(activeBook.id, chapter);
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    const offset = position.chapterProgress > 0 && maxOffset > 0
      ? maxOffset * position.chapterProgress
      : position.verticalOffset;
    restoredHorizontalPositionsRef.current.add(positionKey);
    restoringHorizontalPositionsRef.current.add(positionKey);
    requestAnimationFrame(() => {
      horizontalChapterRefs.current[chapter]?.scrollTo({ y: Math.max(0, offset), animated: false });
      setTimeout(() => restoringHorizontalPositionsRef.current.delete(positionKey), 120);
    });
  };

  const handleHorizontalChapterScroll = (chapter: number, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const positionKey = `${activeBook.id}:${chapter}`;
    if (restoringHorizontalPositionsRef.current.has(positionKey)) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const chapterOffset = Math.max(0, contentOffset.y);
    savePosition(chapter, { verticalOffset: chapterOffset, chapterProgress: scrollProgress(chapterOffset, contentSize.height - layoutMeasurement.height) });
    const reachedEnd = contentSize.height > layoutMeasurement.height + 40 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
    if (reachedEnd) horizontalChapterReachedEndRef.current.add(chapter);
    if (chapter === activeBook.totalChapters && reachedEnd && finalChapterMarkedRef.current !== chapter) {
      finalChapterMarkedRef.current = chapter;
      markChapterRead(chapter);
    }
  };

  const handleHorizontalChapterScrollEnd = (chapter: number, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const chapterOffset = Math.max(0, contentOffset.y);
    savePosition(chapter, { verticalOffset: chapterOffset, chapterProgress: scrollProgress(chapterOffset, contentSize.height - layoutMeasurement.height) });
  };

  const handleHorizontalPageEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.max(0, Math.min(horizontalItems.length - 1, Math.round(event.nativeEvent.contentOffset.x / pageWidth)));
    const previousPage = horizontalPageIndexRef.current;
    if (nextPage === previousPage) return;
    horizontalPageIndexRef.current = nextPage;
    setHorizontalPageIndex(nextPage);

    const nextChapter = horizontalItems[nextPage];
    const previousChapter = horizontalItems[previousPage];
    if (nextChapter === undefined) return;

    if (
      nextPage > previousPage &&
      previousChapter !== undefined &&
      nextChapter === previousChapter + 1 &&
      horizontalChapterReachedEndRef.current.has(previousChapter)
    ) {
      markChapterRead(previousChapter);
    }

    if (nextChapter !== activeBook.chapter) {
      const position = getReadingPosition(activeBook.id, nextChapter);
      setActiveChapter(nextChapter);
      savePosition(nextChapter, { verticalOffset: position.verticalOffset, pageIndex: 0 });
    }

    if (nextPage === horizontalItems.length - 1 && nextChapter < activeBook.totalChapters) {
      const followingChapter = nextChapter + 1;
      if (!horizontalChapters.includes(followingChapter)) {
        setHorizontalChapters((chapters) => [...chapters, followingChapter]);
      }
    }
  };

  const handleReadingTouchStart = (event: GestureResponderEvent) => {
    touchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      time: Date.now(),
    };
  };

  const handleReadingTouchEnd = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web') return;
    const start = touchStartRef.current;
    const moved = Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) > 12;
    const wasTap = Date.now() - start.time < 450;
    if (!settingsOpen && wasTap && !moved) setControlsVisible((visible) => !visible);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleReadingSurfaceClick = (event: MouseEvent) => {
      if (settingsOpen || !(event.target instanceof Element)) return;
      const readingSurface = event.target.closest('[data-testid="reader-vertical-scroll"], [data-testid="reader-horizontal-scroll"]');
      if (readingSurface) setControlsVisible((visible) => !visible);
    };
    document.addEventListener('click', handleReadingSurfaceClick);
    return () => document.removeEventListener('click', handleReadingSurfaceClick);
  }, [readerPreferences.mode, settingsOpen]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/chapters');
    }
  };

  const paragraphsFor = (chapter: number) => isRemoteBook ? chapterContent[chapter] ?? [] : getChapterParagraphs(chapter);
  const titleFor = (chapter: number) => activeBook.chapters?.find((item) => item.number === chapter)?.title ?? getChapterTitle(chapter);
  const chapterStatus = (chapter: number) => {
    if (isRemoteBook && !activeBook.chapters?.some((item) => item.number === chapter)) return 'Chapter content unavailable.';
    if (loadingChapters.has(chapter)) return 'Loading chapter…';
    if (chapterErrors[chapter]) return 'Chapter unavailable right now.';
    return undefined;
  };

  if (!hasActiveBook) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }]}>
        <Text style={[styles.chapterTitle, { color: palette.text, fontSize: 22, lineHeight: 28 }]}>Open a novel to start reading.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar backgroundColor={palette.background} hidden={readerPreferences.fullscreen} style={palette.statusBarStyle} />
      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[
          styles.topBar,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 40 : 10), backgroundColor: palette.background },
          chromeTopStyle,
        ]}
      >
          <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={goBack} testID="reader-back">
            <Feather name="chevron-left" size={23} color={palette.text} />
          </Pressable>
          <Text style={[styles.topTitle, { color: palette.text }]} numberOfLines={1}>{activeBook.title}</Text>
          <View style={styles.topActions}>
            <WebLandingButton color={palette.text} />
            <Pressable accessibilityLabel="Add bookmark" accessibilityRole="button" hitSlop={12} onPress={() => addBookmark(activeBook.chapter)} testID="reader-bookmark">
              <Feather name="bookmark" size={19} color={bookmarks.length > 2 ? palette.accent : palette.text} />
            </Pressable>
          </View>
      </Animated.View>

      {readerPreferences.mode === 'vertical' ? (
        <ScrollView
          style={styles.readerContent}
          contentContainerStyle={{ paddingHorizontal: readerPreferences.margins, paddingTop: readerContentTopPadding, paddingBottom: readerContentBottomPadding }}
          onScroll={handleVerticalScroll}
          onScrollEndDrag={handleVerticalScrollEnd}
          onContentSizeChange={(_, height) => {
            verticalContentHeightRef.current = height;
            restoreVerticalPosition();
          }}
          onLayout={(event) => {
            verticalViewportHeightRef.current = event.nativeEvent.layout.height;
            restoreVerticalPosition();
          }}
          onTouchEnd={handleReadingTouchEnd}
          onTouchStart={handleReadingTouchStart}
          ref={verticalRef}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator={false}
          testID="reader-vertical-scroll"
        >
          {loadedChapters.map((chapter, chapterIndex) => (
            <View
              key={`${activeBook.id}-${chapter}`}
              onLayout={(event) => {
                verticalChapterOffsetsRef.current[chapter] = event.nativeEvent.layout.y;
              }}
              style={chapterIndex > 0 ? [styles.chapterBlock, { borderTopColor: palette.border }] : undefined}
            >
              <Text style={[styles.chapterLabel, { color: palette.accent }]}>CHAPTER {chapter}</Text>
              <Text style={[styles.chapterTitle, { color: palette.text, fontFamily: getReaderFont(readerPreferences.font).heading, fontSize: readerPreferences.textSize + 14, lineHeight: readerPreferences.textSize + 20 }]}>{titleFor(chapter)}</Text>
              <Text style={[styles.byline, { color: palette.muted }]}>{activeBook.author} · 8 min read</Text>
              {chapterStatus(chapter) ? <Text style={[styles.chapterLoading, { color: palette.muted }]}>{chapterStatus(chapter)}</Text> : <Paragraphs paragraphs={paragraphsFor(chapter)} preferences={readerPreferences} palette={palette} keyPrefix={`${activeBook.id}-${chapter}`} />}
            </View>
          ))}
          {!hasNextChapter ? (
            <View style={[styles.endNote, { borderTopColor: palette.border }]}>
              <Feather name="check" size={17} color={palette.accent} />
              <Text style={[styles.endNoteText, { color: palette.muted }]}>You have reached the end of this story.</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.readerContent}
          contentContainerStyle={styles.horizontalContent}
          horizontal
          onMomentumScrollEnd={handleHorizontalPageEnd}
          nestedScrollEnabled
          onTouchEnd={handleReadingTouchEnd}
          onTouchStart={handleReadingTouchStart}
          pagingEnabled
          ref={horizontalRef}
          showsHorizontalScrollIndicator={false}
          testID="reader-horizontal-scroll"
        >
          {horizontalItems.map((chapter) => (
            <View key={`${activeBook.id}-horizontal-${chapter}`} style={[styles.page, { width: pageWidth, backgroundColor: palette.background }]}>
              <ScrollView
                  contentContainerStyle={{ paddingHorizontal: readerPreferences.margins, paddingTop: readerContentTopPadding, paddingBottom: readerContentBottomPadding }}
                  directionalLockEnabled
                  nestedScrollEnabled
                  onContentSizeChange={(_, height) => {
                    horizontalChapterContentHeightsRef.current[chapter] = height;
                    restoreHorizontalChapter(chapter);
                  }}
                  onLayout={(event) => {
                    horizontalChapterViewportHeightsRef.current[chapter] = event.nativeEvent.layout.height;
                    restoreHorizontalChapter(chapter);
                  }}
                  onScroll={(event) => handleHorizontalChapterScroll(chapter, event)}
                  onScrollEndDrag={(event) => handleHorizontalChapterScrollEnd(chapter, event)}
                  ref={(reference) => {
                    horizontalChapterRefs.current[chapter] = reference;
                  }}
                  scrollEventThrottle={100}
                  showsVerticalScrollIndicator={false}
                  style={styles.chapterPageScroll}
                >
                  <Text style={[styles.chapterLabel, { color: palette.accent }]}>CHAPTER {chapter}</Text>
                  <Text style={[styles.chapterTitle, { color: palette.text, fontFamily: getReaderFont(readerPreferences.font).heading, fontSize: readerPreferences.textSize + 14, lineHeight: readerPreferences.textSize + 20 }]}>{titleFor(chapter)}</Text>
                  <Text style={[styles.byline, { color: palette.muted }]}>{activeBook.author} · 8 min read</Text>
                  {chapterStatus(chapter) ? <Text style={[styles.chapterLoading, { color: palette.muted }]}>{chapterStatus(chapter)}</Text> : <Paragraphs paragraphs={paragraphsFor(chapter)} preferences={readerPreferences} palette={palette} keyPrefix={`${activeBook.id}-horizontal-${chapter}`} />}
                  {chapter === activeBook.totalChapters ? (
                    <View style={[styles.endNote, { borderTopColor: palette.border }]}>
                      <Feather name="check" size={17} color={palette.accent} />
                      <Text style={[styles.endNoteText, { color: palette.muted }]}>You have reached the end of this story.</Text>
                    </View>
                  ) : null}
                </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + 10, backgroundColor: palette.background },
          chromeBottomStyle,
        ]}
      >
          <View style={[styles.ambientTrack, { backgroundColor: palette.track }]}>
            <View style={[styles.ambientFill, { backgroundColor: palette.accent, width: `${activeBook.progress}%` }]} />
          </View>
          <View style={styles.controls}>
            <View style={styles.themeDots}>
              {(['paper', 'soft-dark', 'black', 'white'] as ReaderTheme[]).map((theme) => (
                <Pressable
                  accessibilityLabel={`${theme} reader theme`}
                  accessibilityRole="button"
                  hitSlop={10}
                  key={theme}
                  onPress={() => updateReaderPreferences({ theme })}
                  style={[styles.themeDot, { backgroundColor: theme === 'paper' ? '#e8dccb' : theme === 'soft-dark' ? '#55534d' : theme === 'black' ? '#111111' : '#ffffff', borderColor: readerPreferences.theme === theme ? palette.accent : palette.border }]}
                  testID={`reader-theme-${theme}`}
                />
              ))}
            </View>
            <Text style={[styles.position, { color: palette.muted }]}>{activeBook.progress}%</Text>
            <Text style={[styles.modeLabel, { color: palette.muted }]}>{readerPreferences.mode === 'vertical' ? 'Continuous' : `Chapter ${activeBook.chapter}`}</Text>
            <Pressable
              accessibilityLabel="Reader settings"
              accessibilityRole="button"
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.readerSettingsButton, { backgroundColor: palette.surface, opacity: pressed ? 0.72 : 1 }]}
              testID="reader-settings"
            >
              <Feather name="sliders" size={18} color={palette.text} />
            </Pressable>
          </View>
      </Animated.View>

      {settingsOpen ? (
        <ReaderSettingsPanel
          isChapterRead={isCurrentChapterRead}
          onChange={updateReaderPreferences}
          onClose={() => setSettingsOpen(false)}
          onOpenNovel={() => {
            setSettingsOpen(false);
            router.push('/chapters');
          }}
          onMarkRead={() => markChapterRead(activeBook.chapter)}
          onMarkUnread={() => markChapterUnread(activeBook.chapter)}
          palette={palette}
          preferences={readerPreferences}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readerContent: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, textAlign: 'center', marginHorizontal: 18 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  article: { paddingTop: 28 },
  chapterBlock: { marginTop: 42, paddingTop: 28, borderTopWidth: 1 },
  chapterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4 },
  chapterTitle: { fontFamily: 'Georgia', marginTop: 9 },
  byline: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 10 },
  chapterLoading: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 28 },
  paragraph: { fontFamily: 'Georgia' },
  pageChapterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.1, marginBottom: 16 },
  horizontalContent: { alignItems: 'stretch' },
  page: { flex: 1, justifyContent: 'flex-start' },
  chapterPageScroll: { flex: 1 },
  endNote: { borderTopWidth: 1, marginTop: 38, paddingTop: 22, paddingBottom: 28, flexDirection: 'row', alignItems: 'center', gap: 10 },
  endNoteText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22 },
  ambientTrack: { height: 2, borderRadius: 2, overflow: 'hidden' },
  ambientFill: { height: '100%' },
  controls: { height: 47, flexDirection: 'row', alignItems: 'center', gap: 13 },
  themeDots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  position: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  modeLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginLeft: 'auto' },
  readerSettingsButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  settingsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-start' },
  settingsScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.2)' },
  settingsPanel: { position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, borderWidth: 1, borderRadius: 17, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  settingsHeader: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 13, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  settingsTitle: { fontFamily: 'Georgia', fontSize: 20 },
  settingsSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  settingsContent: { paddingHorizontal: 18, paddingBottom: 24 },
  settingsSection: { borderTopWidth: 1, borderTopColor: 'rgba(128, 120, 110, 0.2)', paddingTop: 16, marginTop: 4, paddingBottom: 7 },
  settingsSectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.2, marginBottom: 9 },
  settingRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
  settingDescription: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14, marginTop: 1 },
  settingGroupLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 14, marginBottom: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepButton: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: 'Inter_500Medium', fontSize: 11, minWidth: 28, textAlign: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choiceChip: { minHeight: 34, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  choiceText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  choiceDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1 },
  toggleRow: { minHeight: 46, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  toggleCopy: { flex: 1 },
  manualAction: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  manualActionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
