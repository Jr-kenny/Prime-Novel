import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { NovelActionBar } from '@/components/NovelActionBar';
import { WebLandingButton } from '@/components/WebLandingButton';
import { useCatalog } from '@/context/CatalogContext';
import { useColors } from '@/hooks/useColors';
import { useReader } from '@/context/ReaderContext';

type ChapterFilter = 'all' | 'unread' | 'read';

function FilterChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export default function ChaptersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activeBook,
    books,
    setActiveChapter,
    isChapterRead,
    markChapterRead,
    markChapterUnread,
    markChaptersRead,
    markChaptersUnread,
    addBookmark,
    removeBookmark,
    getReadingPosition,
    removeBook,
    toggleFavorite,
  } = useReader();
  const { downloadAllChapters, resumeDownloadJob, downloads, removeDownload, getDownloadJob } = useCatalog();
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [bulkDownload, setBulkDownload] = useState<{ completed: number; total: number; failed: number }>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<number>();
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const chapters = useMemo(
    () => {
      if (!activeBook) return [];
      if (activeBook.chapters?.length) return [...activeBook.chapters].sort((left, right) => left.number - right.number);
      return Array.from({ length: activeBook.totalChapters }, (_, index) => ({
        id: `${activeBook.id}:${index + 1}`,
        number: index + 1,
        title: `Chapter ${index + 1}`,
        url: '',
      }));
    },
    [activeBook],
  );
  const visibleChapters = useMemo(
    () => chapters.filter((chapter) => {
      if (chapterFilter === 'read') return isChapterRead(chapter.number);
      if (chapterFilter === 'unread') return !isChapterRead(chapter.number);
      return true;
    }),
    [chapters, chapterFilter, isChapterRead, books],
  );
  const selectedSet = useMemo(() => new Set(selectedChapters), [selectedChapters]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const openChapter = (chapter: number) => {
    setActiveChapter(chapter);
    router.push('/reader');
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedChapters([]);
    setSelectionAnchor(undefined);
  };

  const enterSelection = (chapter: number) => {
    setSelectionMode(true);
    setSelectionAnchor(chapter);
    setSelectedChapters([chapter]);
  };

  const toggleChapterSelection = (chapter: number) => {
    setSelectionAnchor((anchor) => anchor ?? chapter);
    setSelectedChapters((current) => {
      const next = current.includes(chapter) ? current.filter((item) => item !== chapter) : [...current, chapter];
      if (next.length === 0) setSelectionMode(false);
      return next;
    });
  };

  const selectAllChapters = () => {
    setSelectionMode(true);
    setSelectedChapters(chapters.map((chapter) => chapter.number));
    setSelectionAnchor((anchor) => anchor ?? chapters[0]?.number);
  };

  const selectFromAnchor = () => {
    if (selectionAnchor === undefined) return;
    setSelectionMode(true);
    setSelectedChapters(chapters.filter((chapter) => chapter.number >= selectionAnchor).map((chapter) => chapter.number));
  };

  const selectedChapterRecords = chapters.filter((chapter) => selectedSet.has(chapter.number));

  const updateSelectedReadState = (read: boolean) => {
    if (read) markChaptersRead(selectedChapters);
    else markChaptersUnread(selectedChapters);
    setNotice(read ? `${selectedChapters.length} chapters marked as read.` : `${selectedChapters.length} chapters marked as unread.`);
  };

  const updateSelectedBookmarks = (add: boolean) => {
    selectedChapters.forEach((chapter) => {
      if (add) addBookmark(chapter, activeBook?.id);
      else removeBookmark(chapter, activeBook?.id);
    });
    setNotice(add ? `${selectedChapters.length} chapters bookmarked.` : `${selectedChapters.length} bookmarks removed.`);
  };

  const downloadSelectedChapters = async () => {
    if (!catalogNovel || selectedChapterRecords.length === 0 || selectionBusy) return;
    setSelectionBusy(true);
    setNotice(undefined);
    const result = await downloadAllChapters(catalogNovel, selectedChapterRecords);
    setSelectionBusy(false);
    setNotice(result.failed > 0 ? `${result.downloaded} chapters saved. ${result.failed} could not be downloaded.` : `${result.downloaded} chapters saved for offline reading.`);
  };

  const deleteSelectedDownloads = () => {
    const sourceId = activeBook?.sourceId;
    if (!sourceId) return;
    const downloadable = selectedChapterRecords.filter((chapter) => downloads.some((download) => download.key === `${sourceId}:${chapter.id}`));
    downloadable.forEach((chapter) => removeDownload(`${sourceId}:${chapter.id}`));
    setNotice(downloadable.length > 0 ? `${downloadable.length} downloaded chapters removed.` : 'No downloaded chapters were selected.');
  };

  const resumeReading = () => {
    if (!activeBook) return;
    openChapter(activeBook.chapter);
  };

  const submitJump = () => {
    if (!activeBook) return;
    const chapter = Number.parseInt(jumpValue.trim(), 10);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > activeBook.totalChapters) return;
    setJumpOpen(false);
    setJumpValue('');
    openChapter(chapter);
  };

  if (!activeBook) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={goBack}>
            <Feather name="chevron-left" size={23} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Chapters</Text>
          <View style={styles.headerSpacer}>
            <WebLandingButton color={colors.foreground} />
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Choose a novel first.</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Open a novel from Discover to see its chapters.</Text>
        </View>
      </View>
    );
  }

  const catalogNovel = activeBook.sourceUrl && activeBook.chapters?.length
    ? {
        id: activeBook.id,
        sourceId: activeBook.sourceId,
        title: activeBook.title,
        url: activeBook.sourceUrl,
        coverUrl: typeof activeBook.cover === 'string' ? activeBook.cover : undefined,
      }
    : undefined;
  const allChaptersDownloaded = Boolean(catalogNovel && activeBook.chapters?.length && activeBook.chapters.every((chapter) => downloads.some((download) => download.key === `${activeBook.sourceId}:${chapter.id}`)));

  const downloadJob = catalogNovel ? getDownloadJob(catalogNovel.id) : undefined;
  const resumableJob = downloadJob && downloadJob.status !== 'completed' && downloadJob.chapters.length > 0
    ? downloadJob
    : undefined;

  const saveAllChaptersOffline = async (mode: 'all' | 'resume' = 'all') => {
    if (!catalogNovel || !activeBook.chapters?.length || bulkDownload) return;
    setNotice(undefined);
    setBulkDownload({ completed: 0, total: activeBook.chapters.length, failed: 0 });
    const run = mode === 'resume' ? resumeDownloadJob : downloadAllChapters;
    const result = await run(catalogNovel, activeBook.chapters, (completed, total, failed) => {
      setBulkDownload({ completed, total, failed });
    });
    setBulkDownload(undefined);
    if (result.failed > 0) {
      setNotice(`${result.downloaded} chapters saved. ${result.failed} could not be downloaded. Resume to retry them.`);
    } else if (result.downloaded > 0) {
      setNotice(`${result.downloaded} chapters saved for offline reading.`);
    } else {
      setNotice('All requested chapters are already saved offline.');
    }
  };

  const removeFromLibrary = () => {
    removeBook(activeBook.id);
    goBack();
  };

  const listHeader = (
    <View>
      <View style={styles.intro}>
        <BookCover source={activeBook.cover} width={86} height={126} favorite={activeBook.favorite} />
        <View style={styles.introCopy}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>{activeBook.title}</Text>
          <Text style={[styles.author, { color: colors.mutedForeground }]}>{activeBook.author}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={4}>{activeBook.description}</Text>
          <Text style={[styles.progress, { color: colors.primary }]}>Chapter {activeBook.chapter} of {activeBook.totalChapters}</Text>
        </View>
      </View>

      <NovelActionBar
        downloadBusy={Boolean(bulkDownload)}
        downloadComplete={allChaptersDownloaded}
        downloadDisabled={!catalogNovel}
        downloadLabel={
          bulkDownload
            ? `${bulkDownload.completed}/${bulkDownload.total}`
            : allChaptersDownloaded
              ? 'Downloaded'
              : resumableJob
                ? 'Resume download'
                : 'Download all'
        }
        favorite={Boolean(activeBook.favorite)}
        inLibrary
        onDownloadPress={() => void saveAllChaptersOffline(resumableJob ? 'resume' : 'all')}
        onFavoritePress={() => toggleFavorite(activeBook.id)}
        onLibraryPress={removeFromLibrary}
      />
      {notice ? <Text style={[styles.notice, { color: colors.primary }]}>{notice}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={resumeReading}
        style={({ pressed }) => [styles.resumeAction, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
        testID="chapters-resume"
      >
        <View style={styles.resumeIcon}>
          <Feather name="play" size={15} color={colors.primary} />
        </View>
        <View style={styles.resumeCopy}>
          <Text style={[styles.resumeTitle, { color: colors.primaryForeground }]}>Resume reading</Text>
          <Text style={[styles.resumeSubtitle, { color: colors.primaryForeground }]}>Continue from Chapter {activeBook.chapter}</Text>
        </View>
        <Feather name="chevron-right" size={19} color={colors.primaryForeground} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Chapters</Text>
          <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{visibleChapters.length} of {activeBook.totalChapters}</Text>
        </View>
        <View style={styles.chapterActions}>
          <Pressable
            accessibilityLabel="Jump to chapter"
            accessibilityRole="button"
            onPress={() => setJumpOpen(true)}
            style={({ pressed }) => [styles.textAction, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
            testID="chapters-jump"
          >
            <Feather name="corner-up-right" size={14} color={colors.foreground} />
            <Text style={[styles.textActionLabel, { color: colors.foreground }]}>Jump</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Filter chapters"
            accessibilityRole="button"
            onPress={() => setFilterOpen((open) => !open)}
            style={({ pressed }) => [styles.textAction, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
            testID="chapters-filter"
          >
            <Feather name="filter" size={14} color={colors.foreground} />
            <Text style={[styles.textActionLabel, { color: colors.foreground }]}>Filter</Text>
          </Pressable>
        </View>
      </View>

      {filterOpen ? (
        <Animated.View entering={FadeIn.duration(180)} style={[styles.filterBar, { borderColor: colors.border }]}>
          <FilterChip label="All" selected={chapterFilter === 'all'} onPress={() => setChapterFilter('all')} colors={colors} />
          <FilterChip label="Unread" selected={chapterFilter === 'unread'} onPress={() => setChapterFilter('unread')} colors={colors} />
          <FilterChip label="Read" selected={chapterFilter === 'read'} onPress={() => setChapterFilter('read')} colors={colors} />
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={goBack} testID="chapters-back">
          <Feather name="chevron-left" size={23} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          {selectionMode ? (
            <>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>SELECTION</Text>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{selectedChapters.length} selected</Text>
            </>
          ) : (
            <>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>NOVEL</Text>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{activeBook.title}</Text>
            </>
          )}
        </View>
        {selectionMode ? (
          <View style={styles.selectionHeaderActions}>
            <Pressable accessibilityLabel="Select all chapters" accessibilityRole="button" hitSlop={10} onPress={selectAllChapters}>
              <Feather name="check-square" size={20} color={colors.foreground} />
            </Pressable>
            <Pressable accessibilityLabel="Exit chapter selection" accessibilityRole="button" hitSlop={10} onPress={exitSelection}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerSpacer}>
            <WebLandingButton color={colors.foreground} />
          </View>
        )}
      </View>

      <FlatList
        contentContainerStyle={{ paddingBottom: insets.bottom + (selectionMode ? 98 : 32) }}
        data={visibleChapters}
        extraData={{ books, downloads, selectedChapters, selectionMode }}
        keyExtractor={(chapter) => `${activeBook.id}-${chapter.number}`}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Try a different chapter filter.</Text>
          </View>
        )}
        ListHeaderComponent={selectionMode ? (
          <View style={[styles.selectionSummary, { borderBottomColor: colors.border }]}>
            <Text style={[styles.selectionSummaryText, { color: colors.mutedForeground }]}>{selectedChapters.length} chapter{selectedChapters.length === 1 ? '' : 's'} selected</Text>
            {selectionAnchor !== undefined ? (
              <Pressable accessibilityRole="button" onPress={selectFromAnchor} style={({ pressed }) => [styles.selectFromAction, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}>
                <Feather name="chevrons-up" size={14} color={colors.foreground} />
                <Text style={[styles.selectFromActionText, { color: colors.foreground }]}>Select from {selectionAnchor} up</Text>
              </Pressable>
            ) : null}
          </View>
        ) : listHeader}
        renderItem={({ item }) => {
          const chapter = item.number;
          const read = isChapterRead(chapter);
          const current = chapter === activeBook.chapter;
          const selected = selectedSet.has(chapter);
          const downloaded = downloads.some((download) => download.key === `${activeBook.sourceId}:${item.id}`);
          const position = current ? getReadingPosition(activeBook.id, chapter) : undefined;
          const positionPercent = position ? Math.round(position.chapterProgress * 1000) / 10 : 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onLongPress={() => enterSelection(chapter)}
              onPress={() => (selectionMode ? toggleChapterSelection(chapter) : openChapter(chapter))}
              delayLongPress={260}
              style={({ pressed }) => [
                styles.chapterRow,
                selectionMode && styles.selectionChapterRow,
                {
                  backgroundColor: selected ? colors.accent : colors.background,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.7 : selected || current || !read ? 1 : 0.46,
                },
              ]}
            >
              <View style={[styles.chapterNumber, { backgroundColor: current ? colors.primary : colors.secondary }]}>
                <Text style={[styles.chapterNumberText, { color: current ? colors.primaryForeground : colors.secondaryForeground }]}>{chapter}</Text>
              </View>
              <View style={styles.chapterCopy}>
                <Text style={[styles.chapterTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title || `Chapter ${chapter}`}</Text>
                <Text style={[styles.chapterStatus, { color: current ? colors.primary : colors.mutedForeground }]}>{current ? `Position: ${positionPercent}%` : downloaded ? 'Downloaded' : read ? 'Read' : 'Unread'}</Text>
              </View>
              {selectionMode ? (
                <Feather name={selected ? 'check-square' : 'square'} size={20} color={selected ? colors.primary : colors.mutedForeground} />
              ) : (
                <>
                  <Pressable
                    accessibilityLabel={read ? `Mark chapter ${chapter} unread` : `Mark chapter ${chapter} read`}
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={(event) => {
                      event.stopPropagation();
                      if (read) markChapterUnread(chapter);
                      else markChapterRead(chapter);
                    }}
                  >
                    <Feather name={read ? 'check-circle' : 'circle'} size={18} color={read ? colors.primary : colors.mutedForeground} />
                  </Pressable>
                  <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                </>
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={30}
        windowSize={7}
      />

      {selectionMode ? (
        <Animated.View entering={SlideInUp.duration(180)} style={[styles.selectionBar, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Pressable accessibilityLabel="Download selected chapters" accessibilityRole="button" disabled={!catalogNovel || selectionBusy} onPress={() => void downloadSelectedChapters()} style={({ pressed }) => [styles.selectionAction, { opacity: !catalogNovel || selectionBusy ? 0.35 : pressed ? 0.65 : 1 }]}>
            <Feather name="download" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Delete selected downloads" accessibilityRole="button" onPress={deleteSelectedDownloads} style={({ pressed }) => [styles.selectionAction, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="trash-2" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Mark selected chapters read" accessibilityRole="button" onPress={() => updateSelectedReadState(true)} style={({ pressed }) => [styles.selectionAction, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="check-square" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Mark selected chapters unread" accessibilityRole="button" onPress={() => updateSelectedReadState(false)} style={({ pressed }) => [styles.selectionAction, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="square" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Bookmark selected chapters" accessibilityRole="button" onPress={() => updateSelectedBookmarks(true)} style={({ pressed }) => [styles.selectionAction, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="bookmark" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Remove selected bookmarks" accessibilityRole="button" onPress={() => updateSelectedBookmarks(false)} style={({ pressed }) => [styles.selectionAction, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="bookmark" size={21} color={colors.foreground} />
            <View style={[styles.bookmarkMinus, { backgroundColor: colors.foreground }]} />
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal animationType="fade" onRequestClose={() => setJumpOpen(false)} transparent visible={jumpOpen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable accessibilityLabel="Close jump dialog" onPress={() => setJumpOpen(false)} style={styles.modalScrim} />
          <Animated.View entering={SlideInUp.duration(220)} style={[styles.jumpPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.jumpHeader}>
              <View>
                <Text style={[styles.jumpTitle, { color: colors.foreground }]}>Jump to chapter</Text>
                <Text style={[styles.jumpSubtitle, { color: colors.mutedForeground }]}>Choose a chapter from 1 to {activeBook.totalChapters}.</Text>
              </View>
              <Pressable accessibilityLabel="Close jump dialog" accessibilityRole="button" hitSlop={10} onPress={() => setJumpOpen(false)}>
                <Feather name="x" size={19} color={colors.foreground} />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Chapter number"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={(value) => setJumpValue(value.replace(/[^0-9]/g, ''))}
              onSubmitEditing={submitJump}
              placeholder="Chapter number"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              style={[styles.jumpInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={jumpValue}
            />
            <View style={styles.jumpActions}>
              <Pressable accessibilityRole="button" onPress={() => setJumpOpen(false)} style={({ pressed }) => [styles.cancelAction, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.cancelActionText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!jumpValue || Number.parseInt(jumpValue, 10) < 1 || Number.parseInt(jumpValue, 10) > activeBook.totalChapters}
                onPress={submitJump}
                style={({ pressed }) => [styles.jumpAction, { backgroundColor: colors.primary, opacity: !jumpValue || Number.parseInt(jumpValue, 10) < 1 || Number.parseInt(jumpValue, 10) > activeBook.totalChapters ? 0.45 : pressed ? 0.82 : 1 }]}
              >
                <Text style={[styles.jumpActionText, { color: colors.primaryForeground }]}>Open chapter</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerCopy: { flex: 1 },
  headerSpacer: { width: 23 },
  selectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: 'Georgia', fontSize: 19, marginTop: 3 },
  intro: { paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', gap: 16 },
  introCopy: { flex: 1, justifyContent: 'center' },
  introTitle: { fontFamily: 'Georgia', fontSize: 22, lineHeight: 26 },
  author: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 13 },
  progress: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 12 },
  notice: { paddingHorizontal: 22, marginTop: 10, fontFamily: 'Inter_500Medium', fontSize: 11 },
  resumeAction: { marginHorizontal: 22, marginTop: 22, minHeight: 62, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumeIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fffaf4', alignItems: 'center', justifyContent: 'center' },
  resumeCopy: { flex: 1 },
  resumeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  resumeSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4, opacity: 0.78 },
  sectionHeader: { paddingHorizontal: 22, marginTop: 30, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionCopy: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 21 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  chapterActions: { flexDirection: 'row', gap: 7 },
  textAction: { minHeight: 30, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  textActionLabel: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  filterBar: { marginHorizontal: 22, marginBottom: 7, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 7 },
  filterChip: { minHeight: 30, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  chapterRow: { minHeight: 58, marginHorizontal: 22, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chapterNumberText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  chapterCopy: { flex: 1 },
  chapterTitle: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  chapterStatus: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  selectionChapterRow: { marginHorizontal: 0, paddingHorizontal: 22 },
  selectionSummary: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  selectionSummaryText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  selectFromAction: { minHeight: 30, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectFromActionText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  selectionBar: { position: 'absolute', left: 14, right: 14, bottom: 0, borderWidth: 1, borderRadius: 18, paddingTop: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 4, elevation: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  selectionAction: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center' },
  bookmarkMinus: { width: 9, height: 2, position: 'absolute', right: 8, bottom: 8 },
  emptyState: { paddingHorizontal: 22, paddingTop: 30, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 17 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 7 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.32)' },
  jumpPanel: { margin: 14, borderWidth: 1, borderRadius: 17, padding: 18, elevation: 10, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  jumpHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  jumpTitle: { fontFamily: 'Georgia', fontSize: 20 },
  jumpSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 4 },
  jumpInput: { minHeight: 47, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginTop: 18, fontFamily: 'Inter_400Regular', fontSize: 14 },
  jumpActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelAction: { minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  cancelActionText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  jumpAction: { minHeight: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  jumpActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
