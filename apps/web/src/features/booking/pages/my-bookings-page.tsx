import { useEffect, useRef, useState, type JSX } from 'react';
import type { AuthenticationResponse, BookingSummary } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { formatVnd } from '../../discovery/format-vnd';
import { cancelBooking, getMyBookings } from '../api/booking-api';
import { logout, refreshSession } from '../../auth/api/auth-api';
import { formatSalonLocalDate, formatSalonTimeRange } from '../../../shared/date/format-salon-time';

type BookingTab = 'upcoming' | 'past' | 'cancelled';

interface MyBookingsPageProps {
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function MyBookingsPage({ onSignIn, onSessionRestored, onSessionEnded }: MyBookingsPageProps): JSX.Element {
  const [auth, setAuth] = useState<AuthenticationResponse | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [tab, setTab] = useState<BookingTab>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { void restore(); }, []);
  useEffect(() => { if (auth) void loadBookings(auth.accessToken); }, [auth]);

  async function restore(): Promise<void> {
    try { const session = await refreshSessionOnce(); setAuth(session); onSessionRestored(session); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(messageFor(reason)); }
    finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function loadBookings(accessToken: string): Promise<void> {
    setIsLoading(true);
    try { setBookings((await getMyBookings(accessToken)).bookings); }
    catch (reason) { setError(messageFor(reason)); }
    finally { setIsLoading(false); }
  }

  async function cancel(bookingId: string): Promise<void> {
    if (!auth) return;
    setIsActioning(true); setError(null);
    try {
      const response = await cancelBooking(auth.accessToken, bookingId, crypto.randomUUID());
      setBookings((current) => current.map((booking) => booking.id === bookingId ? response.booking : booking));
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsActioning(false); }
  }

  const visible = bookings.filter((booking) => matchesTab(booking, tab));
  return <main className="page-shell bookings-shell">
    <header className="page-heading"><div><p className="eyebrow">MY BOOKINGS</p><h1>Manage your workspace time</h1><p className="lead">Review upcoming sessions, check their status, and cancel within the permitted window.</p></div></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {isLoading && !auth ? <p className="notice" role="status">Restoring your session…</p> : !auth ? <section className="auth-card"><div><p className="eyebrow">MY BOOKINGS</p><h2>Sign in to view your bookings</h2></div><p className="lead">Use your account to review booking status and manage permitted cancellations.</p><button type="button" onClick={onSignIn}>Sign in to continue</button></section> : <>
      <div className="booking-tabs" role="tablist" aria-label="Filter bookings"><button type="button" className={tab === 'upcoming' ? 'tab-active' : ''} onClick={() => setTab('upcoming')}>Upcoming</button><button type="button" className={tab === 'past' ? 'tab-active' : ''} onClick={() => setTab('past')}>Past</button><button type="button" className={tab === 'cancelled' ? 'tab-active' : ''} onClick={() => setTab('cancelled')}>Cancelled</button><button className="text-button sign-out" type="button" onClick={() => void logout().finally(() => { setAuth(null); setBookings([]); onSessionEnded(); })}>Sign out</button></div>
      {isLoading ? <p className="notice">Loading your bookings…</p> : visible.length === 0 ? <p className="notice">There are no bookings in this view.</p> : <section className="booking-card-grid">{visible.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-card-image" aria-hidden="true"><span className={`booking-status booking-status-${booking.status.toLowerCase()}`}>{labelFor(booking.status)}</span></div><div className="booking-card-body"><h2>{booking.workspaceName}</h2><p>{formatSalonLocalDate(booking.localDate)} · {formatSalonTimeRange(booking.startsAt, booking.endsAt, booking.salonTimezone)}</p><small className="booking-timezone">{booking.salonTimezone}</small><div className="booking-time"><strong>{booking.rentalOptionLabel}</strong><span>{formatVnd(booking.priceCents)}</span></div>{booking.status === 'CONFIRMED' && <button className="danger-button" type="button" disabled={isActioning} onClick={() => void cancel(booking.id)}>Cancel booking</button>}</div></article>)}</section>}
    </>}
  </main>;
}

function matchesTab(booking: BookingSummary, tab: BookingTab): boolean {
  if (tab === 'cancelled') return booking.status === 'CANCELLED';
  if (tab === 'past') return booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && new Date(booking.endsAt) < new Date());
  return booking.status === 'CONFIRMED' && new Date(booking.endsAt) >= new Date();
}

function labelFor(status: BookingSummary['status']): string { return status === 'CONFIRMED' ? 'Confirmed' : status === 'CANCELLED' ? 'Cancelled' : 'Completed'; }
function messageFor(reason: unknown): string { return reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'; }
