export interface CreateMediaUploadResponse {
  assetId: string;
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface MediaPlaybackResponse {
  assetId: string;
  playbackUrl: string;
  expiresInSeconds: number;
}

export type MediaAssetStatus = 'PENDING' | 'UPLOADED';

export interface MediaAssetOwnerResponse {
  id: string;
  email: string;
  name: string;
}

export interface MediaAssetLessonResponse {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
}

export interface MediaAssetListItemResponse {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: MediaAssetStatus;
  uploadedBy: MediaAssetOwnerResponse | null;
  lesson: MediaAssetLessonResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListMediaAssetsQuery {
  attached?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  status?: MediaAssetStatus;
}

export interface ListMediaAssetsResponse {
  items: MediaAssetListItemResponse[];
  page: number;
  limit: number;
  total: number;
}

export interface DeletedMediaAssetResponse {
  deleted: true;
}
