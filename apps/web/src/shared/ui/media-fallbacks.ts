const fallbackImages = {
  station: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1600&q=85',
  studio: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=85',
  craft: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1600&q=85'
} as const;

/** Demo-safe imagery keeps public cards useful when hosted media storage is unavailable. */
export function fallbackImageFor(label: string): string {
  const normalized = label.toLocaleLowerCase();
  if (normalized.includes('private') || normalized.includes('studio')) return fallbackImages.studio;
  if (normalized.includes('beauty') || normalized.includes('corner') || normalized.includes('makeup')) return fallbackImages.craft;
  return fallbackImages.station;
}
