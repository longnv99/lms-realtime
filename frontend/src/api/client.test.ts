import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, unwrapEnvelope } from './client';
import { completeMediaUpload, createMediaUpload, getMediaPlayback } from './media';
import { getCourseProgress, getMyCourseProgress } from './progress';

describe('unwrapEnvelope', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns data from successful envelopes', () => {
    expect(unwrapEnvelope({ success: true, data: { ok: true }, error: null, meta: null })).toEqual({
      ok: true,
    });
  });

  it('normalizes API error messages to English UI copy', () => {
    expect(() =>
      unwrapEnvelope({
        success: false,
        data: null,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Sai email/password' },
        meta: null,
      }),
    ).toThrow('Email or password is incorrect.');
  });

  it('calls media endpoints with envelope helpers', async () => {
    const postSpy = vi.spyOn(apiClient, 'post');
    const getSpy = vi.spyOn(apiClient, 'get');
    postSpy.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          assetId: 'asset-1',
          expiresInSeconds: 900,
          key: 'videos/asset-1.mp4',
          uploadUrl: 'http://localhost:9000/upload',
        },
        error: null,
        meta: null,
      },
    });
    postSpy.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          assetId: 'asset-1',
          contentType: 'video/mp4',
          fileName: 'intro.mp4',
          key: 'videos/asset-1.mp4',
          status: 'UPLOADED',
        },
        error: null,
        meta: null,
      },
    });
    getSpy.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          assetId: 'asset-1',
          expiresInSeconds: 1800,
          playbackUrl: 'http://localhost:9000/playback',
        },
        error: null,
        meta: null,
      },
    });

    await expect(
      createMediaUpload({ contentType: 'video/mp4', fileName: 'intro.mp4', sizeBytes: 123 }),
    ).resolves.toMatchObject({ assetId: 'asset-1' });
    await expect(completeMediaUpload('asset-1')).resolves.toMatchObject({ status: 'UPLOADED' });
    await expect(getMediaPlayback('asset-1')).resolves.toMatchObject({
      playbackUrl: 'http://localhost:9000/playback',
    });

    expect(postSpy).toHaveBeenNthCalledWith(1, '/media/uploads', {
      contentType: 'video/mp4',
      fileName: 'intro.mp4',
      sizeBytes: 123,
    });
    expect(postSpy).toHaveBeenNthCalledWith(2, '/media/uploads/asset-1/complete', undefined);
    expect(getSpy).toHaveBeenCalledWith('/media/assets/asset-1/playback', { params: undefined });
  });

  it('calls progress endpoints with envelope helpers', async () => {
    const getSpy = vi.spyOn(apiClient, 'get');
    getSpy.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          completedLessons: 1,
          courseId: 'course-1',
          lessons: [],
          percent: 50,
          totalLessons: 2,
        },
        error: null,
        meta: null,
      },
    });
    getSpy.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          courseId: 'course-1',
          students: [],
          totalLessons: 2,
        },
        error: null,
        meta: null,
      },
    });

    await expect(getMyCourseProgress('course-1')).resolves.toMatchObject({ percent: 50 });
    await expect(getCourseProgress('course-1')).resolves.toMatchObject({ totalLessons: 2 });

    expect(getSpy).toHaveBeenNthCalledWith(1, '/me/courses/course-1/progress', {
      params: undefined,
    });
    expect(getSpy).toHaveBeenNthCalledWith(2, '/courses/course-1/progress', {
      params: undefined,
    });
  });
});
