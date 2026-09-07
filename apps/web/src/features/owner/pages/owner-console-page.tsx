import { useEffect, useRef, useState, type JSX } from 'react';
import type {
  AuthenticationResponse,
  CreateSalonWithWorkspaceInput,
  CreateWorkspaceInput,
  OpenWorkspaceSlotsInput,
  OwnerMedia,
  OwnerSalon,
  OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { createAdditionalWorkspace, createSalonWithWorkspace, getOwnedSalons } from '../api/owner-salons';
import { blockWorkspaceSlots, getWorkspaceSchedule, openWorkspaceSlots } from '../api/owner-availability';
import { deleteMedia, getPublishChecklist, publishWorkspace, reorderMedia, setMediaCover, uploadMedia, type MediaTarget } from '../api/owner-media';
import { OwnedSalonList } from '../components/owned-salon-list';
import { SalonWorkspaceForm } from '../components/salon-workspace-form';
import { ApiRequestError } from '../../../shared/api/http';
import { mergeMedia } from '../media-state';
import { logout, refreshSession } from '../../auth/api/auth-api';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

interface OwnerConsolePageProps {
  initialSession: AuthenticationResponse | null;
  onSignIn: () => void;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function OwnerConsolePage({ initialSession, onSignIn, onSessionRestored, onSessionEnded }: OwnerConsolePageProps): JSX.Element {
  const { t } = useI18n();
  const [auth, setAuth] = useState<AuthenticationResponse | null>(initialSession);
  const [salons, setSalons] = useState<OwnerSalon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(!initialSession);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { if (!initialSession) void restoreSession(); }, [initialSession]);
  useEffect(() => { if (auth) void loadSalons(); }, [auth]);

  async function restoreSession(): Promise<void> {
    try { const session = await refreshSessionOnce(); setAuth(session); onSessionRestored(session); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(localizedErrorMessage(reason, t)); }
    finally { setIsRestoring(false); }
  }

  async function runAuthorized<T>(action: (accessToken: string) => Promise<T>): Promise<T> {
    if (!auth) throw new Error(t('Your session has ended. Please sign in again.', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'));
    try { return await action(auth.accessToken); }
    catch (reason) {
      if (!(reason instanceof ApiRequestError) || reason.status !== 401) throw reason;
      try {
        const refreshed = await refreshSessionOnce();
        setAuth(refreshed);
        return await action(refreshed.accessToken);
      } catch {
        setAuth(null); setSalons([]); onSessionEnded();
        throw new Error(t('Your session has ended. Please sign in again.', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'));
      }
    }
  }

  async function loadSalons(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try { setSalons(await runAuthorized((accessToken) => getOwnedSalons(accessToken))); }
    catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    }
    return refreshInFlight.current;
  }

  async function createSalon(input: CreateSalonWithWorkspaceInput): Promise<void> {
    if (!auth) return;
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { salon } = await runAuthorized((accessToken) => createSalonWithWorkspace(accessToken, input, idempotencyKey));
      setSalons((current) => [...current, salon]);
      setMessage(t(`${salon.name} and its first workspace were created in DRAFT.`, `${salon.name} và không gian đầu tiên đã được tạo ở trạng thái BẢN NHÁP.`));
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
      try { setSalons(await runAuthorized((accessToken) => getOwnedSalons(accessToken))); } catch { /* Preserve the original action error. */ }
    }
    finally { setIsLoading(false); }
  }

  async function createWorkspace(salonId: string, input: CreateWorkspaceInput): Promise<void> {
    if (!auth) return;
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { workspace } = await runAuthorized((accessToken) => createAdditionalWorkspace(accessToken, salonId, input, idempotencyKey));
      setSalons((current) => current.map((salon) => salon.id === salonId ? { ...salon, workspaces: [...salon.workspaces, workspace] } : salon));
      setMessage(t(`${workspace.name} was added in DRAFT.`, `${workspace.name} đã được thêm ở trạng thái BẢN NHÁP.`));
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
      try { setSalons(await runAuthorized((accessToken) => getOwnedSalons(accessToken))); } catch { /* Preserve the original action error. */ }
    }
    finally { setIsLoading(false); }
  }

  function updateTargetMedia(target: MediaTarget, update: (media: OwnerMedia[]) => OwnerMedia[]): void {
    setSalons((current) => current.map((salon) => {
      if (salon.id !== target.salonId) return salon;
      if (!target.workspaceId) return { ...salon, media: update(salon.media) };
      return {
        ...salon,
        workspaces: salon.workspaces.map((workspace) => workspace.id === target.workspaceId ? { ...workspace, media: update(workspace.media) } : workspace)
      };
    }));
  }

  async function runMediaAction<T>(action: (accessToken: string) => Promise<T>, update: (result: T) => void, successMessage: string): Promise<void> {
    if (!auth) return;
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const result = await runAuthorized(action);
      update(result);
      setMessage(successMessage);
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
      try { setSalons(await runAuthorized((accessToken) => getOwnedSalons(accessToken))); } catch { /* Preserve the original action error. */ }
    }
    finally { setIsLoading(false); }
  }

  function upload(target: MediaTarget, file: File): Promise<void> {
    return runMediaAction((token) => uploadMedia(token, target, file), (media) => updateTargetMedia(target, (current) => [...current, media]), t('The photo was validated, processed, and is READY.', 'Ảnh đã được kiểm tra, xử lý và SẴN SÀNG.'));
  }

  function setCover(target: MediaTarget, mediaId: string | null): Promise<void> {
    return runMediaAction((token) => setMediaCover(token, target, mediaId), (updated) => updateTargetMedia(target, (current) => current.map((media) => ({ ...media, ...(updated?.id === media.id ? updated : {}), isCover: updated?.id === media.id }))), mediaId ? t('The cover image was updated.', 'Ảnh bìa đã được cập nhật.') : t('The cover image was removed.', 'Ảnh bìa đã được gỡ.'));
  }

  function reorder(target: MediaTarget, mediaIds: string[]): Promise<void> {
    return runMediaAction((token) => reorderMedia(token, target, mediaIds), (updated) => updateTargetMedia(target, (current) => mergeMedia(current, updated)), t('The photo order was updated.', 'Thứ tự ảnh đã được cập nhật.'));
  }

  function removeMedia(target: MediaTarget, mediaId: string): Promise<void> {
    return runMediaAction((token) => deleteMedia(token, target, mediaId), (updated) => updateTargetMedia(target, (current) => mergeMedia(current, [updated])), t('The photo was hidden and queued for cleanup.', 'Ảnh đã được ẩn và đưa vào hàng đợi dọn dẹp.'));
  }

  async function publish(salonId: string, workspaceId: string): Promise<void> {
    if (!auth) return;
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const checklist = await runAuthorized((accessToken) => getPublishChecklist(accessToken, salonId, workspaceId));
      if (!checklist.eligible) {
        throw new Error(checklist.checks.filter((check) => !check.passed).map((check) => check.message).join(' '));
      }
      const { workspace } = await runAuthorized((accessToken) => publishWorkspace(accessToken, salonId, workspaceId));
      setSalons((current) => current.map((salon) => salon.id === salonId ? { ...salon, workspaces: salon.workspaces.map((item) => item.id === workspaceId ? workspace : item) } : salon));
      setMessage(t('The workspace passed the checklist and was published.', 'Không gian đã vượt qua danh sách kiểm tra và được công bố.'));
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  function loadSchedule(salonId: string, workspaceId: string, localDate: string): Promise<OwnerWorkspaceScheduleResponse> {
    return runAuthorized((accessToken) => getWorkspaceSchedule(accessToken, salonId, workspaceId, localDate));
  }

  async function openSlots(salonId: string, workspaceId: string, input: OpenWorkspaceSlotsInput): Promise<OwnerWorkspaceScheduleResponse> {
    if (!auth) throw new Error(t('Your session has ended. Please sign in again.', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'));
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const result = await runAuthorized((accessToken) => openWorkspaceSlots(accessToken, salonId, workspaceId, input, crypto.randomUUID()));
      setMessage(t(`${input.periods.length} time slot${input.periods.length === 1 ? ' was' : 's were'} opened for ${input.localDate}. You can now check them in Explore.`, `${input.periods.length} khung giờ đã được mở cho ngày ${input.localDate}. Bạn có thể kiểm tra trong mục Khám phá.`));
      return result;
    } catch (reason) { setError(localizedErrorMessage(reason, t)); throw reason; }
    finally { setIsLoading(false); }
  }

  async function blockSlots(salonId: string, workspaceId: string, input: OpenWorkspaceSlotsInput): Promise<OwnerWorkspaceScheduleResponse> {
    if (!auth) throw new Error(t('Your session has ended. Please sign in again.', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'));
    setIsLoading(true); setError(null); setMessage(null);
    try {
      const result = await runAuthorized((accessToken) => blockWorkspaceSlots(accessToken, salonId, workspaceId, input, crypto.randomUUID()));
      setMessage(t(`${input.periods.length} time slot${input.periods.length === 1 ? ' was' : 's were'} blocked for ${input.localDate}.`, `${input.periods.length} khung giờ đã được chặn cho ngày ${input.localDate}.`));
      return result;
    } catch (reason) { setError(localizedErrorMessage(reason, t)); throw reason; }
    finally { setIsLoading(false); }
  }

  return (
    <main className="page-shell owner-shell">
      <header><p className="eyebrow">{t('THE SALON SPOT · OWNER CONSOLE', 'THE SALON SPOT · KHU VỰC CHỦ SALON')}</p><h1>{t('Manage your salon spaces', 'Quản lý không gian salon')}</h1><p className="lead">{t('Create salons, workspaces, and rental options. Management permissions are always limited to the relevant salon.', 'Tạo salon, không gian và gói thuê. Quyền quản lý luôn chỉ giới hạn trong salon tương ứng.')}</p></header>
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}
      {isRestoring ? <p className="notice" role="status">{t('Restoring your session…', 'Đang khôi phục phiên đăng nhập…')}</p> : !auth ? <section className="owner-panel"><p className="eyebrow">{t('OWNER CONSOLE', 'KHU VỰC CHỦ SALON')}</p><h2>{t('Sign in to manage your salon', 'Đăng nhập để quản lý salon')}</h2><p className="lead">{t('Create workspaces, add media and open the available time slots from one secure account.', 'Tạo không gian, thêm hình ảnh và mở khung giờ trống từ một tài khoản bảo mật.')}</p><button type="button" onClick={onSignIn}>{t('Sign in to Owner Console', 'Đăng nhập khu vực Chủ salon')}</button></section> : (
        <>
          {isLoading && salons.length === 0 ? <OwnerConsoleSkeleton /> : salons.length === 0 ? <SalonWorkspaceForm isLoading={isLoading} onSubmit={createSalon} /> : <><SalonWorkspaceForm isLoading={isLoading} onSubmit={createSalon} /><OwnedSalonList salons={salons} isLoading={isLoading} onCreateWorkspace={createWorkspace} onUploadMedia={upload} onSetCover={setCover} onReorderMedia={reorder} onDeleteMedia={removeMedia} onPublishWorkspace={publish} onLoadWorkspaceSchedule={loadSchedule} onOpenWorkspaceSlots={openSlots} onBlockWorkspaceSlots={blockSlots} /></>}
        <button className="text-button sign-out" type="button" onClick={() => void signOut()}>{t('Sign out of this session', 'Đăng xuất khỏi phiên này')}</button>
        </>)}
    </main>
  );

  async function signOut(): Promise<void> {
    try { await logout(); }
    catch { /* Clearing local state is still correct when the server session is already unavailable. */ }
    finally { setAuth(null); setSalons([]); setMessage(null); onSessionEnded(); }
  }
}

function OwnerConsoleSkeleton(): JSX.Element {
  const { t } = useI18n();
  return <section className="owner-panel owner-console-skeleton" aria-label={t('Loading salons', 'Đang tải salon')} aria-busy="true"><div className="skeleton-block skeleton-label" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><div className="skeleton-block skeleton-copy" /></section>;
}
