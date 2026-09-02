import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { AdminAuditEvent, AdminOutboxEvent, AdminOverviewResponse, AdminUser, AuthenticationResponse } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { getAdminAuditEvents, getAdminOutboxEvents, getAdminOverview, getAdminUsers, updateAdminUserStatus } from '../api/admin-api';
import { logout, refreshSession } from '../../auth/api/auth-api';

interface AdminConsolePageProps {
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function AdminConsolePage({ onSignIn, onSessionRestored, onSessionEnded }: AdminConsolePageProps): JSX.Element {
  const [auth, setAuth] = useState<AuthenticationResponse | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<AdminOutboxEvent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { void restore(); }, []);

  async function restore(): Promise<void> {
    try { const session = await refreshSessionOnce(); setAuth(session); onSessionRestored(session); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(messageFor(reason)); }
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
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { if (auth) void load(auth.accessToken, ''); }, [auth]);

  async function searchUsers(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (auth) await load(auth.accessToken);
  }

  async function changeStatus(user: AdminUser, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    if (!auth || user.isAdmin) return;
    const reason = window.prompt(status === 'SUSPENDED' ? `Reason for suspending ${user.email}:` : `Reason for reactivating ${user.email}:`);
    if (!reason?.trim()) return;
    setIsActioning(true); setError(null);
    try {
      const result = await updateAdminUserStatus(auth.accessToken, user.id, status, reason, crypto.randomUUID());
      setUsers((current) => current.map((item) => item.id === result.user.id ? result.user : item));
      await load(auth.accessToken);
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsActioning(false); }
  }

  async function signOut(): Promise<void> { try { await logout(); } finally { setAuth(null); setOverview(null); setUsers([]); onSessionEnded(); } }

  return <main className="page-shell admin-shell">
    <header><p className="eyebrow">THE SALON SPOT · OPERATIONS</p><h1>System administration</h1><p className="lead">Monitor operations and manage accounts with controlled access. Admins do not own or manage salons on behalf of owners.</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!auth ? <section className="admin-panel"><h2>Admin sign in</h2><p className="lead">Your account must be granted admin access by the operations team first.</p><button type="button" onClick={onSignIn}>Sign in to Admin</button></section> : <>
      <div className="section-heading admin-actions"><p className="lead">Signed in as {auth.user.displayName}</p><button className="text-button" type="button" onClick={() => void signOut()}>Sign out</button></div>
      {isLoading && <p className="notice">Loading operational data…</p>}
      {overview && <section className="admin-metrics" aria-label="Operations overview">
        <Metric label="Accounts" value={`${overview.users.active} active · ${overview.users.suspended} suspended`} />
        <Metric label="Salon" value={String(overview.salons)} />
        <Metric label="Workspaces" value={`${overview.workspaces.published} public · ${overview.workspaces.draft} draft`} />
        <Metric label="Bookings" value={`${overview.bookings.confirmed} confirmed`} />
        <Metric label="Time slots" value={`${overview.slots.open} open · ${overview.slots.held} reserved`} />
        <Metric label="Outbox requiring attention" value={`${overview.outbox.pending} pending · ${overview.outbox.failed} failed`} warning={overview.outbox.failed > 0} />
        {overview.workers.map((worker) => <Metric key={worker.name} label={`Worker · ${worker.name}`} value={worker.status} warning={worker.status !== 'HEALTHY'} />)}
      </section>}
      <section className="admin-panel"><div className="section-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>Manage account status</h2></div></div><form className="admin-search" onSubmit={searchUsers}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email or name" /><button type="submit" disabled={isLoading}>Search</button></form><ul className="admin-list">{users.map((user) => <li key={user.id}><div><strong>{user.displayName}</strong><small>{user.email} · {user.ownedSalonCount} salon{user.ownedSalonCount === 1 ? '' : 's'} · {user.bookingCount} booking{user.bookingCount === 1 ? '' : 's'}</small></div><span className={`status-badge ${user.status === 'SUSPENDED' ? 'status-danger' : ''}`}>{user.isAdmin ? 'ADMIN' : user.status}</span>{!user.isAdmin && <button className={user.status === 'ACTIVE' ? 'danger-button' : 'secondary-button'} type="button" disabled={isActioning} onClick={() => void changeStatus(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>}</li>)}</ul>{!isLoading && users.length === 0 && <p className="notice">No accounts found.</p>}</section>
      <section className="admin-two-column"><EventList title="Recent audit activity" events={auditEvents.map((event) => ({ id: event.id, title: event.action, detail: `${event.entityType} · ${event.actorEmail ?? 'system'} · ${formatDate(event.createdAt)}` }))} /><EventList title="Recent outbox activity" events={outboxEvents.map((event) => ({ id: event.id, title: event.topic, detail: `${event.status} · attempt ${event.attempts} · ${formatDate(event.createdAt)}` }))} /></section>
    </>}
  </main>;
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }): JSX.Element { return <article className={warning ? 'metric metric-warning' : 'metric'}><small>{label}</small><strong>{value}</strong></article>; }
function EventList({ title, events }: { title: string; events: Array<{ id: string; title: string; detail: string }> }): JSX.Element { return <section className="admin-panel"><h2>{title}</h2><ul className="event-list">{events.map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.detail}</small></li>)}</ul>{events.length === 0 && <p className="lead">No data yet.</p>}</section>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function messageFor(reason: unknown): string { return reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'; }
