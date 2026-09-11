import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { AuthenticationResponse, NotificationItem, NotificationPreferences, NotificationReadStatus } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';
import { refreshSession } from '../../auth/api/auth-api';
import {
  getNotificationPreferences,
  getNotificationUnreadCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences
} from '../api/notifications-api';
import { notificationBody, notificationTitle } from '../notification-copy';

interface NotificationsPageProps {
  initialSession: AuthenticationResponse | null;
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
  onUnreadCountChange: (count: number) => void;
  onOpenNotification: (notification: NotificationItem) => void;
  onOpenOwner: () => void;
}

type NotificationFilter = 'all' | NotificationReadStatus;

export function NotificationsPage({
  initialSession,
  onSignIn,
  onSessionRestored,
  onSessionEnded,
  onUnreadCountChange,
  onOpenNotification,
  onOpenOwner
}: NotificationsPageProps): JSX.Element {
  const { locale, t } = useI18n();
  const [auth, setAuth] = useState<AuthenticationResponse | null>(initialSession);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [loadedPage, setLoadedPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { if (!initialSession) void restore(); }, [initialSession]);
  useEffect(() => { if (auth) void load(auth.accessToken, filter); }, [auth, filter]);

  async function restore(): Promise<void> {
    try {
      if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
      const session = await refreshInFlight.current;
      setAuth(session);
      onSessionRestored(session);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded();
      else setError(localizedErrorMessage(reason, t));
    } finally { setIsLoading(false); }
  }

  async function load(accessToken: string, nextFilter: NotificationFilter): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const [response, nextPreferences, count] = await Promise.all([
        getNotifications(accessToken, nextFilter === 'all' ? undefined : nextFilter),
        getNotificationPreferences(accessToken),
        getNotificationUnreadCount(accessToken)
      ]);
      setNotifications(response.data);
      setLoadedPage(1);
      setTotal(response.meta.total);
      setPreferences(nextPreferences);
      onUnreadCountChange(count.unreadCount);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function loadMore(): Promise<void> {
    if (!auth || isLoadingMore || notifications.length >= total) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const nextPage = loadedPage + 1;
      const response = await getNotifications(auth.accessToken, filter === 'all' ? undefined : filter, nextPage);
      setNotifications((current) => [
        ...current,
        ...response.data.filter((item) => !current.some((existing) => existing.id === item.id))
      ]);
      setLoadedPage(nextPage);
      setTotal(response.meta.total);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoadingMore(false); }
  }

  async function read(notification: NotificationItem): Promise<void> {
    if (!auth || notification.readAt) return;
    setError(null);
    try {
      const updated = await markNotificationRead(auth.accessToken, notification.id, crypto.randomUUID());
      setNotifications((current) => filter === 'unread'
        ? current.filter((item) => item.id !== updated.id)
        : current.map((item) => item.id === updated.id ? updated : item));
      if (filter === 'unread') setTotal((current) => Math.max(0, current - 1));
      const count = await getNotificationUnreadCount(auth.accessToken);
      onUnreadCountChange(count.unreadCount);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
  }

  async function readAll(): Promise<void> {
    if (!auth) return;
    setError(null);
    try {
      await markAllNotificationsRead(auth.accessToken, crypto.randomUUID());
      setNotifications((current) => filter === 'unread' ? [] : current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      if (filter === 'unread') setTotal(0);
      onUnreadCountChange(0);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth || !preferences) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateNotificationPreferences(auth.accessToken, {
        locale: preferences.locale,
        emailEnabled: preferences.emailEnabled,
        marketingEnabled: preferences.marketingEnabled
      }, crypto.randomUUID());
      setPreferences(updated);
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsSaving(false); }
  }

  return <main className="page-shell notifications-shell">
    <header><p className="eyebrow">{t('INBOX', 'HỘP THƯ')}</p><h1>{t('Notifications', 'Thông báo')}</h1><p className="lead">{t('Booking updates are stored here after the booking transaction completes.', 'Cập nhật lịch đặt được lưu tại đây sau khi transaction đặt lịch hoàn tất.')}</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!auth && !isLoading ? <section className="admin-panel"><h2>{t('Sign in to see your inbox', 'Đăng nhập để xem hộp thư')}</h2><button type="button" onClick={onSignIn}>{t('Sign in', 'Đăng nhập')}</button></section> : <>
      {auth?.capabilities.owner && <section className="notification-owner-cta" aria-labelledby="notification-owner-cta-heading">
        <div><p className="eyebrow">{t('OWNER WORKSPACE', 'KHU VỰC CHỦ SALON')}</p><h2 id="notification-owner-cta-heading">{t('Ready to post a workplace?', 'Sẵn sàng đăng workplace?')}</h2><p>{t('Create a salon space, add photos and pricing, open availability, then publish it for professionals to book.', 'Tạo không gian salon, thêm ảnh và giá, mở lịch trống rồi công bố để chuyên viên đặt lịch.')}</p></div>
        <button type="button" onClick={onOpenOwner}>{t('Post a workplace', 'Đăng workplace')}</button>
      </section>}
      <section className="notification-toolbar" aria-label={t('Notification filters', 'Bộ lọc thông báo')}>
        <div className="notification-filters">{(['all', 'unread', 'read'] as const).map((value) => <button key={value} className={filter === value ? 'tab-active' : 'secondary-button'} type="button" onClick={() => setFilter(value)}>{value === 'all' ? t('All', 'Tất cả') : value === 'unread' ? t('Unread', 'Chưa đọc') : t('Read', 'Đã đọc')}</button>)}</div>
        <button className="text-button" type="button" disabled={isLoading || !notifications.some((item) => !item.readAt)} onClick={() => void readAll()}>{t('Mark all as read', 'Đánh dấu tất cả đã đọc')}</button>
      </section>
      {isLoading && <p className="notice">{t('Loading notifications…', 'Đang tải thông báo…')}</p>}
      {!isLoading && <ul className="notification-list">{notifications.map((notification) => <li key={notification.id} className={notification.readAt ? 'notification-card' : 'notification-card notification-unread'}>
        <div><span className="notification-dot" aria-hidden="true" /><p className="eyebrow">{notificationTitle(notification, t)}</p><p>{notificationBody(notification, t)}</p><small>{new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}</small></div>
        <div className="notification-actions">{!notification.readAt && <button className="secondary-button" type="button" onClick={() => void read(notification)}>{t('Mark read', 'Đánh dấu đã đọc')}</button>}<button className="text-button" type="button" onClick={() => onOpenNotification(notification)}>{t('Open booking', 'Mở lịch đặt')}</button></div>
      </li>)}</ul>}
      {!isLoading && notifications.length < total && <button className="secondary-button notification-load-more" type="button" disabled={isLoadingMore} onClick={() => void loadMore()}>{isLoadingMore ? t('Loading…', 'Đang tải…') : t('Load more', 'Tải thêm')}</button>}
      {!isLoading && notifications.length === 0 && <p className="notice">{t('No notifications match this filter.', 'Không có thông báo phù hợp bộ lọc này.')}</p>}
      {preferences && <form className="notification-preferences admin-panel" onSubmit={savePreferences}><div><p className="eyebrow">{t('PREFERENCES', 'TÙY CHỌN')}</p><h2>{t('Delivery preferences', 'Tùy chọn nhận thông báo')}</h2><p className="lead">{t('Transactional in-app updates stay on. Email delivery will use these settings when a real provider is connected.', 'Thông báo giao dịch trong ứng dụng luôn bật. Email sẽ dùng các thiết lập này khi provider thật được kết nối.')}</p></div><label>{t('Notification language', 'Ngôn ngữ thông báo')}<select value={preferences.locale} onChange={(event) => setPreferences({ ...preferences, locale: event.target.value === 'VI' ? 'VI' : 'EN' })}><option value="EN">English</option><option value="VI">Tiếng Việt</option></select></label><label className="checkbox-row"><input type="checkbox" checked={preferences.emailEnabled} onChange={(event) => setPreferences({ ...preferences, emailEnabled: event.target.checked })} />{t('Email delivery', 'Nhận qua email')}</label><label className="checkbox-row"><input type="checkbox" checked={preferences.marketingEnabled} onChange={(event) => setPreferences({ ...preferences, marketingEnabled: event.target.checked })} />{t('Marketing messages', 'Thông báo tiếp thị')}</label><button type="submit" disabled={isSaving}>{isSaving ? t('Saving…', 'Đang lưu…') : t('Save preferences', 'Lưu tùy chọn')}</button></form>}
    </>}
  </main>;
}
