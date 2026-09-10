import type { JSX } from 'react';
import type { WorkspaceSearchItem } from '@salon-spot/contracts';
import { formatVnd } from '../format-vnd';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { Icon } from '../../../shared/ui/icon';
import { fallbackImageFor } from '../../../shared/ui/media-fallbacks';
import { ResilientImage } from '../../../shared/ui/resilient-image';

interface WorkspaceCardProps {
  item: WorkspaceSearchItem;
  index?: number;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceCard({ item, index = 0, onSelect }: WorkspaceCardProps): JSX.Element {
  const { locale, t } = useI18n();
  const cover = item.media.find((media) => media.isCover) ?? item.media[0];
  const fallbackSrc = fallbackImageFor(item.workspaceName);
  return (
    <article className={`workspace-card workspace-card-enter-${Math.min(index, 5)}`}>
      <div className="workspace-image-wrap">
        <ResilientImage className="workspace-cover" src={cover?.url} fallbackSrc={fallbackSrc} width={cover?.width ?? 1600} height={cover?.height ?? 1067} loading="lazy" alt={`${item.workspaceName} ${t('at', 'tại')} ${item.salonName}`} />
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
