export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CourseResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
  instructorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
