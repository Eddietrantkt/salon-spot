export function formatVnd(cents: number | null, locale = 'en'): string {
  if (cents === null) return 'Price on request';
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(cents);
}
