import axios from 'axios';
import type { HealthResponse } from '@lms/shared';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10_000,
});

interface Envelope<T> {
  success: boolean;
  data: T;
  error: null | { code: string; message: string };
  meta: unknown;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<Envelope<HealthResponse>>('/health');
  if (!res.data.success) {
    throw new Error(res.data.error?.message ?? 'Health check failed');
  }
  return res.data.data;
}
