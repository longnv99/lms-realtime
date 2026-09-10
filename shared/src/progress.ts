export interface LessonProgressResponse {
  lessonId: string;
  title: string;
  durationSeconds: number;
  positionSeconds: number;
  completedAt: string | null;
  lastWatchedAt: string | null;
}

export interface CourseProgressResponse {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  lessons: LessonProgressResponse[];
}

export interface InstructorCourseProgressStudentResponse {
  userId: string;
  name: string;
  email: string;
  completedLessons: number;
  percent: number;
  lastWatchedAt: string | null;
}

export interface InstructorCourseProgressResponse {
  courseId: string;
  totalLessons: number;
  students: InstructorCourseProgressStudentResponse[];
}

export interface UpdateLessonProgressInput {
  positionSeconds?: number;
  completed?: boolean;
}
