import type { CourseProgressResponse, InstructorCourseProgressResponse } from '@lms/shared';
import { getEnvelope } from './client';

export async function getMyCourseProgress(courseId: string): Promise<CourseProgressResponse> {
  return getEnvelope<CourseProgressResponse>(`/me/courses/${courseId}/progress`);
}

export async function getCourseProgress(
  courseId: string,
): Promise<InstructorCourseProgressResponse> {
  return getEnvelope<InstructorCourseProgressResponse>(`/courses/${courseId}/progress`);
}
