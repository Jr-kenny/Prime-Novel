import AsyncStorage from '@react-native-async-storage/async-storage';
import { durableStorageWrite } from './durable-storage';
import { markInterruptedJobs, type DownloadJob } from './download-jobs';

const downloadJobsStorageKey = 'prime-download-jobs-v1';
const downloadJobsBackupKey = 'prime-download-jobs-backup-v1';

function parseJobs(value: string | null): DownloadJob[] | undefined {
  if (value === null) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    if (!parsed.every((job) => job && typeof job === 'object' && typeof (job as DownloadJob).id === 'string')) return undefined;
    return parsed as DownloadJob[];
  } catch {
    return undefined;
  }
}

export async function loadDownloadJobs(): Promise<DownloadJob[]> {
  const entries = await AsyncStorage.multiGet([downloadJobsStorageKey, downloadJobsBackupKey]);
  const primary = parseJobs(entries[0][1]);
  const backup = parseJobs(entries[1][1]);
  const stored = primary === undefined ? backup : primary;
  return markInterruptedJobs(stored ?? []);
}

export async function saveDownloadJobs(jobs: DownloadJob[]): Promise<void> {
  const value = JSON.stringify(jobs);
  await durableStorageWrite(() => AsyncStorage.setItem(downloadJobsStorageKey, value));
  void AsyncStorage.setItem(downloadJobsBackupKey, value).catch(() => {});
}

export async function upsertDownloadJob(job: DownloadJob): Promise<DownloadJob[]> {
  const jobs = await loadDownloadJobs();
  const next = [job, ...jobs.filter((item) => item.id !== job.id)];
  await saveDownloadJobs(next);
  return next;
}

export async function removeDownloadJob(jobId: string): Promise<void> {
  const jobs = await loadDownloadJobs();
  await saveDownloadJobs(jobs.filter((job) => job.id !== jobId));
}
