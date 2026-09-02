import { useEffect, useRef, useState, type JSX } from 'react';
import type { AuthenticationResponse, BookingSummary, SlotHold, WorkspaceDetailResponse } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { formatVnd } from '../../discovery/format-vnd';
import { cancelBooking, confirmHold, createHold, getMyBookings, getMyHolds, getWorkspaceDetail } from '../api/booking-api';
import { activeCheckoutHolds } from '../booking-session-state';
import { logout, refreshSession } from '../../auth/api/auth-api';
import { formatSalonLocalDate, formatSalonTimeRange } from '../../../shared/date/format-salon-time';

interface WorkspaceBookingPageProps { workspaceId: string; date: string; onBack: () => void; onSignIn: () => void; onSessionRestored: (session: AuthenticationResponse) => void; onSessionEnded: () => void; }

export function WorkspaceBookingPage({ workspaceId, date, onBack, onSignIn, onSessionRestored, onSessionEnded }: WorkspaceBookingPageProps): JSX.Element {
  const [detail, setDetail] = useState<WorkspaceDetailResponse | null>(null);
  const [auth, setAuth] = useState<AuthenticationResponse | null>(null);
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
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { void loadDetail(); }, [workspaceId, date]);
  useEffect(() => { void restore(); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (auth) void loadPersonalState(auth.accessToken); }, [auth]);

  const activeHolds = activeCheckoutHolds(holds, new Date(now));

  async function loadDetail(): Promise<void> {
    setIsLoading(true); setError(null);
    try { setDetail(await getWorkspaceDetail(workspaceId, date)); setSelectedSlotId(null); }
    catch (reason) { setDetail(null); setError(messageFor(reason)); }
    finally { setIsLoading(false); }
  }

  async function restore(): Promise<void> {
    try { const session = await refreshSessionOnce(); setAuth(session); onSessionRestored(session); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(messageFor(reason)); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function loadPersonalState(token: string): Promise<void> {
    try {
      const [holds, mine] = await Promise.all([getMyHolds(token), getMyBookings(token)]);
      setHolds(activeCheckoutHolds(holds.holds, new Date())); setBookings(mine.bookings);
    } catch (reason) { setError(messageFor(reason)); }
  }

  async function takeHold(slotId: string): Promise<void> {
    if (!auth) { onSignIn(); return; }
    setIsActioning(true); setError(null); setMessage(null);
    const attempt = holdAttempt.current?.slotId === slotId ? holdAttempt.current : { slotId, key: crypto.randomUUID() };
    holdAttempt.current = attempt;
    try {
      const response = await createHold(auth.accessToken, slotId, attempt.key);
      setHolds((current) => activeCheckoutHolds([...current.filter((hold) => hold.id !== response.hold.id), response.hold], new Date())); holdAttempt.current = null;
      setSelectedSlotId(null);
      setMessage('Your selected time is reserved for 10 minutes. Confirm before it expires.');
      await loadDetail();
    } catch (reason) { setError(messageFor(reason)); }
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
      setMessage('Workspace reserved successfully. Your booking is confirmed.');
      await loadDetail();
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsActioning(false); }
  }

  async function cancel(bookingId: string): Promise<void> {
    if (!auth) return;
    setIsActioning(true); setError(null); setMessage(null);
    try {
      const response = await cancelBooking(auth.accessToken, bookingId, crypto.randomUUID());
      setBookings((current) => current.map((booking) => booking.id === bookingId ? response.booking : booking));
      setMessage('Your booking was cancelled and the time was released.');
      await loadDetail();
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsActioning(false); }
  }

  async function signOut(): Promise<void> { try { await logout(); } finally { setAuth(null); setHolds([]); setBookings([]); onSessionEnded(); } }

  const title = detail ? detail.workspaceName : 'Workspace';
  const selectedSlot = detail?.slots.find((slot) => slot.id === selectedSlotId) ?? null;
  return <main className="page-shell booking-shell">
    <button className="text-button" type="button" onClick={onBack}>← Back to search results</button>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {isLoading ? <p className="notice">Loading available times…</p> : detail && <>
      <header><p className="eyebrow">{detail.area} · {detail.timezone}</p><h1>{title}</h1><p className="lead">{detail.salonName} · {formatSalonLocalDate(date)}</p></header>
      {detail.media.length > 0 && <section className="booking-gallery" aria-label={`${title} gallery`}>{detail.media.slice(0, 5).map((media, index) => <img className={index === 0 ? 'booking-gallery-main' : 'booking-gallery-item'} key={media.id} src={media.url} width={media.width} height={media.height} alt={index === 0 ? `${title} at ${detail.salonName}` : `${title} space ${index + 1}`} />)}</section>}
      <section className="booking-layout"><div className="booking-context"><p className="eyebrow">LIVE AVAILABILITY · {formatSalonLocalDate(date)}</p><h2>Choose a time that works for you.</h2><p className="lead">Times are shown in the salon’s local timezone. Select a time to review it, then reserve it for 10 minutes while you confirm.</p></div><section className="booking-panel availability-panel"><div className="availability-panel-heading"><div><p className="eyebrow">STEP 1 OF 2</p><h2>Select an available time</h2></div><span className="availability-count">{detail.slots.length} available</span></div><div className="public-slot-list">{detail.slots.map((slot) => <button key={slot.id} className={`public-slot ${selectedSlotId === slot.id ? 'public-slot-selected' : ''}`} type="button" disabled={isActioning || activeHolds.length > 0} aria-pressed={selectedSlotId === slot.id} onClick={() => setSelectedSlotId(slot.id)}><span className="slot-status">Available</span><strong>{formatSalonTimeRange(slot.startsAt, slot.endsAt, detail.timezone)}</strong><small>{slot.rentalOptionLabel} · {formatVnd(slot.priceCents)}</small></button>)}</div>
        {detail.slots.length === 0 && <p className="notice">No times are currently available for this date.</p>}
        <div className="selected-slot-summary" aria-live="polite">{selectedSlot ? <><div><span>Selected time</span><strong>{formatSalonTimeRange(selectedSlot.startsAt, selectedSlot.endsAt, detail.timezone)}</strong><small>{selectedSlot.rentalOptionLabel} · {formatVnd(selectedSlot.priceCents)}</small></div><button type="button" disabled={isActioning || activeHolds.length > 0} onClick={() => void takeHold(selectedSlot.id)}>{isActioning ? 'Reserving…' : 'Reserve selected time'}</button></> : <p>Select a time to continue.</p>}</div>
      </section></section>
    </>}
    {!auth ? <section className="booking-panel"><p className="eyebrow">STEP 2 OF 2</p><h2>Sign in to reserve a time</h2><p className="lead">Your selected time can only be held after you sign in.</p><button type="button" onClick={onSignIn}>Sign in to continue</button></section> : <>
      {activeHolds.map((hold) => {
        const secondsLeft = Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - now) / 1_000));
        const holdExpired = secondsLeft === 0;
        const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
        return <section className="booking-panel hold-panel" key={hold.id}><p className="eyebrow">RESERVATION IN PROGRESS</p><h2>{hold.workspaceName}</h2><p>{formatSalonTimeRange(hold.startsAt, hold.endsAt, hold.timezone)} · {formatVnd(hold.priceCents)}</p><strong className={holdExpired ? 'expired' : ''}>{holdExpired ? 'Reservation expired' : `${countdown} remaining`}</strong><button type="button" disabled={isActioning || holdExpired} onClick={() => void confirm(hold)}>{isActioning ? 'Confirming…' : 'Confirm booking'}</button></section>;
      })}
      <section className="booking-panel"><div className="section-heading"><div><p className="eyebrow">MY BOOKINGS</p><h2>Recent bookings</h2></div><button className="text-button" type="button" onClick={() => void signOut()}>Sign out</button></div>
        {bookings.length === 0 ? <p className="lead">You do not have any bookings yet.</p> : <ul className="booking-list">{bookings.map((booking) => <li key={booking.id}><strong>{booking.workspaceName}</strong><span>{formatSalonTimeRange(booking.startsAt, booking.endsAt, booking.salonTimezone)}</span><small>{formatSalonLocalDate(booking.localDate)} · {booking.salonTimezone} · {booking.status} · {formatVnd(booking.priceCents)}</small>{booking.status === 'CONFIRMED' && <button className="danger-button" type="button" disabled={isActioning} onClick={() => void cancel(booking.id)}>Cancel booking</button>}</li>)}</ul>}
      </section>
    </>}
  </main>;
}

function messageFor(reason: unknown): string { return reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'; }
