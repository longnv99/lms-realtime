import type { SessionResponse, SessionStatePayload, SessionStatus } from '@lms/shared';
import { deleteEnvelope, getEnvelope, patchEnvelope, postEnvelope } from './client';
import type { DeletedResponse } from './courses';

export type SessionInput = {
  startsAt: string;
  title: string;
};

export type SessionUpdateInput = Partial<SessionInput> & {
  status?: SessionStatus;
};

export async function listSessions(courseId: string): Promise<SessionResponse[]> {
  return getEnvelope<SessionResponse[]>(`/courses/${courseId}/sessions`);
}

export async function createSession(
  courseId: string,
  input: SessionInput,
): Promise<SessionResponse> {
  return postEnvelope<SessionResponse>(`/courses/${courseId}/sessions`, input);
}

export async function updateSession(
  id: string,
  input: SessionUpdateInput,
): Promise<SessionResponse> {
  return patchEnvelope<SessionResponse>(`/sessions/${id}`, input);
}

export async function deleteSession(id: string): Promise<DeletedResponse> {
  return deleteEnvelope<DeletedResponse>(`/sessions/${id}`);
}

export async function startSession(id: string): Promise<SessionResponse> {
  return postEnvelope<SessionResponse>(`/sessions/${id}/start`);
}

export async function endSession(id: string): Promise<SessionResponse> {
  return postEnvelope<SessionResponse>(`/sessions/${id}/end`);
}

export async function getSessionState(id: string): Promise<SessionStatePayload> {
  return getEnvelope<SessionStatePayload>(`/sessions/${id}/state`);
}
