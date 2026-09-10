import type { CourseResponse } from './courses';

export interface EnrollmentResponse {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
}

export interface MyEnrollmentResponse extends EnrollmentResponse {
  course: CourseResponse;
}
