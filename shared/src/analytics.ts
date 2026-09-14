export interface LearnerQuizAttemptAnalytics {
  quizRunId: string;
  quizTitle: string;
  lessonId: string;
  lessonTitle: string;
  finishedAt: string | null;
  totalScore: number;
  correctCount: number;
  questionCount: number;
  percentCorrect: number;
  rank: number | null;
  participantCount: number;
}

export interface LearnerCourseAnalyticsResponse {
  courseId: string;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  quizRunsTaken: number;
  averageQuizScore: number;
  bestQuizScore: number;
  lastActivityAt: string | null;
  quizAttempts: LearnerQuizAttemptAnalytics[];
}

export interface InstructorLessonCompletionAnalytics {
  lessonId: string;
  lessonTitle: string;
  completedStudents: number;
  totalStudents: number;
  completionPercent: number;
  averagePositionSeconds: number;
}

export interface InstructorQuestionPerformanceAnalytics {
  quizId: string;
  quizTitle: string;
  quizRunId: string;
  questionId: string;
  questionText: string;
  correctCount: number;
  answerCount: number;
  correctPercent: number;
}

export interface InstructorStudentAnalyticsSummary {
  userId: string;
  name: string;
  email: string;
  completionPercent: number;
  completedLessons: number;
  quizRunsTaken: number;
  averageQuizScore: number;
  lastActivityAt: string | null;
}

export interface InstructorCourseAnalyticsResponse {
  courseId: string;
  totalStudents: number;
  activeStudents: number;
  averageCompletionPercent: number;
  completedStudents: number;
  averageQuizScore: number;
  quizParticipationRate: number;
  lessonCompletions: InstructorLessonCompletionAnalytics[];
  questionPerformance: InstructorQuestionPerformanceAnalytics[];
  studentSummaries: InstructorStudentAnalyticsSummary[];
}
