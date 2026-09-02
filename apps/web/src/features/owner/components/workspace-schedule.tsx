import { useState, type JSX } from 'react';
import {
  FIXED_SLOT_PERIODS,
  type FixedSlotPeriod,
  type OpenWorkspaceSlotsInput,
  type OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';

interface WorkspaceScheduleProps {
  isLoading: boolean;
  isPublished: boolean;
  onLoadSchedule: (localDate: string) => Promise<OwnerWorkspaceScheduleResponse>;
  onOpenSlots: (input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
  onBlockSlots: (input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
}

const statusLabel: Record<string, string> = {
  OPEN: 'Open',
  BLOCKED: 'Blocked',
  HELD: 'Reserved',
  BOOKED: 'Booked'
};

export function WorkspaceSchedule({
  isLoading,
  isPublished,
  onLoadSchedule,
  onOpenSlots,
  onBlockSlots
}: WorkspaceScheduleProps): JSX.Element {
  const [localDate, setLocalDate] = useState(tomorrowInLocalCalendar);
  const [periods, setPeriods] = useState<FixedSlotPeriod[]>([FIXED_SLOT_PERIODS[0]]);
  const [schedule, setSchedule] = useState<OwnerWorkspaceScheduleResponse | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  function toggle(period: FixedSlotPeriod): void {
    setPeriods((current) => current.includes(period) ? current.filter((item) => item !== period) : [...current, period]);
  }

  async function loadSchedule(): Promise<void> {
    setIsReading(true);
    setReadError(null);
    try { setSchedule(await onLoadSchedule(localDate)); }
    catch (reason) { setReadError(reason instanceof Error ? reason.message : 'We could not load this schedule.'); }
    finally { setIsReading(false); }
  }

  async function change(action: 'open' | 'block'): Promise<void> {
    setReadError(null);
    try {
      const input = { localDate, periods };
      const result = action === 'open' ? await onOpenSlots(input) : await onBlockSlots(input);
      setSchedule(result);
    } catch (reason) {
      setReadError(reason instanceof Error ? reason.message : 'We could not update this schedule.');
    }
  }

  if (!isPublished) return <small className="schedule-hint">Publish this workspace before opening its availability.</small>;

  const slotsByPeriod = new Map(schedule?.localDate === localDate ? schedule.slots.map((slot) => [slot.period, slot]) : []);
  const slotCounts = schedule?.localDate === localDate ? schedule.slots.reduce<Record<string, number>>((counts, slot) => ({ ...counts, [slot.status]: (counts[slot.status] ?? 0) + 1 }), {}) : null;

  return (
    <section className="workspace-schedule" aria-label="Manage rental availability">
      <strong>Fixed availability</strong>
      <label>Rental date
        <input
          type="date"
          min={tomorrowInLocalCalendar()}
          value={localDate}
          onChange={(event) => { setLocalDate(event.target.value); setSchedule(null); setReadError(null); }}
          required
        />
      </label>
      <div className="slot-picker" role="group" aria-label="Choose fixed time slots">
        {FIXED_SLOT_PERIODS.map((period) => {
          const slot = slotsByPeriod.get(period);
          return (
            <button
              key={period}
              className={periods.includes(period) ? 'slot-selected' : 'secondary-button'}
              type="button"
              aria-pressed={periods.includes(period)}
              onClick={() => toggle(period)}
            >
              <span>{period}</span>
              <small>{slot ? statusLabel[slot.status] : 'Not created'}</small>
            </button>
          );
        })}
      </div>
      {slotCounts && <div className="schedule-summary" role="status"><span><strong>{slotCounts.OPEN ?? 0}</strong> open</span><span><strong>{slotCounts.BLOCKED ?? 0}</strong> blocked</span><span><strong>{slotCounts.HELD ?? 0}</strong> reserved</span><span><strong>{slotCounts.BOOKED ?? 0}</strong> booked</span></div>}
      <div className="schedule-actions">
        <button className="secondary-button" type="button" disabled={isLoading || isReading} onClick={() => void loadSchedule()}>
          {isReading ? 'Loading…' : 'View status'}
        </button>
        <button type="button" disabled={isLoading || periods.length === 0} onClick={() => void change('open')}>
          Open {periods.length} {periods.length === 1 ? 'slot' : 'slots'}
        </button>
        <button className="danger-button" type="button" disabled={isLoading || periods.length === 0} onClick={() => void change('block')}>
          Block {periods.length} {periods.length === 1 ? 'slot' : 'slots'}
        </button>
      </div>
      {readError && <small className="schedule-error" role="alert">{readError}</small>}
      <small>The entire batch is rejected if a selected time is reserved or booked. Cancel bookings through the booking flow.</small>
    </section>
  );
}
