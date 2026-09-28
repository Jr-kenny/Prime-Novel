export type DownloadJobStatus = 'running' | 'interrupted' | 'completed' | 'failed';

export type DownloadJobChapter = {
  key: string;
  id: string;
  number: number;
  title: string;
};

export type DownloadJob = {
  id: string;
  sourceId: string;
  novelId: string;
  novelTitle: string;
  chapters: DownloadJobChapter[];
  completedKeys: string[];
  failedKeys: string[];
  status: DownloadJobStatus;
  startedAt: number;
  updatedAt: number;
};

export function createDownloadJob(input: {
  sourceId: string;
  novelId: string;
  novelTitle: string;
  chapters: DownloadJobChapter[];
}): DownloadJob {
  const now = Date.now();
  return {
    id: input.novelId,
    sourceId: input.sourceId,
    novelId: input.novelId,
    novelTitle: input.novelTitle,
    chapters: input.chapters,
    completedKeys: [],
    failedKeys: [],
    status: 'running',
    startedAt: now,
    updatedAt: now,
  };
}

export function jobPendingChapters(job: DownloadJob, alreadyDownloaded: ReadonlySet<string>): DownloadJobChapter[] {
  return job.chapters.filter((chapter) => (
    !alreadyDownloaded.has(chapter.key)
    && !job.completedKeys.includes(chapter.key)
  ));
}

export function jobRetryChapters(job: DownloadJob, alreadyDownloaded: ReadonlySet<string>): DownloadJobChapter[] {
  return job.chapters.filter((chapter) => (
    job.failedKeys.includes(chapter.key)
    && !alreadyDownloaded.has(chapter.key)
    && !job.completedKeys.includes(chapter.key)
  ));
}

export function markJobChapterCompleted(job: DownloadJob, key: string): DownloadJob {
  const completedKeys = job.completedKeys.includes(key) ? job.completedKeys : [...job.completedKeys, key];
  const failedKeys = job.failedKeys.filter((failedKey) => failedKey !== key);
  return { ...job, completedKeys, failedKeys, updatedAt: Date.now() };
}

export function markJobChapterFailed(job: DownloadJob, key: string): DownloadJob {
  const failedKeys = job.failedKeys.includes(key) ? job.failedKeys : [...job.failedKeys, key];
  return { ...job, failedKeys, updatedAt: Date.now() };
}

export function finishJob(job: DownloadJob): DownloadJob {
  const pending = job.chapters.filter((chapter) => !job.completedKeys.includes(chapter.key));
  const status: DownloadJobStatus = pending.length === 0
    ? 'completed'
    : job.failedKeys.length > 0
      ? 'failed'
      : 'interrupted';
  return { ...job, status, updatedAt: Date.now() };
}

export function isJobResumable(job: DownloadJob | undefined): job is DownloadJob {
  return Boolean(job && job.status !== 'completed' && job.chapters.length > 0);
}

export function jobProgress(job: DownloadJob): { completed: number; total: number; failed: number } {
  return {
    completed: job.completedKeys.length,
    total: job.chapters.length,
    failed: job.failedKeys.length,
  };
}
