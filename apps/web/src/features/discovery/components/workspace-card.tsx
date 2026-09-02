import type { JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { formatVnd } from '../format-vnd';

interface WorkspaceCardProps {
  item: WorkspaceSearchItem;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceCard({ item, onSelect }: WorkspaceCardProps): JSX.Element {
  const cover = item.media.find((media) => media.isCover) ?? item.media[0];
  return (
    <article className="workspace-card">
      <div className="workspace-image-wrap">
        {cover ? <img className="workspace-cover" src={cover.url} width={cover.width} height={cover.height} alt={`${item.workspaceName} at ${item.salonName}`} /> : <div className="workspace-image-fallback" aria-hidden="true">Workspace</div>}
        <strong className="price-badge">{item.startingPriceCents === null ? 'Price on request' : `From ${formatVnd(item.startingPriceCents)}`}</strong>
      </div>
      <div className="workspace-card-body">
        <p className="card-area">{item.area}</p>
        <h2>{item.workspaceName}</h2>
        <p>{item.salonName}</p>
        <div className="card-footer"><span>{item.availableSlotCount} {item.availableSlotCount === 1 ? 'time available' : 'times available'}</span></div>
        <button className="workspace-select" type="button" onClick={() => onSelect(item.workspaceId)}>View available times</button>
      </div>
    </article>
  );
}
