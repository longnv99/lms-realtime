export interface LessonNoteResponse {
  id: string;
  userId: string;
  lessonId: string;
  body: string;
  positionSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonNoteInput {
  body: string;
  positionSeconds?: number | null;
}

export interface UpdateLessonNoteInput {
  body: string;
  positionSeconds?: number | null;
}
