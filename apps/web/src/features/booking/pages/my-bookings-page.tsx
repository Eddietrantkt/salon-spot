import { useEffect, useRef, useState, type JSX } from 'react';
import type { AuthenticationResponse, BookingSummary } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { formatVnd } from '../../discovery/format-vnd';
import { cancelBooking, getMyBookings } from '../api/booking-api';
import { logout, refreshSession } from '../../auth/api/auth-api';
import { formatSalonLocalDate, formatSalonTimeRange } from '../../../shared/date/format-salon-time';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

type BookingTab = 'upcoming' | 'past' | 'cancelled';

interface MyBookingsPageProps {
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function MyBookingsPage({ onSignIn, onSessionRestored, onSessionEnded }: MyBookingsPageProps): JSX.Element {
  const { locale, t } = useI18n();
  const intlLocale = locale === 'vi' ? 'vi-VN' : 'en-GB';
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
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function loadBookings(accessToken: string): Promise<void> {
    setIsLoading(true);
    try { setBookings((await getMyBookings(accessToken)).bookings); }
    catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function cancel(bookingId: string): Promise<void> {
    if (!auth) return;
    setIsActioning(true); setError(null);
    try {
      const response = await cancelBooking(auth.accessToken, bookingId, crypto.randomUUID());
      setBookings((current) => current.map((booking) => booking.id === bookingId ? response.booking : booking));
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsActioning(false); }
  }

  const visible = bookings.filter((booking) => matchesTab(booking, tab));
  return <main className="page-shell bookings-shell">
    <header className="page-heading"><div><p className="eyebrow">{t('MY BOOKINGS', 'LỊCH ĐẶT CỦA TÔI')}</p><h1>{t('Manage your workspace time', 'Quản lý thời gian sử dụng không gian')}</h1><p className="lead">{t('Review upcoming sessions, check their status, and cancel within the permitted window.', 'Xem các buổi sắp tới, kiểm tra trạng thái và hủy trong thời hạn cho phép.')}</p></div></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {isLoading && !auth ? <p className="notice" role="status">{t('Restoring your session…', 'Đang khôi phục phiên đăng nhập…')}</p> : !auth ? <section className="auth-card"><div><p className="eyebrow">{t('MY BOOKINGS', 'LỊCH ĐẶT CỦA TÔI')}</p><h2>{t('Sign in to view your bookings', 'Đăng nhập để xem lịch đặt')}</h2></div><p className="lead">{t('Use your account to review booking status and manage permitted cancellations.', 'Dùng tài khoản để xem trạng thái lịch đặt và quản lý các trường hợp được phép hủy.')}</p><button type="button" onClick={onSignIn}>{t('Sign in to continue', 'Đăng nhập để tiếp tục')}</button></section> : <>
      <div className="booking-tabs" role="tablist" aria-label={t('Filter bookings', 'Lọc lịch đặt')}><button type="button" className={tab === 'upcoming' ? 'tab-active' : ''} onClick={() => setTab('upcoming')}>{t('Upcoming', 'Sắp tới')}</button><button type="button" className={tab === 'past' ? 'tab-active' : ''} onClick={() => setTab('past')}>{t('Past', 'Đã qua')}</button><button type="button" className={tab === 'cancelled' ? 'tab-active' : ''} onClick={() => setTab('cancelled')}>{t('Cancelled', 'Đã hủy')}</button><button className="text-button sign-out" type="button" onClick={() => void logout().finally(() => { setAuth(null); setBookings([]); onSessionEnded(); })}>{t('Sign out', 'Đăng xuất')}</button></div>
      {isLoading ? <p className="notice">{t('Loading your bookings…', 'Đang tải lịch đặt…')}</p> : visible.length === 0 ? <p className="notice">{t('There are no bookings in this view.', 'Không có lịch đặt nào trong mục này.')}</p> : <section className="booking-card-grid">{visible.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-card-image" aria-hidden="true"><span className={`booking-status booking-status-${booking.status.toLowerCase()}`}>{labelFor(booking.status, locale)}</span></div><div className="booking-card-body"><h2>{booking.workspaceName}</h2><p>{formatSalonLocalDate(booking.localDate, intlLocale)} · {formatSalonTimeRange(booking.startsAt, booking.endsAt, booking.salonTimezone, intlLocale)}</p><small className="booking-timezone">{booking.salonTimezone}</small><div className="booking-time"><strong>{booking.rentalOptionLabel}</strong><span>{formatVnd(booking.priceCents, locale)}</span></div>{booking.status === 'CONFIRMED' && <button className="danger-button" type="button" disabled={isActioning} onClick={() => void cancel(booking.id)}>{t('Cancel booking', 'Hủy lịch đặt')}</button>}</div></article>)}</section>}
    </>}
  </main>;
}

function matchesTab(booking: BookingSummary, tab: BookingTab): boolean {
  if (tab === 'cancelled') return booking.status === 'CANCELLED';
  if (tab === 'past') return booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && new Date(booking.endsAt) < new Date());
  return booking.status === 'CONFIRMED' && new Date(booking.endsAt) >= new Date();
}

function labelFor(status: BookingSummary['status'], locale: 'en' | 'vi'): string {
  if (locale === 'vi') return status === 'CONFIRMED' ? 'Đã xác nhận' : status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn thành';
  return status === 'CONFIRMED' ? 'Confirmed' : status === 'CANCELLED' ? 'Cancelled' : 'Completed';
}
