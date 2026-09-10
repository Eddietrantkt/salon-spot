import { useEffect, useState, type JSX } from 'react';
import type { PublicMedia } from '@salon-spot/contracts';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface WorkspaceMediaGalleryProps {
  media: PublicMedia[];
  workspaceName: string;
  salonName: string;
}

export function WorkspaceMediaGallery({ media, workspaceName, salonName }: WorkspaceMediaGalleryProps): JSX.Element | null {
  const { t } = useI18n();
  const [activeMediaId, setActiveMediaId] = useState(media[0]?.id ?? null);
  const activeMedia = media.find((item) => item.id === activeMediaId) ?? media[0];

  useEffect(() => { setActiveMediaId(media[0]?.id ?? null); }, [media]);
  if (!activeMedia) return null;

  return <section className="booking-media-gallery" aria-label={`${t('Gallery for', 'Thư viện ảnh của')} ${workspaceName}`}>
    <div className="booking-media-stage">
      <img className="booking-media-active" key={activeMedia.id} src={activeMedia.url} width={activeMedia.width} height={activeMedia.height} alt={`${workspaceName} ${t('at', 'tại')} ${salonName}`} />
      {media.length > 1 && <span className="booking-media-position" aria-live="polite">{media.findIndex((item) => item.id === activeMedia.id) + 1} / {media.length}</span>}
    </div>
    {media.length > 1 && <div className="booking-media-thumbnails" role="group" aria-label={t('Choose a gallery image', 'Chọn ảnh trong thư viện')}>
      {media.slice(0, 5).map((item, index) => <button className={`booking-media-thumbnail${item.id === activeMedia.id ? ' booking-media-thumbnail-selected' : ''}`} type="button" key={item.id} aria-pressed={item.id === activeMedia.id} onClick={() => setActiveMediaId(item.id)}>
        <img src={item.url} width={item.width} height={item.height} alt={t(`View image ${index + 1}`, `Xem ảnh ${index + 1}`)} />
      </button>)}
    </div>}
  </section>;
}
