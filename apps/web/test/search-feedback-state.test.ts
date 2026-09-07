import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFeedbackAction, searchFeedbackMessage } from '../src/features/discovery/search-feedback-state.ts';

test('explains when a completed search returns no public Workspace', () => {
  assert.equal(
    searchFeedbackMessage({ hasSearched: true, hasItems: false, isLoading: false }),
    'No published workspaces have an available time for this location and date.'
  );
});

test('offers a way to refine an empty completed search, but not the initial or loading state', () => {
  assert.equal(
    searchFeedbackAction({ hasSearched: true, hasItems: false, isLoading: false }),
    'refine-search'
  );
  assert.equal(
    searchFeedbackAction({ hasSearched: false, hasItems: false, isLoading: false }),
    null
  );
  assert.equal(
    searchFeedbackAction({ hasSearched: true, hasItems: false, isLoading: true }),
    null
  );
});
