import type { JSX } from 'react';
import { bookingDateRange } from '../booking-date-strip';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface BookingDateStripProps {
  date: string;
  isLoading: boolean;
  onDateChange: (date: string) => void;
}

function dateParts(value: string, locale: string): { weekday: string; dayAndMonth: string } {
  const instant = new Date(`${value}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(instant),
    dayAndMonth: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(instant)
  };
}

export function BookingDateStrip({ date, isLoading, onDateChange }: BookingDateStripProps): JSX.Element {
  const { locale, t } = useI18n();
  const intlLocale = locale === 'vi' ? 'vi-VN' : 'en-GB';

  return <section className="booking-date-strip" aria-label={t('Choose another date', 'Chọn ngày khác')}>
    <div className="booking-date-strip-heading"><span>{t('Change date', 'Đổi ngày')}</span><small>{t('Live availability refreshes for each date', 'Lịch trống được cập nhật trực tiếp theo từng ngày')}</small></div>
    <div className="booking-date-options" role="group" aria-label={t('Available date choices', 'Các ngày có thể chọn')}>
      {bookingDateRange(date).map((value) => {
        const parts = dateParts(value, intlLocale);
        const isSelected = value === date;
        return <button className={`booking-date-option${isSelected ? ' booking-date-option-selected' : ''}`} type="button" key={value} aria-pressed={isSelected} disabled={isLoading} onClick={() => onDateChange(value)}>
          <span>{parts.weekday}</span><strong>{parts.dayAndMonth}</strong>
        </button>;
      })}
    </div>
  </section>;
}
