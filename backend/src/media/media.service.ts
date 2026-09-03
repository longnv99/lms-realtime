import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateMediaUploadResponse, MediaPlaybackResponse } from '@lms/shared';
import { randomUUID } from 'crypto';
import { AppError } from '../common/errors/app-error';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { S3StorageService } from './s3-storage.service';

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const allowedContentTypes = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
]);

const mediaAssetSelect = {
  id: true,
  key: true,
  fileName: true,
  contentType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async createUpload(dto: CreateUploadDto): Promise<CreateMediaUploadResponse> {
    const extension = this.getAllowedExtension(dto.contentType);
    this.ensureAllowedSize(dto.sizeBytes);

    const key = `videos/${randomUUID()}.${extension}`;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        key,
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
      select: {
        id: true,
        key: true,
      },
    });
    const uploadUrl = await this.storage.createUploadUrl(asset.key, dto.contentType);

    return {
      assetId: asset.id,
      key: asset.key,
      uploadUrl,
      expiresInSeconds: env.MEDIA_UPLOAD_TTL_SECONDS,
    };
  }

  async completeUpload(id: string) {
    const asset = await this.findAssetOrThrow(id);
    const object = await this.storage.headObject(asset.key);

    if (!object || object.contentLength !== Number(asset.sizeBytes)) {
      throw new AppError(
        'MEDIA_SIZE_MISMATCH',
        'Uploaded media size does not match the declared size',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (object.contentType !== asset.contentType) {
      throw new AppError(
        'MEDIA_INVALID_TYPE',
        'Uploaded media type does not match the declared content type',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'UPLOADED' },
      select: mediaAssetSelect,
    });
  }

  async createPlayback(id: string): Promise<MediaPlaybackResponse> {
    const asset = await this.findAssetOrThrow(id);

    if (asset.status !== 'UPLOADED') {
      throw new AppError(
        'LESSON_MEDIA_NOT_READY',
        'Lesson media is not ready',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      assetId: asset.id,
      playbackUrl: await this.storage.createPlaybackUrl(asset.key),
      expiresInSeconds: env.MEDIA_PLAYBACK_TTL_SECONDS,
    };
  }

  private async findAssetOrThrow(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        ...mediaAssetSelect,
        sizeBytes: true,
      },
    });

    if (!asset) {
      throw new AppError('NOT_FOUND', 'Media asset not found', HttpStatus.NOT_FOUND);
    }

    return asset;
  }

  private getAllowedExtension(contentType: string): string {
    const extension = allowedContentTypes.get(contentType);

    if (!extension) {
      throw new AppError(
        'MEDIA_INVALID_TYPE',
        'Media must be video/mp4 or video/webm',
        HttpStatus.BAD_REQUEST,
      );
    }

    return extension;
  }

  private ensureAllowedSize(sizeBytes: number): void {
    if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw new AppError('MEDIA_TOO_LARGE', 'Media must be 2GB or smaller', HttpStatus.PAYLOAD_TOO_LARGE);
    }
  }
}
