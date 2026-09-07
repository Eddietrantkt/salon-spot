import { useId, type FormEvent, type JSX, type Ref } from 'react';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';

const suggestedLocations = [
  { label: ['District 1, Ho Chi Minh City', 'Quận 1, Thành phố Hồ Chí Minh'], value: 'D1' },
  { label: ['District 3, Ho Chi Minh City', 'Quận 3, Thành phố Hồ Chí Minh'], value: 'D3' },
  { label: ['Binh Thanh, Ho Chi Minh City', 'Bình Thạnh, Thành phố Hồ Chí Minh'], value: 'Binh Thanh' }
] as const;

interface SearchWorkspacesFormProps {
  area: string;
  date: string;
  isLoading: boolean;
  variant?: 'hero' | 'results';
  locationInputRef?: Ref<HTMLInputElement>;
  onAreaChange: (area: string) => void;
  onDateChange: (date: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SearchWorkspacesForm({
  area,
  date,
  isLoading,
  variant = 'hero',
  locationInputRef,
  onAreaChange,
  onDateChange,
  onSubmit
}: SearchWorkspacesFormProps): JSX.Element {
  const { t } = useI18n();
  const locationSuggestionsId = useId();
  return (
    <form className={`search-form search-form-${variant}`} onSubmit={onSubmit}>
      <div className="search-field search-location-field">
        <span className="search-field-icon" aria-hidden="true">⌖</span>
        <label>
          <span>{t('Location', 'Địa điểm')}</span>
          <input ref={locationInputRef} list={locationSuggestionsId} placeholder={t('District, neighbourhood, or city', 'Quận, khu vực hoặc thành phố')} value={area} onChange={(event) => onAreaChange(event.target.value)} required maxLength={120} />
        </label>
        <datalist id={locationSuggestionsId}>
          {suggestedLocations.map((location) => <option key={location.value} value={location.value}>{t(location.label[0], location.label[1])}</option>)}
        </datalist>
      </div>
      <div className="search-field">
        <span className="search-field-icon" aria-hidden="true">◷</span>
        <label>
          <span>{t('Date', 'Ngày')}</span>
          <input type="date" min={tomorrowInLocalCalendar()} value={date} onChange={(event) => onDateChange(event.target.value)} required />
        </label>
      </div>
      <button className="search-submit" type="submit" disabled={isLoading}>{isLoading ? t('Searching…', 'Đang tìm…') : t('Search workspaces', 'Tìm không gian')}</button>
      {variant === 'hero' && <div className="location-suggestions" aria-label={t('Suggested locations', 'Địa điểm gợi ý')}><span>{t('Popular', 'Phổ biến')}</span>{suggestedLocations.map((location) => <button key={location.value} className="location-chip" type="button" onClick={() => onAreaChange(location.value)}>{t(location.label[0], location.label[1])}</button>)}</div>}
    </form>
  );
}
