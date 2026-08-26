export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface SessionResponse {
  id: string;
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}
