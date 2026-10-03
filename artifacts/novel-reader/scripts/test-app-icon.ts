import {
  APP_ICON_OPTIONS,
  DEFAULT_APP_ICON,
  getAppIconOption,
  isAppIconId,
  normalizeAppIconId,
} from '../utils/app-icon.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(DEFAULT_APP_ICON === 'classic', 'default icon should be classic');
assert(APP_ICON_OPTIONS.length >= 4, 'catalog should offer several icon variants');
assert(isAppIconId('black'), 'black should be a valid icon id');
assert(!isAppIconId('neon'), 'unknown icon ids should be rejected');
assert(normalizeAppIconId('orange') === 'orange', 'valid ids should normalize to themselves');
assert(normalizeAppIconId('neon') === DEFAULT_APP_ICON, 'invalid ids should fall back to classic');
assert(getAppIconOption('cream').label === 'Cream', 'cream option should resolve');

console.log('test-app-icon: ok');
