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

export interface LessonTranscriptCueResponse {
  id: string;
  lessonId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonTranscriptResponse {
  lessonId: string;
  cues: LessonTranscriptCueResponse[];
}

export interface ReplaceLessonTranscriptInput {
  cues: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
}
