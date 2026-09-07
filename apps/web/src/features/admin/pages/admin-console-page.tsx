import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { AdminAuditEvent, AdminOutboxEvent, AdminOverviewResponse, AdminUser, AuthenticationResponse } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { getAdminAuditEvents, getAdminOutboxEvents, getAdminOverview, getAdminUsers, updateAdminUserStatus } from '../api/admin-api';
import { logout, refreshSession } from '../../auth/api/auth-api';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

interface AdminConsolePageProps {
  initialSession: AuthenticationResponse | null;
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function AdminConsolePage({ initialSession, onSignIn, onSessionRestored, onSessionEnded }: AdminConsolePageProps): JSX.Element {
  const { locale, t } = useI18n();
  const [auth, setAuth] = useState<AuthenticationResponse | null>(initialSession);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<AdminOutboxEvent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { if (!initialSession) void restore(); }, [initialSession]);

  async function restore(): Promise<void> {
    try { const session = await refreshSessionOnce(); setAuth(session); onSessionRestored(session); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function load(accessToken: string, query = search): Promise<void> {
    setIsLoading(true); setError(null);
    try {
      const [nextOverview, nextUsers, nextAudit, nextOutbox] = await Promise.all([
        getAdminOverview(accessToken), getAdminUsers(accessToken, query), getAdminAuditEvents(accessToken), getAdminOutboxEvents(accessToken)
      ]);
      setOverview(nextOverview); setUsers(nextUsers.data); setAuditEvents(nextAudit.events); setOutboxEvents(nextOutbox.events);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { if (auth) void load(auth.accessToken, ''); }, [auth]);

  async function searchUsers(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (auth) await load(auth.accessToken);
  }

  async function changeStatus(user: AdminUser, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    if (!auth || user.isAdmin) return;
    const reason = window.prompt(status === 'SUSPENDED'
      ? t(`Reason for suspending ${user.email}:`, `Lý do tạm khóa ${user.email}:`)
      : t(`Reason for reactivating ${user.email}:`, `Lý do kích hoạt lại ${user.email}:`));
    if (!reason?.trim()) return;
    setIsActioning(true); setError(null);
    try {
      const result = await updateAdminUserStatus(auth.accessToken, user.id, status, reason, crypto.randomUUID());
      setUsers((current) => current.map((item) => item.id === result.user.id ? result.user : item));
      await load(auth.accessToken);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsActioning(false); }
  }

  async function signOut(): Promise<void> { try { await logout(); } finally { setAuth(null); setOverview(null); setUsers([]); onSessionEnded(); } }

  return <main className="page-shell admin-shell">
    <header><p className="eyebrow">{t('THE SALON SPOT · OPERATIONS', 'THE SALON SPOT · VẬN HÀNH')}</p><h1>{t('System administration', 'Quản trị hệ thống')}</h1><p className="lead">{t('Monitor operations and manage accounts with controlled access. Admins do not own or manage salons on behalf of owners.', 'Theo dõi vận hành và quản lý tài khoản với quyền truy cập được kiểm soát. Quản trị viên không sở hữu hoặc quản lý salon thay cho chủ salon.')}</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!auth ? <section className="admin-panel"><h2>{t('Admin sign in', 'Đăng nhập quản trị')}</h2><p className="lead">{t('Your account must be granted admin access by the operations team first.', 'Tài khoản của bạn phải được đội ngũ vận hành cấp quyền quản trị trước.')}</p><button type="button" onClick={onSignIn}>{t('Sign in to Admin', 'Đăng nhập Quản trị')}</button></section> : <>
      <div className="section-heading admin-actions"><p className="lead">{t('Signed in as', 'Đã đăng nhập với tên')} {auth.user.displayName}</p><button className="text-button" type="button" onClick={() => void signOut()}>{t('Sign out', 'Đăng xuất')}</button></div>
      {isLoading && <p className="notice">{t('Loading operational data…', 'Đang tải dữ liệu vận hành…')}</p>}
      {overview && <section className="admin-metrics" aria-label={t('Operations overview', 'Tổng quan vận hành')}>
        <Metric label={t('Accounts', 'Tài khoản')} value={`${overview.users.active} ${t('active', 'hoạt động')} · ${overview.users.suspended} ${t('suspended', 'tạm khóa')}`} />
        <Metric label={t('Salon', 'Salon')} value={String(overview.salons)} />
        <Metric label={t('Workspaces', 'Không gian')} value={`${overview.workspaces.published} ${t('public', 'công khai')} · ${overview.workspaces.draft} ${t('draft', 'bản nháp')}`} />
        <Metric label={t('Bookings', 'Lịch đặt')} value={`${overview.bookings.confirmed} ${t('confirmed', 'đã xác nhận')}`} />
        <Metric label={t('Time slots', 'Khung giờ')} value={`${overview.slots.open} ${t('open', 'đang mở')} · ${overview.slots.held} ${t('reserved', 'đang giữ')}`} />
        <Metric label={t('Outbox requiring attention', 'Outbox cần xử lý')} value={`${overview.outbox.pending} ${t('pending', 'đang chờ')} · ${overview.outbox.failed} ${t('failed', 'thất bại')}`} warning={overview.outbox.failed > 0} />
        {overview.workers.map((worker) => <Metric key={worker.name} label={`${t('Worker', 'Tiến trình')} · ${worker.name}`} value={worker.status === 'HEALTHY' ? t('HEALTHY', 'ỔN ĐỊNH') : worker.status} warning={worker.status !== 'HEALTHY'} />)}
      </section>}
      <section className="admin-panel"><div className="section-heading"><div><p className="eyebrow">{t('ACCOUNTS', 'TÀI KHOẢN')}</p><h2>{t('Manage account status', 'Quản lý trạng thái tài khoản')}</h2></div></div><form className="admin-search" onSubmit={searchUsers}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search email or name', 'Tìm email hoặc tên')} /><button type="submit" disabled={isLoading}>{t('Search', 'Tìm kiếm')}</button></form><ul className="admin-list">{users.map((user) => <li key={user.id}><div><strong>{user.displayName}</strong><small>{user.email} · {user.ownedSalonCount} {t(user.ownedSalonCount === 1 ? 'salon' : 'salons', 'salon')} · {user.bookingCount} {t(user.bookingCount === 1 ? 'booking' : 'bookings', 'lịch đặt')}</small></div><span className={`status-badge ${user.status === 'SUSPENDED' ? 'status-danger' : ''}`}>{user.isAdmin ? t('ADMIN', 'QUẢN TRỊ') : user.status === 'ACTIVE' ? t('ACTIVE', 'HOẠT ĐỘNG') : t('SUSPENDED', 'TẠM KHÓA')}</span>{!user.isAdmin && <button className={user.status === 'ACTIVE' ? 'danger-button' : 'secondary-button'} type="button" disabled={isActioning} onClick={() => void changeStatus(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{user.status === 'ACTIVE' ? t('Suspend', 'Tạm khóa') : t('Reactivate', 'Kích hoạt lại')}</button>}</li>)}</ul>{!isLoading && users.length === 0 && <p className="notice">{t('No accounts found.', 'Không tìm thấy tài khoản nào.')}</p>}</section>
      <section className="admin-two-column"><EventList title={t('Recent audit activity', 'Hoạt động kiểm toán gần đây')} emptyLabel={t('No data yet.', 'Chưa có dữ liệu.')} events={auditEvents.map((event) => ({ id: event.id, title: event.action, detail: `${event.entityType} · ${event.actorEmail ?? t('system', 'hệ thống')} · ${formatDate(event.createdAt, locale)}` }))} /><EventList title={t('Recent outbox activity', 'Hoạt động outbox gần đây')} emptyLabel={t('No data yet.', 'Chưa có dữ liệu.')} events={outboxEvents.map((event) => ({ id: event.id, title: event.topic, detail: `${event.status} · ${t('attempt', 'lần thử')} ${event.attempts} · ${formatDate(event.createdAt, locale)}` }))} /></section>
    </>}
  </main>;
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }): JSX.Element { return <article className={warning ? 'metric metric-warning' : 'metric'}><small>{label}</small><strong>{value}</strong></article>; }
function EventList({ title, emptyLabel, events }: { title: string; emptyLabel: string; events: Array<{ id: string; title: string; detail: string }> }): JSX.Element { return <section className="admin-panel"><h2>{title}</h2><ul className="event-list">{events.map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.detail}</small></li>)}</ul>{events.length === 0 && <p className="lead">{emptyLabel}</p>}</section>; }
function formatDate(value: string, locale: 'en' | 'vi'): string { return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
