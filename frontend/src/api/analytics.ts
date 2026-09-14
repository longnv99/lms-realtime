import type {
  InstructorCourseAnalyticsResponse,
  LearnerCourseAnalyticsResponse,
} from '@lms/shared';
import { apiClient, getEnvelope } from './client';

export async function getMyCourseAnalytics(
  courseId: string,
): Promise<LearnerCourseAnalyticsResponse> {
  return getEnvelope<LearnerCourseAnalyticsResponse>(`/me/courses/${courseId}/analytics`);
}

export async function getInstructorCourseAnalytics(
  courseId: string,
): Promise<InstructorCourseAnalyticsResponse> {
  return getEnvelope<InstructorCourseAnalyticsResponse>(`/courses/${courseId}/analytics`);
}

export async function downloadCourseAnalyticsCsv(
  courseId: string,
  kind: 'students' | 'questions',
): Promise<Blob> {
  const response = await apiClient.get(`/courses/${courseId}/analytics/export`, {
    params: { kind },
    responseType: 'blob',
  });

  return response.data as Blob;
}
