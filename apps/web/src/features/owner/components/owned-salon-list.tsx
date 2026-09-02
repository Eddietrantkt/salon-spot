import { useState, type FormEvent, type JSX } from 'react';
import type { CreateWorkspaceInput, OpenWorkspaceSlotsInput, OwnerSalon, OwnerWorkspaceScheduleResponse } from '@salon-spot/contracts';
import { formatVnd } from '../../discovery/format-vnd';
import type { MediaTarget } from '../api/owner-media';
import { MediaManager } from './media-manager';
import { OwnerReadinessDashboard } from './owner-readiness-dashboard';
import { WorkspaceSchedule } from './workspace-schedule';

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
      <div className="section-heading"><div><p className="eyebrow">YOUR SALONS</p><h2>Managed workspaces</h2></div><span>{salons.length} {salons.length === 1 ? 'salon' : 'salons'}</span></div>
      <OwnerReadinessDashboard salons={salons} />
      {salons.map((salon) => {
        const salonTarget: MediaTarget = { salonId: salon.id };
        return (
          <article className="salon-card" key={salon.id}>
            <header><div><h3>{salon.name}</h3><p>{salon.area} · {salon.timezone}</p></div><button className="secondary-button" type="button" onClick={() => setSalonId(salonId === salon.id ? null : salon.id)}>Add workspace</button></header>
            <MediaManager title="Salon photos" media={salon.media} isLoading={isLoading}
              onUpload={(file) => onUploadMedia(salonTarget, file)}
              onSetCover={(mediaId) => onSetCover(salonTarget, mediaId)}
              onReorder={(mediaIds) => onReorderMedia(salonTarget, mediaIds)}
              onDelete={(mediaId) => onDeleteMedia(salonTarget, mediaId)} />
            <ul className="workspace-list">{salon.workspaces.map((workspace) => {
              const workspaceTarget: MediaTarget = { salonId: salon.id, workspaceId: workspace.id };
              return (
                <li key={workspace.id}>
                  <div className="workspace-summary">
                    <strong>{workspace.name}</strong><span className="status-badge">{workspace.status}</span>
                    <small>{workspace.rentalOptions.map((option) => `${option.label}: ${formatVnd(option.priceCents)}`).join(' · ')}</small>
                    {workspace.status === 'DRAFT' && <button className="publish-button" disabled={isLoading} type="button" onClick={() => void onPublishWorkspace(salon.id, workspace.id)}>Review & publish</button>}
                  </div>
                  <div className="workspace-readiness"><span>{workspace.media.filter((media) => media.status === 'READY').length}/10 ready photos</span><span>{workspace.rentalOptions.length} rental option{workspace.rentalOptions.length === 1 ? '' : 's'}</span><span>{workspace.status === 'PUBLISHED' ? 'Ready to manage availability' : 'Publishing checklist required'}</span></div>
                  <WorkspaceSchedule
                    isLoading={isLoading}
                    isPublished={workspace.status === 'PUBLISHED'}
                    onLoadSchedule={(localDate) => onLoadWorkspaceSchedule(salon.id, workspace.id, localDate)}
                    onOpenSlots={(input) => onOpenWorkspaceSlots(salon.id, workspace.id, input)}
                    onBlockSlots={(input) => onBlockWorkspaceSlots(salon.id, workspace.id, input)}
                  />
                  <MediaManager title={`${workspace.name} photos`} media={workspace.media} isLoading={isLoading}
                    onUpload={(file) => onUploadMedia(workspaceTarget, file)}
                    onSetCover={(mediaId) => onSetCover(workspaceTarget, mediaId)}
                    onReorder={(mediaIds) => onReorderMedia(workspaceTarget, mediaIds)}
                    onDelete={(mediaId) => onDeleteMedia(workspaceTarget, mediaId)} />
                </li>
              );
            })}</ul>
            {salonId === salon.id && (
              <form className="inline-workspace-form" onSubmit={submit}>
                <label>Workspace name<input required maxLength={160} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
                <label>Rental label<input required maxLength={120} value={rentalLabel} onChange={(event) => setRentalLabel(event.target.value)} /></label>
                <label>Rate (VND)<input required type="number" min="1" max="100000000" step="1" value={priceVnd} onChange={(event) => setPriceVnd(event.target.value)} /></label>
                <button disabled={isLoading} type="submit">{isLoading ? 'Adding…' : 'Save workspace'}</button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
