import { useRef, useState, type FormEvent, type JSX } from 'react';
import type { SalonReview } from '@salon-spot/contracts';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { createSalonReview } from '../api/reviews-api';

interface SalonReviewFormProps {
  accessToken: string;
  bookingId: string;
  onCreated: (review: SalonReview) => void;
}

export function SalonReviewForm({ accessToken, bookingId, onCreated }: SalonReviewFormProps): JSX.Element {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await createSalonReview(accessToken, bookingId, { rating, ...(body.trim() ? { body: body.trim() } : {}) }, idempotencyKey.current);
      onCreated(response.review);
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <form className="salon-review-form" onSubmit={(event) => void submit(event)}>
    <div>
      <p className="eyebrow">{t('VERIFIED RENTAL', 'LƯỢT THUÊ ĐÃ XÁC THỰC')}</p>
      <h3>{t('How was this salon?', 'Trải nghiệm Salon thế nào?')}</h3>
    </div>
    <label>
      {t('Rating', 'Điểm đánh giá')}
      <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
        <option value={5}>5 — {t('Excellent', 'Xuất sắc')}</option>
        <option value={4}>4 — {t('Good', 'Tốt')}</option>
        <option value={3}>3 — {t('Okay', 'Ổn')}</option>
        <option value={2}>2 — {t('Could improve', 'Cần cải thiện')}</option>
        <option value={1}>1 — {t('Poor', 'Kém')}</option>
      </select>
    </label>
    <label>
      {t('Your review (optional)', 'Nhận xét của bạn (không bắt buộc)')}
      <textarea maxLength={1000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t('Share details that would help other professionals.', 'Chia sẻ điều hữu ích cho những chuyên viên khác.')} />
    </label>
    {error && <p className="review-inline-error" role="alert">{error}</p>}
    <button type="submit" disabled={isSubmitting}>{isSubmitting ? t('Publishing…', 'Đang đăng…') : t('Publish review', 'Đăng đánh giá')}</button>
  </form>;
}
