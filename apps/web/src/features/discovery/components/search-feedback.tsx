import type { JSX } from 'react';
import { searchFeedbackMessage } from '../search-feedback-state';

interface SearchFeedbackProps {
  error: string | null;
  hasSearched: boolean;
  isLoading: boolean;
  hasItems: boolean;
}

export function SearchFeedback({ error, hasSearched, isLoading, hasItems }: SearchFeedbackProps): JSX.Element | null {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  const message = searchFeedbackMessage({ hasSearched, hasItems, isLoading });
  return message ? <p className="notice" role="status">{message}</p> : null;
}
