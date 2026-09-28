import { updateInstallPhaseCopy } from '../utils/update-install-phase.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(updateInstallPhaseCopy('idle').includes('Ready'), 'idle copy');
assert(updateInstallPhaseCopy('preparing').toLowerCase().includes('preparing'), 'preparing copy');
assert(updateInstallPhaseCopy('downloading').toLowerCase().includes('downloading'), 'downloading copy');
assert(updateInstallPhaseCopy('ready-to-install').toLowerCase().includes('install'), 'ready copy');
assert(updateInstallPhaseCopy('installing').toLowerCase().includes('installer'), 'installing copy');
assert(updateInstallPhaseCopy('error').toLowerCase().includes('could not'), 'error copy');

console.log('test-update-install: ok');
