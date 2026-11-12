import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  isForcedDarkRoute,
  isSignedInThemeRoute,
  THEME_SESSION_KEY,
  THEME_STORAGE_KEY,
  themeBootScript,
} from './theme-mode';

function bootTheme(pathname: string, storage: Record<string, string>): string | undefined {
  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  const context = vm.createContext({
    location: { pathname },
    localStorage: {
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
    },
    document: {
      documentElement: {
        classList: {
          remove(...names: string[]) {
            names.forEach((name) => classes.delete(name));
          },
          add(name: string) {
            classes.add(name);
          },
        },
        setAttribute(name: string, value: string) {
          attrs[name] = value;
        },
      },
    },
  });

  vm.runInContext(themeBootScript(), context);
  assert.equal(classes.has(attrs['data-theme'] ?? ''), true);
  return attrs['data-theme'];
}

test('support follows a signed-in light theme and stays dark for visitors', () => {
  assert.equal(isForcedDarkRoute('/support'), false);
  assert.equal(isSignedInThemeRoute('/support'), true);
  assert.equal(isForcedDarkRoute('/pricing'), true);

  const lightPreference = { [THEME_STORAGE_KEY]: 'light' };
  assert.equal(bootTheme('/support', lightPreference), 'dark');
  assert.equal(
    bootTheme('/support', { ...lightPreference, [THEME_SESSION_KEY]: '1' }),
    'light'
  );
  assert.equal(bootTheme('/pricing', { ...lightPreference, [THEME_SESSION_KEY]: '1' }), 'dark');
  assert.equal(bootTheme('/dashboard', lightPreference), 'light');
});
