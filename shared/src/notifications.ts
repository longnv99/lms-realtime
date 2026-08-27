export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationResponse extends NotificationPayload {
  readAt: string | null;
}
