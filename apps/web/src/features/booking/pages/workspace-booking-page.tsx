import { useEffect, useRef, useState, type JSX } from 'react';
import type { AuthenticationResponse, BookingSummary, SlotHold, WorkspaceDetailResponse } from '@salon-spot/contracts';
import { formatVnd } from '../../discovery/format-vnd';
import { cancelBooking, confirmHold, createHold, getMyBookings, getMyHolds, getWorkspaceDetail } from '../api/booking-api';
import { activeCheckoutHolds } from '../booking-session-state';
import { logout } from '../../auth/api/auth-api';
import { formatSalonLocalDate, formatSalonTimeRange } from '../../../shared/date/format-salon-time';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { SalonReviewsPanel } from '../../reviews/components/salon-reviews-panel';
import { BookingDateStrip } from '../components/booking-date-strip';
import { WorkspaceMediaGallery } from '../components/workspace-media-gallery';

interface WorkspaceBookingPageProps { workspaceId: string; date: string; initialSession: AuthenticationResponse | null; sessionResolved: boolean; onBack: () => void; onDateChange: (date: string) => void; onSignIn: () => void; onSessionRestored: (session: AuthenticationResponse) => void; onSessionEnded: () => void; }

export function WorkspaceBookingPage({ workspaceId, date, initialSession, sessionResolved, onBack, onDateChange, onSignIn, onSessionEnded }: WorkspaceBookingPageProps): JSX.Element {
  const { locale, t } = useI18n();
  const intlLocale = locale === 'vi' ? 'vi-VN' : 'en-GB';
  const [detail, setDetail] = useState<WorkspaceDetailResponse | null>(null);
  const [auth, setAuth] = useState<AuthenticationResponse | null>(initialSession);
  const [holds, setHolds] = useState<SlotHold[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const holdAttempt = useRef<{ slotId: string; key: string } | null>(null);
  const confirmKeys = useRef(new Map<string, string>());

  useEffect(() => { void loadDetail(); }, [workspaceId, date]);
  useEffect(() => { if (sessionResolved) setAuth(initialSession); }, [initialSession, sessionResolved]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (auth?.capabilities.professionalStatus === 'ACTIVE') void loadPersonalState(auth.accessToken); }, [auth]);

  const activeHolds = activeCheckoutHolds(holds, new Date(now));

  async function loadDetail(): Promise<void> {
    setIsLoading(true); setError(null);
    try { setDetail(await getWorkspaceDetail(workspaceId, date)); setSelectedSlotId(null); }
    catch (reason) { setDetail(null); setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function loadPersonalState(token: string): Promise<void> {
    try {
      const [holds, mine] = await Promise.all([getMyHolds(token), getMyBookings(token)]);
      setHolds(activeCheckoutHolds(holds.holds, new Date())); setBookings(mine.bookings);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
  }

  async function takeHold(slotId: string): Promise<void> {
    if (!auth) { onSignIn(); return; }
    if (auth.capabilities.professionalStatus !== 'ACTIVE') {
      setError(t('Only an active Professional account can reserve a workspace.', 'Chỉ tài khoản Chuyên viên đang hoạt động mới có thể đặt không gian.'));
      return;
    }
    setIsActioning(true); setError(null); setMessage(null);
    const attempt = holdAttempt.current?.slotId === slotId ? holdAttempt.current : { slotId, key: crypto.randomUUID() };
    holdAttempt.current = attempt;
    try {
      const response = await createHold(auth.accessToken, slotId, attempt.key);
      setHolds((current) => activeCheckoutHolds([...current.filter((hold) => hold.id !== response.hold.id), response.hold], new Date())); holdAttempt.current = null;
      setSelectedSlotId(null);
      setMessage(t('Your selected time is reserved for 10 minutes. Confirm before it expires.', 'Khung giờ đã chọn được giữ trong 10 phút. Hãy xác nhận trước khi hết hạn.'));
      await loadDetail();
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsActioning(false); }
  }

  async function confirm(hold: SlotHold): Promise<void> {
    if (!auth || new Date(hold.expiresAt) <= new Date()) return;
    setIsActioning(true); setError(null); setMessage(null);
    const confirmKey = confirmKeys.current.get(hold.id) ?? crypto.randomUUID();
    confirmKeys.current.set(hold.id, confirmKey);
    try {
      const response = await confirmHold(auth.accessToken, hold.id, confirmKey);
      setBookings((current) => [response.booking, ...current.filter((booking) => booking.id !== response.booking.id)]);
      setHolds((current) => current.filter((item) => item.id !== hold.id)); confirmKeys.current.delete(hold.id);
      setMessage(t('Workspace reserved successfully. Your booking is confirmed.', 'Đặt không gian thành công. Lịch đặt của bạn đã được xác nhận.'));
      await loadDetail();
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsActioning(false); }
  }

  async function cancel(bookingId: string): Promise<void> {
    if (!auth) return;
    setIsActioning(true); setError(null); setMessage(null);
    try {
      const response = await cancelBooking(auth.accessToken, bookingId, crypto.randomUUID());
      setBookings((current) => current.map((booking) => booking.id === bookingId ? response.booking : booking));
      setMessage(t('Your booking was cancelled and the time was released.', 'Lịch đặt đã được hủy và khung giờ đã được mở lại.'));
      await loadDetail();
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsActioning(false); }
  }

  async function signOut(): Promise<void> { try { await logout(); } finally { setAuth(null); setHolds([]); setBookings([]); onSessionEnded(); } }

  const title = detail ? detail.workspaceName : t('Workspace', 'Không gian');
  const selectedSlot = detail?.slots.find((slot) => slot.id === selectedSlotId) ?? null;
  return <main className="page-shell booking-shell">
    <button className="text-button" type="button" onClick={onBack}>← {t('Back to search results', 'Quay lại kết quả tìm kiếm')}</button>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {isLoading ? <p className="notice">{t('Loading available times…', 'Đang tải giờ còn trống…')}</p> : detail && <>
      <header><p className="eyebrow">{detail.area} · {detail.timezone}</p><h1>{title}</h1><p className="lead">{detail.salonName} · {formatSalonLocalDate(date, intlLocale)}</p></header>
      <WorkspaceMediaGallery media={detail.media} workspaceName={title} salonName={detail.salonName} />
      <section className="booking-layout"><div className="booking-context"><p className="eyebrow">{t('LIVE AVAILABILITY', 'LỊCH TRỐNG TRỰC TIẾP')} · {formatSalonLocalDate(date, intlLocale)}</p><h2>{t('Choose a time that works for you.', 'Chọn khung giờ phù hợp với bạn.')}</h2><p className="lead">{t('Times are shown in the salon’s local timezone. Select a time to review it, then reserve it for 10 minutes while you confirm.', 'Khung giờ được hiển thị theo múi giờ địa phương của salon. Chọn một khung giờ để xem lại, sau đó giữ chỗ trong 10 phút khi bạn xác nhận.')}</p><BookingDateStrip date={date} isLoading={isLoading || isActioning} onDateChange={onDateChange} /></div><section className="booking-panel availability-panel"><div className="availability-panel-heading"><div><p className="eyebrow">{t('STEP 1 OF 2', 'BƯỚC 1/2')}</p><h2>{t('Select an available time', 'Chọn khung giờ còn trống')}</h2></div><span className="availability-count">{detail.slots.length} {t('available', 'còn trống')}</span></div><div className="public-slot-list">{detail.slots.map((slot) => <button key={slot.id} className={`public-slot ${selectedSlotId === slot.id ? 'public-slot-selected' : ''}`} type="button" disabled={isActioning || activeHolds.length > 0} aria-pressed={selectedSlotId === slot.id} onClick={() => setSelectedSlotId(slot.id)}><span className="slot-status">{t('Available', 'Còn trống')}</span><strong>{formatSalonTimeRange(slot.startsAt, slot.endsAt, detail.timezone, intlLocale)}</strong><small>{slot.rentalOptionLabel} · {formatVnd(slot.priceCents, locale)}</small></button>)}</div>
        {detail.slots.length === 0 && <p className="notice">{t('No times are currently available for this date.', 'Hiện không còn khung giờ trống nào trong ngày này.')}</p>}
        <div className={`selected-slot-summary${selectedSlot ? ' selected-slot-summary-active' : ''}`} aria-live="polite">{selectedSlot ? <><div><span>{t('Selected time', 'Khung giờ đã chọn')}</span><strong>{formatSalonTimeRange(selectedSlot.startsAt, selectedSlot.endsAt, detail.timezone, intlLocale)}</strong><small>{selectedSlot.rentalOptionLabel} · {formatVnd(selectedSlot.priceCents, locale)}</small></div><button type="button" disabled={isActioning || activeHolds.length > 0 || Boolean(auth && auth.capabilities.professionalStatus !== 'ACTIVE')} onClick={() => void takeHold(selectedSlot.id)}>{isActioning ? t('Reserving…', 'Đang giữ chỗ…') : t('Reserve selected time', 'Giữ khung giờ đã chọn')}</button></> : <p>{t('Select a time to continue.', 'Chọn một khung giờ để tiếp tục.')}</p>}</div>
      </section></section>
      <SalonReviewsPanel salonId={detail.salonId} />
    </>}
    {!auth ? <section className="booking-panel"><p className="eyebrow">{t('STEP 2 OF 2', 'BƯỚC 2/2')}</p><h2>{t('Sign in to reserve a time', 'Đăng nhập để giữ khung giờ')}</h2><p className="lead">{t('Your selected time can only be held after you sign in.', 'Khung giờ đã chọn chỉ có thể được giữ sau khi bạn đăng nhập.')}</p><button type="button" onClick={onSignIn}>{t('Sign in to continue', 'Đăng nhập để tiếp tục')}</button></section> : auth.capabilities.professionalStatus !== 'ACTIVE' ? <section className="booking-panel"><p className="eyebrow">{t('PROFESSIONAL ACCESS', 'QUYỀN CHUYÊN VIÊN')}</p><h2>{t('An active Professional account is required', 'Cần tài khoản Chuyên viên đang hoạt động')}</h2><p className="lead">{t('This signed-in account can explore the workspace, but it cannot hold or book a time.', 'Tài khoản đang đăng nhập có thể khám phá không gian nhưng không thể giữ hoặc đặt khung giờ.')}</p></section> : <>
      {activeHolds.map((hold) => {
        const secondsLeft = Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - now) / 1_000));
        const holdExpired = secondsLeft === 0;
        const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
        return <section className="booking-panel hold-panel" key={hold.id}><p className="eyebrow">{t('RESERVATION IN PROGRESS', 'ĐANG GIỮ CHỖ')}</p><h2>{hold.workspaceName}</h2><p>{formatSalonTimeRange(hold.startsAt, hold.endsAt, hold.timezone, intlLocale)} · {formatVnd(hold.priceCents, locale)}</p><strong className={holdExpired ? 'expired' : ''}>{holdExpired ? t('Reservation expired', 'Giữ chỗ đã hết hạn') : `${countdown} ${t('remaining', 'còn lại')}`}</strong><button type="button" disabled={isActioning || holdExpired} onClick={() => void confirm(hold)}>{isActioning ? t('Confirming…', 'Đang xác nhận…') : t('Confirm booking', 'Xác nhận lịch đặt')}</button></section>;
      })}
      <section className="booking-panel"><div className="section-heading"><div><p className="eyebrow">{t('MY BOOKINGS', 'LỊCH ĐẶT CỦA TÔI')}</p><h2>{t('Recent bookings', 'Lịch đặt gần đây')}</h2></div><button className="text-button" type="button" onClick={() => void signOut()}>{t('Sign out', 'Đăng xuất')}</button></div>
        {bookings.length === 0 ? <p className="lead">{t('You do not have any bookings yet.', 'Bạn chưa có lịch đặt nào.')}</p> : <ul className="booking-list">{bookings.map((booking) => <li key={booking.id}><strong>{booking.workspaceName}</strong><span>{formatSalonTimeRange(booking.startsAt, booking.endsAt, booking.salonTimezone, intlLocale)}</span><small>{formatSalonLocalDate(booking.localDate, intlLocale)} · {booking.salonTimezone} · {booking.status} · {formatVnd(booking.priceCents, locale)}</small>{booking.status === 'CONFIRMED' && <button className="danger-button" type="button" disabled={isActioning} onClick={() => void cancel(booking.id)}>{t('Cancel booking', 'Hủy lịch đặt')}</button>}</li>)}</ul>}
      </section>
    </>}
  </main>;
}
