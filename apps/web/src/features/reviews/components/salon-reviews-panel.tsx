import { useEffect, useState, type JSX } from 'react';
import type { SalonReview, SalonReviewSummary } from '@salon-spot/contracts';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { getSalonReviews } from '../api/reviews-api';

const PAGE_SIZE = 5;

export function SalonReviewsPanel({ salonId }: { salonId: string }): JSX.Element {
  const { locale, t } = useI18n();
  const [reviews, setReviews] = useState<SalonReview[]>([]);
  const [summary, setSummary] = useState<SalonReviewSummary>({ averageRating: null, reviewCount: 0 });
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setReviews([]); setPage(0); void loadPage(1, true); }, [salonId]);

  async function loadPage(nextPage: number, replace = false): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSalonReviews(salonId, nextPage, PAGE_SIZE);
      setReviews((current) => replace ? response.data : [...current, ...response.data]);
      setSummary(response.summary);
      setPage(nextPage);
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
    } finally {
      setIsLoading(false);
    }
  }

  return <section className="salon-reviews-panel" aria-labelledby="salon-reviews-heading">
    <div className="review-heading">
      <div><p className="eyebrow">{t('VERIFIED REVIEWS', 'ĐÁNH GIÁ ĐÃ XÁC THỰC')}</p><h2 id="salon-reviews-heading">{t('What professionals say', 'Chuyên viên nói gì')}</h2></div>
      {summary.averageRating !== null && <div className="review-score"><strong>{summary.averageRating.toFixed(1)}</strong><span aria-label={`${summary.averageRating} ${t('out of 5', 'trên 5')}`}>★</span><small>{summary.reviewCount} {summary.reviewCount === 1 ? t('review', 'đánh giá') : t('reviews', 'đánh giá')}</small></div>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {isLoading && page === 0 ? <p className="notice">{t('Loading reviews…', 'Đang tải đánh giá…')}</p> : reviews.length === 0 ? <p className="notice">{t('No verified reviews yet.', 'Chưa có đánh giá đã xác thực.')}</p> : <ul className="salon-review-list">{reviews.map((review) => <li key={review.id}>
      <div className="review-card-heading"><strong>{review.authorDisplayName}</strong><span aria-label={`${review.rating} ${t('out of 5 stars', 'trên 5 sao')}`}>{'★'.repeat(review.rating)}<i>{'★'.repeat(5 - review.rating)}</i></span></div>
      {review.body && <p>{review.body}</p>}
      <small>✓ {t('Verified rental', 'Lượt thuê đã xác thực')} · {new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</small>
    </li>)}</ul>}
    {reviews.length < summary.reviewCount && <button className="review-load-more" type="button" disabled={isLoading} onClick={() => void loadPage(page + 1)}>{isLoading ? t('Loading…', 'Đang tải…') : t('Load more reviews', 'Xem thêm đánh giá')}</button>}
  </section>;
}
