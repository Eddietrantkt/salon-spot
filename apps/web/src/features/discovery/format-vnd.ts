export function formatVnd(cents: number | null): string {
  if (cents === null) return 'Price on request';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(cents);
}
