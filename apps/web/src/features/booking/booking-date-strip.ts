/** Returns a contiguous, local-calendar date range without UTC date shifting. */
export function bookingDateRange(startDate: string, count = 7): string[] {
  const start = new Date(`${startDate}T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}
