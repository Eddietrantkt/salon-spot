import type { JSX } from 'react';
import { searchFeedbackAction, searchFeedbackMessage } from '../search-feedback-state';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

interface SearchFeedbackProps {
  error: unknown;
  hasSearched: boolean;
  isLoading: boolean;
  hasItems: boolean;
  onRefineSearch: () => void;
  onRetry: () => void;
}

export function SearchFeedback({ error, hasSearched, isLoading, hasItems, onRefineSearch, onRetry }: SearchFeedbackProps): JSX.Element | null {
  const { t } = useI18n();
  if (error) return <section className="notice error" role="alert"><p>{localizedErrorMessage(error, t)}</p><div className="notice-action-row"><button type="button" onClick={onRetry}>{t('Try again', 'Thử lại')}</button><button className="text-button" type="button" onClick={onRefineSearch}>{t('Change search', 'Đổi tìm kiếm')}</button></div></section>;
  const message = searchFeedbackMessage({ hasSearched, hasItems, isLoading });
  const localized = message === 'Choose a location and date to see live workspace availability.'
    ? t(message, 'Chọn địa điểm và ngày để xem lịch trống trực tiếp.')
    : message === 'No published workspaces have an available time for this location and date.'
      ? t(message, 'Không có không gian đã công bố nào còn khung giờ trống tại địa điểm và ngày đã chọn.')
      : message;
  const action = searchFeedbackAction({ hasSearched, hasItems, isLoading });
  if (!localized) return null;
  return <section className="notice search-feedback-empty" role="status">
    <p>{localized}</p>
    {action === 'refine-search' && <button className="text-button notice-action" type="button" onClick={onRefineSearch}>{t('Change location or date', 'Đổi địa điểm hoặc ngày')}</button>}
  </section>;
}
