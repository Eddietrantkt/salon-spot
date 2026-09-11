import { useId, useState, type FormEvent, type JSX, type Ref } from 'react';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { Icon } from '../../../shared/ui/icon';

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
  const [activeField, setActiveField] = useState<'location' | 'date' | null>(null);

  function selectSuggestedLocation(value: string): void {
    setActiveField('location');
    onAreaChange(value);
  }

  return (
    <form className={`search-form search-form-${variant}${isLoading ? ' search-form-loading' : ''}`} onSubmit={onSubmit} aria-busy={isLoading}>
      {variant === 'hero' && <div className="search-form-header">
        <div><span className="search-form-kicker">{t('SESSION PLANNER', 'LÊN KẾ HOẠCH')}</span><strong>{t('Plan your next session', 'Lên kế hoạch cho buổi làm việc')}</strong></div>
        <span className="search-form-status"><span className="search-live-dot" aria-hidden="true" />{t('Live', 'Trực tiếp')}</span>
      </div>}
      <div className={`search-field search-location-field${activeField === 'location' ? ' search-field-active' : ''}`}>
        <span className="search-field-icon"><Icon name="map-pin" /></span>
        <label>
          <span>{t('Location', 'Địa điểm')}</span>
          <input ref={locationInputRef} list={locationSuggestionsId} placeholder={t('District, neighbourhood, or city', 'Quận, khu vực hoặc thành phố')} value={area} onFocus={() => setActiveField('location')} onBlur={() => setActiveField(null)} onChange={(event) => onAreaChange(event.target.value)} required maxLength={120} />
        </label>
        <datalist id={locationSuggestionsId}>
          {suggestedLocations.map((location) => <option key={location.value} value={location.value}>{t(location.label[0], location.label[1])}</option>)}
        </datalist>
      </div>
      <div className={`search-field${activeField === 'date' ? ' search-field-active' : ''}`}>
        <span className="search-field-icon"><Icon name="calendar" /></span>
        <label>
          <span>{t('Date', 'Ngày')}</span>
          <input type="date" min={tomorrowInLocalCalendar()} value={date} onFocus={() => setActiveField('date')} onBlur={() => setActiveField(null)} onChange={(event) => onDateChange(event.target.value)} required />
        </label>
      </div>
      <button className="search-submit" type="submit" disabled={isLoading}><span>{isLoading ? t('Searching…', 'Đang tìm…') : t('Search workspaces', 'Tìm không gian')}</span><span className="search-submit-icon"><Icon name="arrow-right" /></span></button>
      {variant === 'hero' && <div className="location-suggestions" aria-label={t('Suggested locations', 'Địa điểm gợi ý')}>
        <span className="search-live-indicator"><span className="search-live-dot" aria-hidden="true" />{t('Live availability', 'Lịch trống trực tiếp')}</span>
        {suggestedLocations.map((location) => {
          const isSelected = area === location.value;
          return <button key={location.value} className={`location-chip${isSelected ? ' location-chip-selected' : ''}`} type="button" aria-pressed={isSelected} onClick={() => selectSuggestedLocation(location.value)}>{isSelected && <span className="location-chip-check" aria-hidden="true">✓</span>}{t(location.label[0], location.label[1])}</button>;
        })}
      </div>}
    </form>
  );
}
