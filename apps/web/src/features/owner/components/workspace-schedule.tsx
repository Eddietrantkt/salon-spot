import { useState, type JSX } from 'react';
import {
  FIXED_SLOT_PERIODS,
  type FixedSlotPeriod,
  type OpenWorkspaceSlotsInput,
  type OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { tomorrowInLocalCalendar } from '../../../shared/date/local-date';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface WorkspaceScheduleProps {
  isLoading: boolean;
  isPublished: boolean;
  onLoadSchedule: (localDate: string) => Promise<OwnerWorkspaceScheduleResponse>;
  onOpenSlots: (input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
  onBlockSlots: (input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
}

export function WorkspaceSchedule({
  isLoading,
  isPublished,
  onLoadSchedule,
  onOpenSlots,
  onBlockSlots
}: WorkspaceScheduleProps): JSX.Element {
  const { t } = useI18n();
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
    catch (reason) { setReadError(reason instanceof Error ? reason.message : t('We could not load this schedule.', 'Không thể tải lịch này.')); }
    finally { setIsReading(false); }
  }

  async function change(action: 'open' | 'block'): Promise<void> {
    setReadError(null);
    try {
      const input = { localDate, periods };
      const result = action === 'open' ? await onOpenSlots(input) : await onBlockSlots(input);
      setSchedule(result);
    } catch (reason) {
      setReadError(reason instanceof Error ? reason.message : t('We could not update this schedule.', 'Không thể cập nhật lịch này.'));
    }
  }

  if (!isPublished) return <small className="schedule-hint">{t('Publish this workspace before opening its availability.', 'Hãy công bố không gian này trước khi mở lịch trống.')}</small>;

  const slotsByPeriod = new Map(schedule?.localDate === localDate ? schedule.slots.map((slot) => [slot.period, slot]) : []);
  const slotCounts = schedule?.localDate === localDate ? schedule.slots.reduce<Record<string, number>>((counts, slot) => ({ ...counts, [slot.status]: (counts[slot.status] ?? 0) + 1 }), {}) : null;

  return (
    <section className="workspace-schedule" aria-label={t('Manage rental availability', 'Quản lý lịch thuê còn trống')}>
      <strong>{t('Fixed availability', 'Lịch trống cố định')}</strong>
      <label>{t('Rental date', 'Ngày thuê')}
        <input
          type="date"
          min={tomorrowInLocalCalendar()}
          value={localDate}
          onChange={(event) => { setLocalDate(event.target.value); setSchedule(null); setReadError(null); }}
          required
        />
      </label>
      <div className="slot-picker" role="group" aria-label={t('Choose fixed time slots', 'Chọn các khung giờ cố định')}>
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
              <small>{slot ? statusLabel(slot.status, t) : t('Not created', 'Chưa tạo')}</small>
            </button>
          );
        })}
      </div>
      {slotCounts && <div className="schedule-summary" role="status"><span><strong>{slotCounts.OPEN ?? 0}</strong> {t('open', 'đang mở')}</span><span><strong>{slotCounts.BLOCKED ?? 0}</strong> {t('blocked', 'đã chặn')}</span><span><strong>{slotCounts.HELD ?? 0}</strong> {t('reserved', 'đang giữ')}</span><span><strong>{slotCounts.BOOKED ?? 0}</strong> {t('booked', 'đã đặt')}</span></div>}
      <div className="schedule-actions">
        <button className="secondary-button" type="button" disabled={isLoading || isReading} onClick={() => void loadSchedule()}>
          {isReading ? t('Loading…', 'Đang tải…') : t('View status', 'Xem trạng thái')}
        </button>
        <button type="button" disabled={isLoading || periods.length === 0} onClick={() => void change('open')}>
          {t('Open', 'Mở')} {periods.length} {t(periods.length === 1 ? 'slot' : 'slots', 'khung giờ')}
        </button>
        <button className="danger-button" type="button" disabled={isLoading || periods.length === 0} onClick={() => void change('block')}>
          {t('Block', 'Chặn')} {periods.length} {t(periods.length === 1 ? 'slot' : 'slots', 'khung giờ')}
        </button>
      </div>
      {readError && <small className="schedule-error" role="alert">{readError}</small>}
      <small>{t('The entire batch is rejected if a selected time is reserved or booked. Cancel bookings through the booking flow.', 'Toàn bộ thao tác sẽ bị từ chối nếu một khung giờ đã được giữ hoặc đặt. Hãy hủy lịch qua luồng đặt chỗ.')}</small>
    </section>
  );
}

function statusLabel(status: string, t: (english: string, vietnamese: string) => string): string {
  if (status === 'OPEN') return t('Open', 'Đang mở');
  if (status === 'BLOCKED') return t('Blocked', 'Đã chặn');
  if (status === 'HELD') return t('Reserved', 'Đang giữ');
  if (status === 'BOOKED') return t('Booked', 'Đã đặt');
  return status;
}
