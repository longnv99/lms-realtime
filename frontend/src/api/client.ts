import axios from 'axios';
import type { ApiEnvelope, HealthResponse } from '@lms/shared';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

let accessTokenGetter: (() => string | null) | null = null;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10_000,
});

apiClient.interceptors.request.use((config) => {
  const token = accessTokenGetter?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function setAccessTokenGetter(getter: () => string | null): void {
  accessTokenGetter = getter;
}

export function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success || envelope.data === null) {
    throw new Error(normalizeApiError(envelope.error?.code, envelope.error?.message));
  }

  return envelope.data;
}

export function unwrapVoidEnvelope(envelope: ApiEnvelope<unknown>): void {
  if (!envelope.success) {
    throw new Error(normalizeApiError(envelope.error?.code, envelope.error?.message));
  }
}

function normalizeApiError(code?: string, message?: string): string {
  if (code === 'AUTH_INVALID_CREDENTIALS') {
    return 'Email or password is incorrect.';
  }

  return message ?? 'Request failed.';
}

export async function getEnvelope<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return unwrapEnvelope(res.data);
}

export async function postEnvelope<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<ApiEnvelope<T>>(path, body);
  return unwrapEnvelope(res.data);
}

export async function patchEnvelope<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiEnvelope<T>>(path, body);
  return unwrapEnvelope(res.data);
}

export async function deleteEnvelope<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.delete<ApiEnvelope<T>>(path, { data: body });
  return unwrapEnvelope(res.data);
}

export async function postVoidEnvelope(path: string, body?: unknown): Promise<void> {
  const res = await apiClient.post<ApiEnvelope<unknown>>(path, body);
  unwrapVoidEnvelope(res.data);
}

export async function checkHealth(): Promise<HealthResponse> {
  return getEnvelope<HealthResponse>('/health');
}
