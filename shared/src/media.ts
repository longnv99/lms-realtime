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
