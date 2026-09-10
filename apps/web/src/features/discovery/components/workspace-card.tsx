import type { JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { formatVnd } from '../format-vnd';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { Icon } from '../../../shared/ui/icon';

interface WorkspaceCardProps {
  item: WorkspaceSearchItem;
  index?: number;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceCard({ item, index = 0, onSelect }: WorkspaceCardProps): JSX.Element {
  const { locale, t } = useI18n();
  const cover = item.media.find((media) => media.isCover) ?? item.media[0];
  return (
    <article className={`workspace-card workspace-card-enter-${Math.min(index, 5)}`}>
      <div className="workspace-image-wrap">
        {cover ? <img className="workspace-cover" src={cover.url} width={cover.width} height={cover.height} loading="lazy" alt={`${item.workspaceName} ${t('at', 'tại')} ${item.salonName}`} /> : <div className="workspace-image-fallback" role="img" aria-label={t('Workspace image unavailable', 'Chưa có ảnh không gian')}>{t('Workspace', 'Không gian')}</div>}
        <strong className="price-badge">{item.startingPriceCents === null ? t('Price on request', 'Liên hệ để biết giá') : `${t('From', 'Từ')} ${formatVnd(item.startingPriceCents, locale)}`}</strong>
        {item.media.length > 1 && <span className="workspace-media-count" aria-label={`${item.media.length} ${t('photos', 'ảnh')}`}><Icon name="image" size={14} />{item.media.length}</span>}
      </div>
      <div className="workspace-card-body">
        <p className="card-area">{item.area}</p>
        <h2>{item.workspaceName}</h2>
        <p>{item.salonName}</p>
        <div className="card-footer"><span>{item.availableSlotCount} {t(item.availableSlotCount === 1 ? 'time available' : 'times available', 'khung giờ còn trống')}</span><span className="card-live-label">{t('Live', 'Trực tiếp')}</span></div>
        <button className="workspace-select" type="button" onClick={() => onSelect(item.workspaceId)}>{t('View available times', 'Xem giờ còn trống')}</button>
      </div>
    </article>
  );
}
