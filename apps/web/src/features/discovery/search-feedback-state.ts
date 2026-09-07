export interface SearchFeedbackState {
  hasSearched: boolean;
  hasItems: boolean;
  isLoading: boolean;
}

export function searchFeedbackMessage({ hasSearched, hasItems, isLoading }: SearchFeedbackState): string | null {
  if (isLoading || hasItems) return null;
  if (hasSearched) {
    return 'No published workspaces have an available time for this location and date.';
  }
  return 'Choose a location and date to see live workspace availability.';
}

export function searchFeedbackAction({ hasSearched, hasItems, isLoading }: SearchFeedbackState): 'refine-search' | null {
  return hasSearched && !hasItems && !isLoading ? 'refine-search' : null;
}
