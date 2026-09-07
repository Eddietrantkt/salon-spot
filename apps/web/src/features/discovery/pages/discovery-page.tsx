import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { searchWorkspaces } from '../api/search-workspaces';
import { SearchFeedback } from '../components/search-feedback';
import { SearchWorkspacesForm } from '../components/search-workspaces-form';
import { WorkspaceCard } from '../components/workspace-card';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

interface DiscoveryPageProps {
  initialArea: string;
  initialDate: string;
  initialHasSearched: boolean;
  onSearchCommitted: (area: string, date: string) => void;
  onSelectWorkspace: (workspaceId: string, area: string, date: string) => void;
}

export function DiscoveryPage({ initialArea, initialDate, initialHasSearched, onSearchCommitted, onSelectWorkspace }: DiscoveryPageProps): JSX.Element {
  const { t } = useI18n();
  const [area, setArea] = useState(initialArea || 'D1');
  const [date, setDate] = useState(initialDate || tomorrowInLocalCalendar);
  const [items, setItems] = useState<WorkspaceSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(initialHasSearched);
  const resultsLocationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialHasSearched) void search(initialArea, initialDate);
  }, []);

  function resetSearch(): void {
    setHasSearched(false);
    setItems([]);
    setError(null);
  }

  function changeArea(value: string): void {
    setArea(value);
    resetSearch();
  }

  function changeDate(value: string): void {
    setDate(value);
    resetSearch();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    onSearchCommitted(area.trim(), date);
  }

  async function search(nextArea: string, nextDate: string): Promise<void> {
    setError(null);
    setHasSearched(true);
    setIsLoading(true);
    try {
      const response = await searchWorkspaces(nextArea, nextDate);
      setItems(response.data);
    } catch (reason) {
      setItems([]);
      setError(localizedErrorMessage(reason, t));
    } finally {
      setIsLoading(false);
    }
  }

  function refineSearch(): void {
    resultsLocationInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    resultsLocationInputRef.current?.focus({ preventScroll: true });
  }

  return (
    <main className="page-shell discovery-shell">
      <header className="discovery-hero">
        <div className="discovery-copy">
          <p className="eyebrow">{t('THE SALON SPOT · FLEXIBLE BEAUTY SPACES', 'THE SALON SPOT · KHÔNG GIAN LÀM ĐẸP LINH HOẠT')}</p>
          <h1>{t('Find a workspace that ', 'Tìm không gian ')}<em>{t('fits your craft.', 'phù hợp với tay nghề của bạn.')}</em></h1>
          <p className="lead">{t('Explore professional-ready salon spaces by location and date. Availability is always confirmed by the live schedule.', 'Khám phá không gian salon chuyên nghiệp theo địa điểm và ngày. Tình trạng còn trống luôn được xác nhận theo lịch trực tiếp.')}</p>
        </div>
        <SearchWorkspacesForm
          area={area}
          date={date}
          isLoading={isLoading}
          onAreaChange={changeArea}
          onDateChange={changeDate}
          onSubmit={onSubmit}
        />
      </header>

      {hasSearched && <div className="result-search-stick"><SearchWorkspacesForm
        area={area}
        date={date}
        isLoading={isLoading}
        variant="results"
        locationInputRef={resultsLocationInputRef}
        onAreaChange={changeArea}
        onDateChange={changeDate}
        onSubmit={onSubmit}
      /></div>}
      <SearchFeedback error={error} hasSearched={hasSearched} isLoading={isLoading} hasItems={items.length > 0} onRefineSearch={refineSearch} />

      {hasSearched && !isLoading && items.length > 0 && <header className="result-heading"><div><p className="eyebrow">{t('AVAILABLE WORKSPACES', 'KHÔNG GIAN ĐANG TRỐNG')}</p><h2>{t('Spaces for your next session', 'Không gian cho buổi làm việc tiếp theo')}</h2></div><span>{items.length} {t(items.length === 1 ? 'space' : 'spaces', 'không gian')}</span></header>}
      <section className="workspace-grid" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? <WorkspaceGridSkeleton /> : items.map((item) => <WorkspaceCard item={item} key={item.workspaceId} onSelect={(workspaceId) => onSelectWorkspace(workspaceId, area, date)} />)}
      </section>
    </main>
  );
}

function WorkspaceGridSkeleton(): JSX.Element {
  return <>{[0, 1, 2].map((index) => <article className="workspace-card workspace-card-skeleton" key={index} aria-hidden="true"><div className="skeleton-block skeleton-image" /><div className="workspace-card-body"><div className="skeleton-block skeleton-label" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><div className="skeleton-block skeleton-button" /></div></article>)}</>;
}
