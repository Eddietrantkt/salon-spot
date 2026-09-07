import { useState, type FormEvent, type JSX } from 'react';
import type { CreateWorkspaceInput, OpenWorkspaceSlotsInput, OwnerSalon, OwnerWorkspaceScheduleResponse } from '@salon-spot/contracts';
import { formatVnd } from '../../discovery/format-vnd';
import type { MediaTarget } from '../api/owner-media';
import { MediaManager } from './media-manager';
import { OwnerReadinessDashboard } from './owner-readiness-dashboard';
import { WorkspaceSchedule } from './workspace-schedule';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface OwnedSalonListProps {
  salons: OwnerSalon[];
  isLoading: boolean;
  onCreateWorkspace: (salonId: string, input: CreateWorkspaceInput) => Promise<void>;
  onUploadMedia: (target: MediaTarget, file: File) => Promise<void>;
  onSetCover: (target: MediaTarget, mediaId: string | null) => Promise<void>;
  onReorderMedia: (target: MediaTarget, mediaIds: string[]) => Promise<void>;
  onDeleteMedia: (target: MediaTarget, mediaId: string) => Promise<void>;
  onPublishWorkspace: (salonId: string, workspaceId: string) => Promise<void>;
  onLoadWorkspaceSchedule: (salonId: string, workspaceId: string, localDate: string) => Promise<OwnerWorkspaceScheduleResponse>;
  onOpenWorkspaceSlots: (salonId: string, workspaceId: string, input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
  onBlockWorkspaceSlots: (salonId: string, workspaceId: string, input: OpenWorkspaceSlotsInput) => Promise<OwnerWorkspaceScheduleResponse>;
}

export function OwnedSalonList({
  salons,
  isLoading,
  onCreateWorkspace,
  onUploadMedia,
  onSetCover,
  onReorderMedia,
  onDeleteMedia,
  onPublishWorkspace,
  onLoadWorkspaceSchedule,
  onOpenWorkspaceSlots,
  onBlockWorkspaceSlots
}: OwnedSalonListProps): JSX.Element {
  const { locale, t } = useI18n();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Styling Chair 02');
  const [rentalLabel, setRentalLabel] = useState('2 hours');
  const [priceVnd, setPriceVnd] = useState('250000');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!salonId) return;
    await onCreateWorkspace(salonId, { name: workspaceName, rentalLabel, priceCents: Number(priceVnd) });
    setSalonId(null);
  }

  return (
    <section className="owned-salons" aria-live="polite">
      <div className="section-heading"><div><p className="eyebrow">{t('YOUR SALONS', 'SALON CỦA BẠN')}</p><h2>{t('Managed workspaces', 'Không gian đang quản lý')}</h2></div><span>{salons.length} {t(salons.length === 1 ? 'salon' : 'salons', 'salon')}</span></div>
      <OwnerReadinessDashboard salons={salons} />
      {salons.map((salon) => {
        const salonTarget: MediaTarget = { salonId: salon.id };
        return (
          <article className="salon-card" key={salon.id}>
            <header><div><h3>{salon.name}</h3><p>{salon.area} · {salon.timezone}</p></div><button className="secondary-button" type="button" onClick={() => setSalonId(salonId === salon.id ? null : salon.id)}>{t('Add workspace', 'Thêm không gian')}</button></header>
            <MediaManager title={t('Salon photos', 'Ảnh salon')} media={salon.media} isLoading={isLoading}
              onUpload={(file) => onUploadMedia(salonTarget, file)}
              onSetCover={(mediaId) => onSetCover(salonTarget, mediaId)}
              onReorder={(mediaIds) => onReorderMedia(salonTarget, mediaIds)}
              onDelete={(mediaId) => onDeleteMedia(salonTarget, mediaId)} />
            <ul className="workspace-list">{salon.workspaces.map((workspace) => {
              const workspaceTarget: MediaTarget = { salonId: salon.id, workspaceId: workspace.id };
              return (
                <li key={workspace.id}>
                  <div className="workspace-summary">
                    <strong>{workspace.name}</strong><span className="status-badge">{workspace.status === 'DRAFT' ? t('DRAFT', 'BẢN NHÁP') : t('PUBLISHED', 'ĐÃ CÔNG BỐ')}</span>
                    <small>{workspace.rentalOptions.map((option) => `${option.label}: ${formatVnd(option.priceCents, locale)}`).join(' · ')}</small>
                    {workspace.status === 'DRAFT' && <button className="publish-button" disabled={isLoading} type="button" onClick={() => void onPublishWorkspace(salon.id, workspace.id)}>{t('Review & publish', 'Kiểm tra và công bố')}</button>}
                  </div>
                  <div className="workspace-readiness"><span>{workspace.media.filter((media) => media.status === 'READY').length}/10 {t('ready photos', 'ảnh sẵn sàng')}</span><span>{workspace.rentalOptions.length} {t(workspace.rentalOptions.length === 1 ? 'rental option' : 'rental options', 'gói thuê')}</span><span>{workspace.status === 'PUBLISHED' ? t('Ready to manage availability', 'Sẵn sàng quản lý lịch trống') : t('Publishing checklist required', 'Cần hoàn tất danh sách công bố')}</span></div>
                  <WorkspaceSchedule
                    isLoading={isLoading}
                    isPublished={workspace.status === 'PUBLISHED'}
                    onLoadSchedule={(localDate) => onLoadWorkspaceSchedule(salon.id, workspace.id, localDate)}
                    onOpenSlots={(input) => onOpenWorkspaceSlots(salon.id, workspace.id, input)}
                    onBlockSlots={(input) => onBlockWorkspaceSlots(salon.id, workspace.id, input)}
                  />
                  <MediaManager title={`${t('Photos for', 'Ảnh của')} ${workspace.name}`} media={workspace.media} isLoading={isLoading}
                    onUpload={(file) => onUploadMedia(workspaceTarget, file)}
                    onSetCover={(mediaId) => onSetCover(workspaceTarget, mediaId)}
                    onReorder={(mediaIds) => onReorderMedia(workspaceTarget, mediaIds)}
                    onDelete={(mediaId) => onDeleteMedia(workspaceTarget, mediaId)} />
                </li>
              );
            })}</ul>
            {salonId === salon.id && (
              <form className="inline-workspace-form" onSubmit={submit}>
                <label>{t('Workspace name', 'Tên không gian')}<input required maxLength={160} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
                <label>{t('Rental label', 'Tên gói thuê')}<input required maxLength={120} value={rentalLabel} onChange={(event) => setRentalLabel(event.target.value)} /></label>
                <label>{t('Rate (VND)', 'Giá thuê (VND)')}<input required type="number" min="1" max="100000000" step="1" value={priceVnd} onChange={(event) => setPriceVnd(event.target.value)} /></label>
                <button disabled={isLoading} type="submit">{isLoading ? t('Adding…', 'Đang thêm…') : t('Save workspace', 'Lưu không gian')}</button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
