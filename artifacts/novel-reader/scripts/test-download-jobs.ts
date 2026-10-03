import {
  createDownloadJob,
  finishJob,
  jobPendingChapters,
  jobRetryChapters,
  markJobChapterCompleted,
  markJobChapterFailed,
} from '../utils/download-jobs.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const chapters = [
  { key: 'src:c1', id: 'c1', number: 1, title: 'One' },
  { key: 'src:c2', id: 'c2', number: 2, title: 'Two' },
  { key: 'src:c3', id: 'c3', number: 3, title: 'Three' },
];

const job = createDownloadJob({
  sourceId: 'src',
  novelId: 'novel-1',
  novelTitle: 'Sample',
  chapters,
});

assert(job.status === 'running', 'new jobs start running');
assert(jobPendingChapters(job, new Set()).length === 3, 'all chapters are pending at start');

const afterSkip = createDownloadJob({
  sourceId: 'src',
  novelId: 'novel-1',
  novelTitle: 'Sample',
  chapters,
});
const pendingAfterOne = jobPendingChapters(afterSkip, new Set(['src:c1']));
assert(pendingAfterOne.length === 2, 'already downloaded chapters are skipped');
assert(pendingAfterOne[0].key === 'src:c2', 'resume continues at the next missing chapter');

const done = markJobChapterCompleted(job, 'src:c1');
assert(done.completedKeys.includes('src:c1'), 'completed chapters are recorded');

const failed = markJobChapterFailed(done, 'src:c2');
assert(failed.failedKeys.includes('src:c2'), 'failed chapters are recorded');
assert(jobRetryChapters(failed, new Set()).some((chapter) => chapter.key === 'src:c2'), 'failed chapters are retryable');

const finished = finishJob(markJobChapterCompleted(failed, 'src:c2'));
assert(finished.status !== 'completed', 'jobs with remaining chapters are not completed');
const complete = finishJob(markJobChapterCompleted(markJobChapterCompleted(finished, 'src:c3'), 'src:c3'));
assert(complete.completedKeys.length === 3, 'all completions are kept');
assert(finishJob(complete).status === 'completed', 'finished jobs mark completed');

console.log('test-download-jobs: ok');
