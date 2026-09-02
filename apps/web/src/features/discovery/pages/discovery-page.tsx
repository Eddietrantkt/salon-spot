import { useEffect, useState, type FormEvent, type JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { searchWorkspaces } from '../api/search-workspaces';
import { SearchFeedback } from '../components/search-feedback';
import { SearchWorkspacesForm } from '../components/search-workspaces-form';
import { WorkspaceCard } from '../components/workspace-card';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';

interface DiscoveryPageProps {
  initialArea: string;
  initialDate: string;
  initialHasSearched: boolean;
  onSearchCommitted: (area: string, date: string) => void;
  onSelectWorkspace: (workspaceId: string, area: string, date: string) => void;
}

export function DiscoveryPage({ initialArea, initialDate, initialHasSearched, onSearchCommitted, onSelectWorkspace }: DiscoveryPageProps): JSX.Element {
  const [area, setArea] = useState(initialArea || 'D1');
  const [date, setDate] = useState(initialDate || tomorrowInLocalCalendar);
  const [items, setItems] = useState<WorkspaceSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(initialHasSearched);

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
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell discovery-shell">
      <header className="discovery-hero">
        <div className="discovery-copy">
          <p className="eyebrow">THE SALON SPOT · FLEXIBLE BEAUTY SPACES</p>
          <h1>Find a workspace that <em>fits your craft.</em></h1>
          <p className="lead">Explore professional-ready salon spaces by location and date. Availability is always confirmed by the live schedule.</p>
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
        onAreaChange={changeArea}
        onDateChange={changeDate}
        onSubmit={onSubmit}
      /></div>}
      <SearchFeedback error={error} hasSearched={hasSearched} isLoading={isLoading} hasItems={items.length > 0} />

      {hasSearched && !isLoading && items.length > 0 && <header className="result-heading"><div><p className="eyebrow">AVAILABLE WORKSPACES</p><h2>Spaces for your next session</h2></div><span>{items.length} {items.length === 1 ? 'space' : 'spaces'}</span></header>}
      <section className="workspace-grid" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? <WorkspaceGridSkeleton /> : items.map((item) => <WorkspaceCard item={item} key={item.workspaceId} onSelect={(workspaceId) => onSelectWorkspace(workspaceId, area, date)} />)}
      </section>
    </main>
  );
}

function WorkspaceGridSkeleton(): JSX.Element {
  return <>{[0, 1, 2].map((index) => <article className="workspace-card workspace-card-skeleton" key={index} aria-hidden="true"><div className="skeleton-block skeleton-image" /><div className="workspace-card-body"><div className="skeleton-block skeleton-label" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><div className="skeleton-block skeleton-button" /></div></article>)}</>;
}
