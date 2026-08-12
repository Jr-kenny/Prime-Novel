import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/BookCover';
import { NovelDetailsSkeleton } from '@/components/LoadingSkeleton';
import { NovelActionBar } from '@/components/NovelActionBar';
import { WebLandingButton } from '@/components/WebLandingButton';
import { useCatalog } from '@/context/CatalogContext';
import type { Book } from '@/context/ReaderContext';
import { useReader } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import type { PrimeNovel, PrimeNovelDetails } from '@/utils/prime-source-adapters';

const fallbackCover = require('@/assets/images/cover-lighthouse.jpg');

export default function NovelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sourceId, sourceRecordId, title, url, coverUrl } = useLocalSearchParams<{ sourceId?: string; sourceRecordId?: string; title?: string; url?: string; coverUrl?: string }>();
  const { getNovel, downloadChapter, downloadAllChapters, downloads } = useCatalog();
  const { books, removeBook, toggleFavorite, upsertBook, setActiveChapter } = useReader();
  const [novel, setNovel] = useState<PrimeNovelDetails | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [downloading, setDownloading] = useState<string | undefined>();
  const [bulkDownload, setBulkDownload] = useState<{ completed: number; total: number; failed: number } | undefined>();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();

  const seedNovel = useMemo<PrimeNovel | undefined>(() => {
    if (!sourceId || !url || !title) return undefined;
    return { id: `${sourceId}:${url}`, sourceId, sourceRecordId: sourceRecordId || undefined, title, url, coverUrl };
  }, [coverUrl, sourceId, sourceRecordId, title, url]);

  useEffect(() => {
    if (!seedNovel) {
      setLoading(false);
      setError('This novel could not be opened.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void getNovel(seedNovel)
      .then((details) => {
        if (!cancelled) setNovel(details);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Novel details could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getNovel, seedNovel]);

  const existingBook = novel ? books.find((book) => book.id === novel.id) : undefined;
  const toBook = (chapter: number): Book | undefined => {
    if (!novel) return undefined;
    return {
      id: novel.id,
      title: novel.title,
      author: novel.author || 'Unknown author',
      cover: novel.coverUrl || fallbackCover,
      sourceId: novel.sourceId,
      sourceUrl: novel.url,
      wordsPerChapter: 1200,
      chapter,
      totalChapters: Math.max(novel.chapters.length, 1),
      progress: existingBook?.progress ?? 0,
      status: existingBook?.status ?? 'Continue',
      lastRead: existingBook?.lastRead ?? 'Just now',
      favorite: existingBook?.favorite,
      genre: novel.genres?.[0] ?? 'Novel',
      description: novel.description ?? '',
      readChapters: existingBook?.readChapters ?? [],
      chapters: novel.chapters,
    };
  };

  const openChapter = (chapter: number) => {
    const book = toBook(chapter);
    if (!book) return;
    upsertBook(book);
    setActiveChapter(chapter, book.id);
    router.push('/reader');
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/discover');
  };

  const addToLibrary = () => {
    const book = toBook(existingBook?.chapter ?? novel?.chapters[0]?.number ?? 1);
    if (book && !existingBook) upsertBook(book);
  };

  const removeFromLibrary = () => {
    if (!novel || !existingBook) return;
    removeBook(novel.id);
    goBack();
  };

  const toggleNovelFavorite = () => {
    const book = toBook(existingBook?.chapter ?? novel?.chapters[0]?.number ?? 1);
    if (!book) return;
    if (!existingBook) upsertBook(book);
    toggleFavorite(book.id);
  };

  const saveChapterOffline = async (chapterNumber: number) => {
    if (!novel) return;
    const chapter = novel.chapters.find((item) => item.number === chapterNumber);
    if (!chapter) return;
    setDownloading(chapter.id);
    setNotice(undefined);
    try {
      await downloadChapter(novel, chapter);
    } catch {
      setNotice('This chapter could not be saved offline.');
    } finally {
      setDownloading(undefined);
    }
  };

  const saveAllChaptersOffline = async () => {
    if (!novel || novel.chapters.length === 0 || bulkDownload) return;
    setNotice(undefined);
    setBulkDownload({ completed: 0, total: novel.chapters.length, failed: 0 });
    const result = await downloadAllChapters(novel, novel.chapters, (completed, total, failed) => {
      setBulkDownload({ completed, total, failed });
    });
    setBulkDownload(undefined);
    setNotice(result.failed > 0 ? `${result.downloaded} chapters saved. ${result.failed} could not be downloaded.` : `${result.downloaded} chapters saved for offline reading.`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={goBack}>
          <Feather name="chevron-left" size={23} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{title ?? 'Novel'}</Text>
        <View style={styles.headerBalance}>
          <WebLandingButton color={colors.foreground} />
        </View>
      </View>

      {loading ? (
        <NovelDetailsSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={24} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>{error}</Text>
        </View>
      ) : novel ? (
        <FlatList
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          contentInsetAdjustmentBehavior="automatic"
          data={novel.chapters}
          keyExtractor={(chapter) => chapter.id}
          ListHeaderComponent={(
            <View>
              <View style={styles.hero}>
                {novel.coverUrl ? <Image blurRadius={Platform.OS === 'android' ? 16 : 12} source={{ uri: novel.coverUrl }} style={styles.atmosphere} /> : null}
                <View pointerEvents="none" style={[styles.atmosphereTint, { backgroundColor: colors.background }]} />
                <LinearGradient colors={[`${colors.background}00`, colors.background]} pointerEvents="none" style={styles.atmosphereFade} />
                <View style={styles.intro}>
                  <BookCover source={novel.coverUrl || fallbackCover} width={104} height={150} />
                  <View style={styles.introCopy}>
                    <Text style={[styles.title, { color: colors.foreground }]}>{novel.title}</Text>
                    {novel.author ? <Text style={[styles.author, { color: colors.mutedForeground }]}>{novel.author}</Text> : null}
                    <Text style={[styles.meta, { color: colors.primary }]}>{novel.chapters.length} chapters{novel.status ? ` · ${novel.status}` : ''}</Text>
                  </View>
                </View>
              </View>
              {novel.description ? (
                <View style={styles.descriptionBlock}>
                  <Text numberOfLines={descriptionExpanded ? undefined : 5} style={[styles.description, { color: colors.mutedForeground }]}>{novel.description}</Text>
                  {novel.description.length > 280 ? (
                    <Pressable accessibilityRole="button" onPress={() => setDescriptionExpanded((expanded) => !expanded)}>
                      <Text style={[styles.readMore, { color: colors.primary }]}>{descriptionExpanded ? 'Show less' : 'Read more'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <NovelActionBar
                downloadBusy={Boolean(bulkDownload)}
                downloadComplete={novel.chapters.length > 0 && novel.chapters.every((chapter) => downloads.some((download) => download.key === `${novel.sourceId}:${chapter.id}`))}
                downloadDisabled={novel.chapters.length === 0}
                downloadLabel={bulkDownload ? `${bulkDownload.completed}/${bulkDownload.total}` : 'Download all'}
                favorite={Boolean(existingBook?.favorite)}
                inLibrary={Boolean(existingBook)}
                onDownloadPress={() => void saveAllChaptersOffline()}
                onFavoritePress={toggleNovelFavorite}
                onLibraryPress={existingBook ? removeFromLibrary : addToLibrary}
              />
              {notice ? <Text style={[styles.notice, { color: colors.primary }]}>{notice}</Text> : null}
              <Pressable disabled={novel.chapters.length === 0} onPress={() => openChapter(existingBook?.chapter ?? novel.chapters[0]?.number ?? 1)} style={({ pressed }) => [styles.resume, { backgroundColor: colors.primary, opacity: novel.chapters.length === 0 ? 0.42 : pressed ? 0.78 : 1 }]}>
                <Text style={[styles.resumeText, { color: colors.primaryForeground }]}>{novel.chapters.length === 0 ? 'No chapters available' : existingBook ? `Resume chapter ${existingBook.chapter}` : 'Start reading'}</Text>
                <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
              </Pressable>
              <View style={styles.chapterHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Chapters</Text>
                <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{novel.chapters.length}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => {
            const cached = downloads.some((download) => download.key === `${novel.sourceId}:${item.id}`);
            return (
              <View style={[styles.chapterRow, { borderBottomColor: colors.border }]}>
                <Pressable accessibilityRole="button" onPress={() => openChapter(item.number)} style={styles.chapterOpen}>
                  <Text style={[styles.chapterNumber, { color: colors.primary }]}>Chapter {item.number}</Text>
                  <Text style={[styles.chapterTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                  {item.releaseDate ? <Text style={[styles.chapterDate, { color: colors.mutedForeground }]}>{item.releaseDate}</Text> : null}
                </Pressable>
                <Pressable accessibilityLabel={cached ? 'Chapter saved offline' : `Save chapter ${item.number} offline`} accessibilityRole="button" disabled={Boolean(downloading)} hitSlop={10} onPress={() => void saveChapterOffline(item.number)} style={styles.download}>
                  {downloading === item.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={cached ? 'check' : 'download'} size={17} color={cached ? colors.primary : colors.mutedForeground} />}
                </Pressable>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center', marginHorizontal: 18 },
  headerBalance: { width: 23 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorTitle: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
  hero: { minHeight: 198, position: 'relative', overflow: 'hidden' },
  atmosphere: { ...StyleSheet.absoluteFillObject, opacity: 0.22, transform: [{ scale: 1.18 }] },
  atmosphereTint: { ...StyleSheet.absoluteFillObject, opacity: 0.72 },
  atmosphereFade: { ...StyleSheet.absoluteFillObject },
  intro: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18, flexDirection: 'row', gap: 18 },
  introCopy: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: 'Georgia', fontSize: 24, lineHeight: 29 },
  author: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },
  meta: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 18 },
  descriptionBlock: { paddingHorizontal: 22, marginTop: 20 },
  description: { fontFamily: 'Georgia', fontSize: 15, lineHeight: 23 },
  readMore: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 8 },
  notice: { paddingHorizontal: 22, marginTop: 10, fontFamily: 'Inter_500Medium', fontSize: 11 },
  resume: { marginHorizontal: 22, marginTop: 22, height: 46, paddingHorizontal: 18, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resumeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chapterHeader: { paddingHorizontal: 22, marginTop: 32, marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 20 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  chapterRow: { minHeight: 68, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  chapterOpen: { flex: 1, paddingVertical: 10 },
  chapterNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  chapterTitle: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 4 },
  chapterDate: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  download: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
