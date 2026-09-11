import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { searchWorkspaces } from '../api/search-workspaces';
import { SearchFeedback } from '../components/search-feedback';
import { SearchWorkspacesForm } from '../components/search-workspaces-form';
import { WorkspaceCard } from '../components/workspace-card';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { fallbackImageFor } from '../../../shared/ui/media-fallbacks';
import { ResilientImage } from '../../../shared/ui/resilient-image';
import { Icon } from '../../../shared/ui/icon';

const stitchHeroImages = {
  salon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAH-13AMoSh9vFQaRT4XvfKAoNbUMjkXYeySHdw2InPKshNXF02FhFdW9sXcA1kCvseiE4zXOaXn0fArVN6UK-2x7FHhCrhS1AxLBcw0orkCkyRr2U-SCoDjEW33b2dpnNoSLqCD-O7n9ER736oGRcYRq0b644eypt5GFven4ToWy88gXn7a283rQYG7IDnmDyY3x3RV9zvZa6bVPNk4IZtFW0kYoWndS7B4r-i8rG9frOsVRIhExBcrw',
  suite: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGuoD_hXonbSE0vFuRCgZNudwFN9IqJvO8dsNWplqXLY5DwkvahaNU8eX6mxrQdkwpZW4o5XeX7RW9mATsP37odJ0ODsigUNhb03ybiNw86gKlot-R8CX_TnjPQ7X48kIGfisYxB3qevi_kIjnq08O05XYBHJlJxi4OGEqNgCk-NO_JeV5RT_krVNNBS0P5vsF77Oqbu5fjZi52-FC4M74trYpeau5GMi5gXTUJXcBoMhYs5QfTz6XIA'
} as const;

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
  const [error, setError] = useState<unknown>(null);
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
      setError(reason);
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
        <div className="discovery-hero-content">
          <div className="discovery-hero-intro">
            <div className="discovery-copy">
              <p className="eyebrow">{t('THE SALON SPOT · FLEXIBLE BEAUTY SPACES', 'THE SALON SPOT · KHÔNG GIAN LÀM ĐẸP LINH HOẠT')}</p>
              <h1>{t('Elevate your craft in ', 'Nâng tầm tay nghề tại ')}<em>{t('premium spaces.', 'những không gian cao cấp.')}</em></h1>
              <p className="lead">{t('Discover and book professional salon workspaces by location and date. Availability is confirmed by the live schedule.', 'Khám phá và đặt không gian salon chuyên nghiệp theo địa điểm và ngày. Tình trạng còn trống được xác nhận theo lịch trực tiếp.')}</p>
            </div>
            <div className="discovery-hero-search">
              <SearchWorkspacesForm
                area={area}
                date={date}
                isLoading={isLoading}
                onAreaChange={changeArea}
                onDateChange={changeDate}
                onSubmit={onSubmit}
              />
            </div>
          </div>
          <DiscoveryHeroVisual t={t} />
        </div>
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
      <SearchFeedback error={error} hasSearched={hasSearched} isLoading={isLoading} hasItems={items.length > 0} onRefineSearch={refineSearch} onRetry={() => void search(area, date)} />

      {hasSearched && !isLoading && items.length > 0 && <header className="result-heading"><div><p className="eyebrow">{t('AVAILABLE WORKSPACES', 'KHÔNG GIAN ĐANG TRỐNG')}</p><h2>{t('Spaces for your next session', 'Không gian cho buổi làm việc tiếp theo')}</h2></div><span>{items.length} {t(items.length === 1 ? 'space' : 'spaces', 'không gian')}</span></header>}
      <section className="workspace-grid" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? <WorkspaceGridSkeleton /> : items.map((item, index) => <WorkspaceCard item={item} key={item.workspaceId} index={index} onSelect={(workspaceId) => onSelectWorkspace(workspaceId, area, date)} />)}
      </section>
    </main>
  );
}

function DiscoveryHeroVisual({ t }: { t: (english: string, vietnamese: string) => string }): JSX.Element {
  return (
    <div className="discovery-stitch-visual">
      <div className="discovery-photo-grid">
        <div className="discovery-photo discovery-photo-primary">
          <ResilientImage src={stitchHeroImages.salon} fallbackSrc={fallbackImageFor('Salon station')} width={1600} height={1067} alt={t('Modern salon workspace', 'Không gian salon hiện đại')} />
          <div className="discovery-photo-caption"><strong>{t('Professional-ready spaces', 'Không gian sẵn sàng làm việc')}</strong><span>{t('Search by area and date', 'Tìm theo khu vực và ngày')}</span></div>
        </div>
        <div className="discovery-photo discovery-photo-secondary">
          <ResilientImage src={stitchHeroImages.suite} fallbackSrc={fallbackImageFor('Private styling studio')} width={1600} height={1067} alt={t('Private beauty suite', 'Phòng làm đẹp riêng tư')} />
        </div>
        <aside className="discovery-trust-card">
          <span className="discovery-trust-icon"><Icon name="calendar-check" size={22} /></span>
          <h2>{t('Live availability', 'Lịch trống trực tiếp')}</h2>
          <p>{t('Choose an area and date to see the slots currently available to book.', 'Chọn khu vực và ngày để xem các khung giờ hiện còn có thể đặt.')}</p>
        </aside>
      </div>
    </div>
  );
}

function WorkspaceGridSkeleton(): JSX.Element {
  return <>{[0, 1, 2].map((index) => <article className="workspace-card workspace-card-skeleton" key={index} aria-hidden="true"><div className="skeleton-block skeleton-image" /><div className="workspace-card-body"><div className="skeleton-block skeleton-label" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><div className="skeleton-block skeleton-button" /></div></article>)}</>;
}
