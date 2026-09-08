import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthTokensResponse } from '@lms/shared';
import {
  apiClient,
  getEnvelope,
  setAccessTokenGetter,
  setAuthRefreshHandlers,
  unwrapEnvelope,
} from './client';
import { completeMediaUpload, createMediaUpload, getMediaPlayback } from './media';
import { getCourseProgress, getMyCourseProgress } from './progress';

describe('unwrapEnvelope', () => {
  afterEach(() => {
    apiClient.defaults.adapter = undefined;
    setAccessTokenGetter(() => null);
    setAuthRefreshHandlers({
      getRefreshToken: () => null,
      onRefreshFailure: () => undefined,
      onRefreshSuccess: () => undefined,
    });
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

  it('refreshes an expired access token and retries the original request', async () => {
    let currentAccessToken = 'expired-access';
    const refreshSuccess = vi.fn((tokens: AuthTokensResponse) => {
      currentAccessToken = tokens.accessToken;
    });
    const refreshFailure = vi.fn();
    const refreshedTokens = authTokens({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        return jsonResponse(config, 201, {
          success: true,
          data: refreshedTokens,
          error: null,
          meta: null,
        });
      }

      if (config.url === '/me/notifications' && currentAccessToken === 'expired-access') {
        throw unauthorizedError(config);
      }

      return jsonResponse(config, 200, {
        success: true,
        data: [{ id: 'notification-1' }],
        error: null,
        meta: null,
      });
    });
    apiClient.defaults.adapter = adapter as AxiosAdapter;
    setAccessTokenGetter(() => currentAccessToken);
    setAuthRefreshHandlers({
      getRefreshToken: () => 'old-refresh',
      onRefreshFailure: refreshFailure,
      onRefreshSuccess: refreshSuccess,
    });

    await expect(getEnvelope('/me/notifications')).resolves.toEqual([{ id: 'notification-1' }]);

    expect(adapter).toHaveBeenCalledTimes(3);
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: '{"refreshToken":"old-refresh"}',
        url: '/auth/refresh',
      }),
    );
    expect(refreshSuccess).toHaveBeenCalledWith(refreshedTokens);
    expect(refreshFailure).not.toHaveBeenCalled();
    expect(getAuthorizationHeader(adapter.mock.calls[2][0])).toBe('Bearer fresh-access');
  });

  it('logs out locally when refresh token rotation fails', async () => {
    const refreshFailure = vi.fn();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        throw unauthorizedError(config);
      }

      throw unauthorizedError(config);
    });
    apiClient.defaults.adapter = adapter as AxiosAdapter;
    setAccessTokenGetter(() => 'expired-access');
    setAuthRefreshHandlers({
      getRefreshToken: () => 'revoked-refresh',
      onRefreshFailure: refreshFailure,
      onRefreshSuccess: () => undefined,
    });

    await expect(getEnvelope('/me/notifications')).rejects.toThrow('Refresh failed');

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(refreshFailure).toHaveBeenCalledTimes(1);
  });
});

function authTokens(overrides: Partial<AuthTokensResponse> = {}): AuthTokensResponse {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      email: 'student@example.com',
      id: 'student-1',
      name: 'Student',
      role: 'STUDENT',
    },
    ...overrides,
  };
}

function jsonResponse<T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: statusText(status),
  };
}

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError(
    'Refresh failed',
    AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    jsonResponse(config, 401, {
      success: false,
      data: null,
      error: { code: 'AUTH_UNAUTHENTICATED', message: 'Unauthorized' },
      meta: null,
    }),
  );
}

function getAuthorizationHeader(config: InternalAxiosRequestConfig): string | undefined {
  const headers = config.headers;
  const value = typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization;
  return typeof value === 'string' ? value : undefined;
}

function statusText(status: number): string {
  if (status === 201) {
    return 'Created';
  }

  if (status === 401) {
    return 'Unauthorized';
  }

  return 'OK';
}
