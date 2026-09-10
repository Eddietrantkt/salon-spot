import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { searchWorkspaces } from '../api/search-workspaces';
import { SearchFeedback } from '../components/search-feedback';
import { SearchWorkspacesForm } from '../components/search-workspaces-form';
import { WorkspaceCard } from '../components/workspace-card';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { Icon } from '../../../shared/ui/icon';

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
        <div className="discovery-hero-intro">
          <div className="discovery-copy">
            <p className="eyebrow">{t('THE SALON SPOT · FLEXIBLE BEAUTY SPACES', 'THE SALON SPOT · KHÔNG GIAN LÀM ĐẸP LINH HOẠT')}</p>
            <h1>{t('Find a workspace that ', 'Tìm không gian ')}<em>{t('fits your craft.', 'phù hợp với tay nghề của bạn.')}</em></h1>
            <p className="lead">{t('Explore professional-ready salon spaces by location and date. Availability is always confirmed by the live schedule.', 'Khám phá không gian salon chuyên nghiệp theo địa điểm và ngày. Tình trạng còn trống luôn được xác nhận theo lịch trực tiếp.')}</p>
          </div>
          <div className="discovery-proof-strip" aria-label={t('Explore highlights', 'Điểm nổi bật khi khám phá')}>
            <span><strong>01</strong>{t('Live availability', 'Lịch trống trực tiếp')}</span>
            <span><strong>02</strong>{t('Ready-to-work spaces', 'Không gian sẵn sàng làm việc')}</span>
          </div>
          <SearchWorkspacesForm
            area={area}
            date={date}
            isLoading={isLoading}
            onAreaChange={changeArea}
            onDateChange={changeDate}
            onSubmit={onSubmit}
          />
        </div>
        <div className="discovery-hero-side">
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
    <div className="discovery-visual" aria-hidden="true">
      <div className="visual-orbit visual-orbit-one" />
      <div className="visual-orbit visual-orbit-two" />
      <div className="visual-window visual-window-main">
        <div className="visual-window-topbar"><span /><span /><span /><small>{t('A calm place to create', 'Một nơi thật đẹp để sáng tạo')}</small></div>
        <div className="visual-window-scene">
          <div className="scene-sun" />
          <div className="scene-arch"><span className="scene-mirror" /><span className="scene-chair" /><span className="scene-plant" /></div>
        </div>
        <div className="visual-window-caption"><span>{t('Open tomorrow', 'Mở lịch ngày mai')}</span><strong>09:00 — 17:00</strong></div>
      </div>
      <div className="visual-tile visual-tile-detail"><span className="tile-detail-shape" /><small>{t('Private suite', 'Phòng riêng')}</small></div>
      <div className="visual-tile visual-tile-texture"><span className="tile-texture-lines" /><small>{t('Made for your craft', 'Sinh ra cho tay nghề của bạn')}</small></div>
      <div className="visual-note visual-note-top"><span className="visual-note-icon"><Icon name="sparkles" size={15} /></span><span><small>{t('CURATED FOR YOU', 'ĐƯỢC CHỌN CHO BẠN')}</small><strong>{t('A better day starts here', 'Một ngày làm việc bắt đầu từ đây')}</strong></span></div>
      <div className="visual-note visual-note-bottom"><span className="visual-live-dot" />{t('Live schedule', 'Lịch trực tiếp')}</div>
    </div>
  );
}

function WorkspaceGridSkeleton(): JSX.Element {
  return <>{[0, 1, 2].map((index) => <article className="workspace-card workspace-card-skeleton" key={index} aria-hidden="true"><div className="skeleton-block skeleton-image" /><div className="workspace-card-body"><div className="skeleton-block skeleton-label" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><div className="skeleton-block skeleton-button" /></div></article>)}</>;
}
