import type { NotificationResponse } from '@lms/shared';
import { getEnvelope, patchEnvelope } from './client';

export async function listNotifications(): Promise<NotificationResponse[]> {
  return getEnvelope<NotificationResponse[]>('/me/notifications');
}

export async function markNotificationRead(id: string): Promise<NotificationResponse> {
  return patchEnvelope<NotificationResponse>(`/me/notifications/${id}/read`);
}
