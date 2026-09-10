import { useEffect, useState, type JSX } from 'react';
import type { PublicMedia } from '@salon-spot/contracts';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { fallbackImageFor } from '../../../shared/ui/media-fallbacks';
import { ResilientImage } from '../../../shared/ui/resilient-image';

interface WorkspaceMediaGalleryProps {
  media: PublicMedia[];
  workspaceName: string;
  salonName: string;
}

export function WorkspaceMediaGallery({ media, workspaceName, salonName }: WorkspaceMediaGalleryProps): JSX.Element | null {
  const { t } = useI18n();
  const galleryMedia: PublicMedia[] = media.length > 0 ? media : [{ id: `fallback-${workspaceName}`, url: fallbackImageFor(workspaceName), width: 1600, height: 1067, sortOrder: 0, isCover: true }];
  const [activeMediaId, setActiveMediaId] = useState(galleryMedia[0]?.id ?? null);
  const activeMedia = galleryMedia.find((item) => item.id === activeMediaId) ?? galleryMedia[0];

  useEffect(() => { setActiveMediaId(galleryMedia[0]?.id ?? null); }, [media, workspaceName]);
  if (!activeMedia) return null;

  return <section className="booking-media-gallery" aria-label={`${t('Gallery for', 'Thư viện ảnh của')} ${workspaceName}`}>
    <div className="booking-media-stage">
      <ResilientImage className="booking-media-active" key={activeMedia.id} src={activeMedia.url} fallbackSrc={fallbackImageFor(workspaceName)} width={activeMedia.width} height={activeMedia.height} alt={`${workspaceName} ${t('at', 'tại')} ${salonName}`} />
      {galleryMedia.length > 1 && <span className="booking-media-position" aria-live="polite">{galleryMedia.findIndex((item) => item.id === activeMedia.id) + 1} / {galleryMedia.length}</span>}
    </div>
    {galleryMedia.length > 1 && <div className="booking-media-thumbnails" role="group" aria-label={t('Choose a gallery image', 'Chọn ảnh trong thư viện')}>
      {galleryMedia.slice(0, 5).map((item, index) => <button className={`booking-media-thumbnail${item.id === activeMedia.id ? ' booking-media-thumbnail-selected' : ''}`} type="button" key={item.id} aria-pressed={item.id === activeMedia.id} onClick={() => setActiveMediaId(item.id)}>
        <ResilientImage src={item.url} fallbackSrc={fallbackImageFor(`${workspaceName}-${index}`)} width={item.width} height={item.height} alt={t(`View image ${index + 1}`, `Xem ảnh ${index + 1}`)} />
      </button>)}
    </div>}
  </section>;
}
