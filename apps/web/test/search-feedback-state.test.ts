import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFeedbackMessage } from '../src/features/discovery/search-feedback-state.ts';

test('explains when a completed search returns no public Workspace', () => {
  assert.equal(
    searchFeedbackMessage({ hasSearched: true, hasItems: false, isLoading: false }),
    'No published workspaces have an available time for this location and date.'
  );
});
