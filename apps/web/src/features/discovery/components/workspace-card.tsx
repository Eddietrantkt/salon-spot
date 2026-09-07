import type { JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { formatVnd } from '../format-vnd';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface WorkspaceCardProps {
  item: WorkspaceSearchItem;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceCard({ item, onSelect }: WorkspaceCardProps): JSX.Element {
  const { locale, t } = useI18n();
  const cover = item.media.find((media) => media.isCover) ?? item.media[0];
  return (
    <article className="workspace-card">
      <div className="workspace-image-wrap">
        {cover ? <img className="workspace-cover" src={cover.url} width={cover.width} height={cover.height} alt={`${item.workspaceName} ${t('at', 'tại')} ${item.salonName}`} /> : <div className="workspace-image-fallback" aria-hidden="true">{t('Workspace', 'Không gian')}</div>}
        <strong className="price-badge">{item.startingPriceCents === null ? t('Price on request', 'Liên hệ để biết giá') : `${t('From', 'Từ')} ${formatVnd(item.startingPriceCents, locale)}`}</strong>
      </div>
      <div className="workspace-card-body">
        <p className="card-area">{item.area}</p>
        <h2>{item.workspaceName}</h2>
        <p>{item.salonName}</p>
        <div className="card-footer"><span>{item.availableSlotCount} {t(item.availableSlotCount === 1 ? 'time available' : 'times available', 'khung giờ còn trống')}</span></div>
        <button className="workspace-select" type="button" onClick={() => onSelect(item.workspaceId)}>{t('View available times', 'Xem giờ còn trống')}</button>
      </div>
    </article>
  );
}
