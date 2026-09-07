import type { JSX } from 'react';
import { searchFeedbackMessage } from '../search-feedback-state';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface SearchFeedbackProps {
  error: string | null;
  hasSearched: boolean;
  isLoading: boolean;
  hasItems: boolean;
}

export function SearchFeedback({ error, hasSearched, isLoading, hasItems }: SearchFeedbackProps): JSX.Element | null {
  const { t } = useI18n();
  if (error) return <p className="notice error" role="alert">{error}</p>;
  const message = searchFeedbackMessage({ hasSearched, hasItems, isLoading });
  const localized = message === 'Choose a location and date to see live workspace availability.'
    ? t(message, 'Chọn địa điểm và ngày để xem lịch trống trực tiếp.')
    : message === 'No published workspaces have an available time for this location and date.'
      ? t(message, 'Không có không gian đã công bố nào còn khung giờ trống tại địa điểm và ngày đã chọn.')
      : message;
  return localized ? <p className="notice" role="status">{localized}</p> : null;
}
