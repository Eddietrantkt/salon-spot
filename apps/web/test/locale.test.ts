import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale, readStoredLocale } from '../src/shared/i18n/locale.ts';
import { formatVnd } from '../src/features/discovery/format-vnd.ts';
import { formatSalonLocalDate } from '../src/shared/date/format-salon-time.ts';
import { localizedErrorMessage } from '../src/shared/i18n/localized-error-message.ts';

test('English is the default locale', () => {
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(normalizeLocale(undefined), 'en');
  assert.equal(normalizeLocale('fr'), 'en');
});

test('a saved Vietnamese preference is restored', () => {
  const storage = { getItem: (key: string) => key === LOCALE_STORAGE_KEY ? 'vi' : null };
  assert.equal(readStoredLocale(storage), 'vi');
});

test('storage failures safely fall back to English', () => {
  const storage = { getItem: () => { throw new Error('unavailable'); } };
  assert.equal(readStoredLocale(storage), 'en');
});

test('dates and VND values follow the selected display locale', () => {
  assert.notEqual(formatVnd(250_000, 'en'), formatVnd(250_000, 'vi'));
  assert.match(formatSalonLocalDate('2099-12-11', 'vi-VN'), /2099/);
});

test('client connection failures use the selected language', () => {
  const vietnamese = (_english: string, translation: string) => translation;
  assert.equal(
    localizedErrorMessage(new Error('We could not reach the service. Check your connection and try again.'), vietnamese),
    'Không thể kết nối đến dịch vụ. Hãy kiểm tra kết nối và thử lại.'
  );
});
