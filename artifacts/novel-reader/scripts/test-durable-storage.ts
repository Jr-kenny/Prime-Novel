import assert from 'node:assert/strict';
import { durableStorageWrite } from '../utils/durable-storage';

async function main() {
  let attempts = 0;
  await durableStorageWrite(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('temporary write failure');
  });
  assert.equal(attempts, 3, 'temporary storage failures should be retried');

  let permanentAttempts = 0;
  await assert.rejects(() => durableStorageWrite(async () => {
    permanentAttempts += 1;
    throw new Error('permanent write failure');
  }, 2));
  assert.equal(permanentAttempts, 2, 'permanent failures should stop after the configured attempts');

  console.log('Prime Novel durable storage retry checks passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
