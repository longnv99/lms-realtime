import type { CreateMediaUploadResponse, MediaPlaybackResponse } from '@lms/shared';
import { getEnvelope, postEnvelope } from './client';

export type CreateMediaUploadInput = {
  contentType: 'video/mp4' | 'video/webm';
  fileName: string;
  sizeBytes: number;
};

export type CompletedMediaAssetResponse = {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  status: 'PENDING' | 'UPLOADED';
  createdAt?: string;
  updatedAt?: string;
};

export async function createMediaUpload(
  input: CreateMediaUploadInput,
): Promise<CreateMediaUploadResponse> {
  return postEnvelope<CreateMediaUploadResponse>('/media/uploads', input);
}

export async function completeMediaUpload(assetId: string): Promise<CompletedMediaAssetResponse> {
  return postEnvelope<CompletedMediaAssetResponse>(`/media/uploads/${assetId}/complete`);
}

export async function getMediaPlayback(assetId: string): Promise<MediaPlaybackResponse> {
  return getEnvelope<MediaPlaybackResponse>(`/media/assets/${assetId}/playback`);
}
