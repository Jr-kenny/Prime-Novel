import { updateStatusCopy } from '../utils/update-status.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  updateStatusCopy({ state: 'checking', currentVersion: '1.0.3' }).includes('Checking for updates'),
  'checking copy',
);
assert(
  updateStatusCopy({ state: 'up-to-date', currentVersion: '1.0.3' }).includes("You're up to date"),
  'up-to-date copy',
);
assert(
  updateStatusCopy({ state: 'available', currentVersion: '1.0.3', availableVersion: '1.0.4' }).includes('Version 1.0.4'),
  'available copy includes version',
);
assert(
  updateStatusCopy({ state: 'error', currentVersion: '1.0.3', errorMessage: 'offline' }).includes('offline'),
  'error copy',
);
assert(
  updateStatusCopy({ state: 'idle', currentVersion: '1.0.3' }).includes('1.0.3'),
  'idle copy shows installed version',
);

console.log('test-update-check: ok');
