import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env';

type HeadObjectResult = {
  contentLength: number;
  contentType: string | null;
};

@Injectable()
export class S3StorageService {
  private readonly client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

  async createUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: env.MEDIA_UPLOAD_TTL_SECONDS,
    });
  }

  async createPlaybackUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: env.MEDIA_PLAYBACK_TTL_SECONDS,
    });
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
        }),
      );

      return {
        contentLength: Number(result.ContentLength ?? 0),
        contentType: result.ContentType ?? null,
      };
    } catch (error) {
      if (error instanceof NotFound || isS3NotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }
}

function isS3NotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}
