import { useRef, type ChangeEvent, type JSX } from 'react';
import type { OwnerMedia } from '@salon-spot/contracts';

interface MediaManagerProps {
  title: string;
  media: OwnerMedia[];
  isLoading: boolean;
  onUpload: (file: File) => Promise<void>;
  onSetCover: (mediaId: string | null) => Promise<void>;
  onReorder: (mediaIds: string[]) => Promise<void>;
  onDelete: (mediaId: string) => Promise<void>;
}

export function MediaManager({ title, media, isLoading, onUpload, onSetCover, onReorder, onDelete }: MediaManagerProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const ready = media.filter((item) => item.status === 'READY');
  const activeCount = media.filter((item) => item.status !== 'REJECTED' && item.status !== 'DELETED').length;

  async function selectFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await onUpload(file);
  }

  async function move(mediaId: string, offset: -1 | 1): Promise<void> {
    const index = ready.findIndex((item) => item.id === mediaId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= ready.length) return;
    const ids = ready.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await onReorder(ids);
  }

  return (
    <section className="media-manager">
      <div className="media-heading">
        <strong>{title}</strong><span>{ready.length}/10 ready</span>
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectFile(event)} />
        <button className="secondary-button" disabled={isLoading || activeCount >= 10} type="button" onClick={() => input.current?.click()}>Add photo</button>
      </div>
      {media.length === 0 ? <small>No photos yet. A cover image is optional.</small> : (
        <ul className="media-grid">
          {media.map((item, index) => (
            <li key={item.id}>
              {item.url ? <img src={item.url} alt={`${title} ${index + 1}`} /> : <div className="media-placeholder">{item.status}</div>}
              <div className="media-meta"><span>{item.isCover ? 'COVER' : item.status}</span>{item.failureReason && <small>{item.failureReason}</small>}</div>
              <div className="media-actions">
                {item.status === 'READY' && <button disabled={isLoading || item.isCover} type="button" onClick={() => void onSetCover(item.id)}>Set cover</button>}
                {item.status === 'READY' && <button disabled={isLoading || ready.findIndex((readyItem) => readyItem.id === item.id) === 0} type="button" onClick={() => void move(item.id, -1)}>↑</button>}
                {item.status === 'READY' && <button disabled={isLoading || ready.findIndex((readyItem) => readyItem.id === item.id) === ready.length - 1} type="button" onClick={() => void move(item.id, 1)}>↓</button>}
                <button className="danger-button" disabled={isLoading} type="button" onClick={() => void onDelete(item.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ready.some((item) => item.isCover) && <button className="text-button" disabled={isLoading} type="button" onClick={() => void onSetCover(null)}>Remove cover</button>}
    </section>
  );
}
