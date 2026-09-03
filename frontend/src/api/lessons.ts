import type { LessonResponse } from '@lms/shared';
import { deleteEnvelope, getEnvelope, patchEnvelope, postEnvelope } from './client';
import type { DeletedResponse } from './courses';

export type LessonInput = {
  description?: string;
  durationSeconds?: number;
  mediaAssetId?: string;
  title: string;
};

export async function listLessons(courseId: string): Promise<LessonResponse[]> {
  return getEnvelope<LessonResponse[]>(`/courses/${courseId}/lessons`);
}

export async function createLesson(courseId: string, input: LessonInput): Promise<LessonResponse> {
  return postEnvelope<LessonResponse>(`/courses/${courseId}/lessons`, input);
}

export async function updateLesson(
  id: string,
  input: Partial<LessonInput>,
): Promise<LessonResponse> {
  return patchEnvelope<LessonResponse>(`/lessons/${id}`, input);
}

export async function deleteLesson(id: string): Promise<DeletedResponse> {
  return deleteEnvelope<DeletedResponse>(`/lessons/${id}`);
}

export async function reorderLessons(
  courseId: string,
  items: Array<{ id: string; order: number }>,
): Promise<LessonResponse[]> {
  return patchEnvelope<LessonResponse[]>(`/courses/${courseId}/lessons/reorder`, { items });
}
