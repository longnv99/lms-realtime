import type { MyEnrollmentResponse } from '@lms/shared';
import { getEnvelope } from './client';

export async function listMyEnrollments(): Promise<MyEnrollmentResponse[]> {
  return getEnvelope<MyEnrollmentResponse[]>('/me/enrollments');
}
