export interface LessonResponse {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  durationSeconds: number;
  mediaAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}
