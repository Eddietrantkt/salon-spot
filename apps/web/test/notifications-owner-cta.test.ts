import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const notificationsPage = await readFile(new URL('../src/features/notifications/pages/notifications-page.tsx', import.meta.url), 'utf8');

test('Notifications exposes the Owner workplace publishing entry point', () => {
  assert.match(notificationsPage, /onOpenOwner/);
  assert.match(notificationsPage, /Post a workplace/);
  assert.match(notificationsPage, /Đăng workplace/);
});
