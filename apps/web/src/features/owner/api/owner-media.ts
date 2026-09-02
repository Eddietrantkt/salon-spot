import type {
  CreateWorkspaceResponse,
  MediaUploadIntentResponse,
  OwnerMedia,
  WorkspacePublishChecklistResponse
} from '@salon-spot/contracts';
import { authenticatedGetJson, deleteJson, postJson, putJson } from '../../../shared/api/http';

export interface MediaTarget {
  salonId: string;
  workspaceId?: string;
}

export async function uploadMedia(accessToken: string, target: MediaTarget, file: File): Promise<OwnerMedia> {
  const path = mediaPath(target);
  const intent = await postJson<MediaUploadIntentResponse>(`${path}/upload-intents`, { contentType: file.type }, accessToken);
  const response = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: file });
  if (!response.ok) throw new Error('We could not upload this photo to temporary storage.');
  return postJson<OwnerMedia>(`${path}/${encodeURIComponent(intent.media.id)}/finalize`, {}, accessToken);
}

export function setMediaCover(accessToken: string, target: MediaTarget, mediaId: string | null): Promise<OwnerMedia | null> {
  return putJson<OwnerMedia | null>(`${mediaPath(target)}/cover`, { mediaId }, accessToken);
}

export function reorderMedia(accessToken: string, target: MediaTarget, mediaIds: string[]): Promise<OwnerMedia[]> {
  return putJson<OwnerMedia[]>(`${mediaPath(target)}/order`, { mediaIds }, accessToken);
}

export function deleteMedia(accessToken: string, target: MediaTarget, mediaId: string): Promise<OwnerMedia> {
  return deleteJson<OwnerMedia>(`${mediaPath(target)}/${encodeURIComponent(mediaId)}`, accessToken);
}

export function getPublishChecklist(accessToken: string, salonId: string, workspaceId: string): Promise<WorkspacePublishChecklistResponse> {
  return authenticatedGetJson(`/owner/salons/${encodeURIComponent(salonId)}/workspaces/${encodeURIComponent(workspaceId)}/publish-checklist`, accessToken);
}

export function publishWorkspace(accessToken: string, salonId: string, workspaceId: string): Promise<CreateWorkspaceResponse> {
  return postJson<CreateWorkspaceResponse>(`/owner/salons/${encodeURIComponent(salonId)}/workspaces/${encodeURIComponent(workspaceId)}/publish`, {}, accessToken);
}

function mediaPath(target: MediaTarget): string {
  const salon = `/owner/salons/${encodeURIComponent(target.salonId)}`;
  return target.workspaceId ? `${salon}/workspaces/${encodeURIComponent(target.workspaceId)}/media` : `${salon}/media`;
}
