import type {
  CourseProgressResponse,
  InstructorCourseProgressResponse,
  LessonProgressResponse,
  UpdateLessonProgressInput,
} from '@lms/shared';
import { getEnvelope, patchEnvelope } from './client';

export async function getMyCourseProgress(courseId: string): Promise<CourseProgressResponse> {
  return getEnvelope<CourseProgressResponse>(`/me/courses/${courseId}/progress`);
}

export async function getCourseProgress(
  courseId: string,
): Promise<InstructorCourseProgressResponse> {
  return getEnvelope<InstructorCourseProgressResponse>(`/courses/${courseId}/progress`);
}

export async function updateLessonProgress(
  lessonId: string,
  input: UpdateLessonProgressInput,
): Promise<LessonProgressResponse> {
  return patchEnvelope<LessonProgressResponse>(`/me/lessons/${lessonId}/progress`, input);
}
