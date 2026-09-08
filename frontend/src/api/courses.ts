import type { CourseResponse, CourseStatus } from '@lms/shared';
import { deleteEnvelope, getEnvelope, patchEnvelope, postEnvelope } from './client';

export type ListCoursesParams = {
  keyword?: string;
  limit?: number;
  page?: number;
  status?: CourseStatus;
};

export type CourseInput = {
  description?: string;
  slug: string;
  title: string;
};

export type DeletedResponse = {
  deleted: true;
};

export async function listCourses(params: ListCoursesParams = {}): Promise<CourseResponse[]> {
  return getEnvelope<CourseResponse[]>('/courses', params);
}

export async function getCourse(id: string): Promise<CourseResponse> {
  return getEnvelope<CourseResponse>(`/courses/${id}`);
}

export async function createCourse(input: CourseInput): Promise<CourseResponse> {
  return postEnvelope<CourseResponse>('/courses', input);
}

export async function updateCourse(
  id: string,
  input: Partial<CourseInput>,
): Promise<CourseResponse> {
  return patchEnvelope<CourseResponse>(`/courses/${id}`, input);
}

export async function deleteCourse(id: string): Promise<DeletedResponse> {
  return deleteEnvelope<DeletedResponse>(`/courses/${id}`);
}

export async function publishCourse(id: string): Promise<CourseResponse> {
  return postEnvelope<CourseResponse>(`/courses/${id}/publish`);
}

export async function unpublishCourse(id: string): Promise<CourseResponse> {
  return postEnvelope<CourseResponse>(`/courses/${id}/unpublish`);
}

export async function enrollCourse(courseId: string): Promise<{ id: string }> {
  return postEnvelope<{ id: string }>(`/courses/${courseId}/enroll`);
}

export async function unenrollCourse(courseId: string): Promise<DeletedResponse> {
  return deleteEnvelope<DeletedResponse>(`/courses/${courseId}/enroll`);
}
