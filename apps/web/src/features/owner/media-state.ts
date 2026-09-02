import type { OwnerMedia } from '@salon-spot/contracts';

export function mergeMedia(current: OwnerMedia[], updated: OwnerMedia[]): OwnerMedia[] {
  const updatedById = new Map(updated.map((media) => [media.id, media]));
  return current
    .map((media) => ({ ...media, ...updatedById.get(media.id) }))
    .filter((media) => media.status !== 'DELETE_PENDING' && media.status !== 'DELETED');
}
