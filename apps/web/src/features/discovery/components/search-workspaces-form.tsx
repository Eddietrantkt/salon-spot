import { useId, type FormEvent, type JSX } from 'react';

const suggestedLocations = [
  { label: 'District 1, Ho Chi Minh City', value: 'D1' },
  { label: 'District 3, Ho Chi Minh City', value: 'D3' },
  { label: 'Binh Thanh, Ho Chi Minh City', value: 'Binh Thanh' }
] as const;

interface SearchWorkspacesFormProps {
  area: string;
  date: string;
  isLoading: boolean;
  variant?: 'hero' | 'results';
  onAreaChange: (area: string) => void;
  onDateChange: (date: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SearchWorkspacesForm({
  area,
  date,
  isLoading,
  variant = 'hero',
  onAreaChange,
  onDateChange,
  onSubmit
}: SearchWorkspacesFormProps): JSX.Element {
  const locationSuggestionsId = useId();
  return (
    <form className={`search-form search-form-${variant}`} onSubmit={onSubmit}>
      <div className="search-field search-location-field">
        <span className="search-field-icon" aria-hidden="true">⌖</span>
        <label>
          <span>Location</span>
          <input list={locationSuggestionsId} placeholder="District, neighbourhood, or city" value={area} onChange={(event) => onAreaChange(event.target.value)} required maxLength={120} />
        </label>
        <datalist id={locationSuggestionsId}>
          {suggestedLocations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
        </datalist>
      </div>
      <div className="search-field">
        <span className="search-field-icon" aria-hidden="true">◷</span>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} required />
        </label>
      </div>
      <button className="search-submit" type="submit" disabled={isLoading}>{isLoading ? 'Searching…' : 'Search workspaces'}</button>
      {variant === 'hero' && <div className="location-suggestions" aria-label="Suggested locations"><span>Popular</span>{suggestedLocations.map((location) => <button key={location.value} className="location-chip" type="button" onClick={() => onAreaChange(location.value)}>{location.label}</button>)}</div>}
    </form>
  );
}
