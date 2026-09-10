import type {
  CreateLessonNoteInput,
  LessonNoteResponse,
  LessonTranscriptResponse,
  UpdateLessonNoteInput,
} from '@lms/shared';
import { apiClient, getEnvelope, patchEnvelope, postEnvelope } from './client';

export async function listLessonNotes(lessonId: string): Promise<LessonNoteResponse[]> {
  return getEnvelope<LessonNoteResponse[]>(`/me/lessons/${lessonId}/notes`);
}

export async function createLessonNote(
  lessonId: string,
  input: CreateLessonNoteInput,
): Promise<LessonNoteResponse> {
  return postEnvelope<LessonNoteResponse>(`/me/lessons/${lessonId}/notes`, input);
}

export async function updateLessonNote(
  noteId: string,
  input: UpdateLessonNoteInput,
): Promise<LessonNoteResponse> {
  return patchEnvelope<LessonNoteResponse>(`/me/lesson-notes/${noteId}`, input);
}

export async function deleteLessonNote(noteId: string): Promise<void> {
  await apiClient.delete(`/me/lesson-notes/${noteId}`);
}

export async function getLessonTranscript(lessonId: string): Promise<LessonTranscriptResponse> {
  return getEnvelope<LessonTranscriptResponse>(`/lessons/${lessonId}/transcript`);
}
