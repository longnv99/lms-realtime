export type QuizRunStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'REVEALED' | 'FINISHED';

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionResponse {
  id: string;
  text: string;
  options: QuizOption[];
  order: number;
}

export interface QuizResponse {
  id: string;
  lessonId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizRunResponse {
  id: string;
  quizId: string;
  sessionId: string;
  currentQuestionIndex: number | null;
  status: QuizRunStatus;
  questionOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizWithQuestionsResponse extends QuizResponse {
  questions: QuizQuestionResponse[];
}

export interface QuizRunListItemResponse extends QuizRunResponse {
  quiz: Pick<QuizResponse, 'id' | 'title'>;
}

export interface QuizReviewQuestionResponse {
  questionId: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  score: number;
  explanation: string | null;
  order: number;
}

export interface QuizReviewResponse {
  quizRunId: string;
  quizId: string;
  quizTitle: string;
  lessonId: string;
  lessonTitle: string;
  status: QuizRunStatus;
  startedAt: string;
  finishedAt: string | null;
  totalScore: number;
  questionCount: number;
  correctCount: number;
  questions: QuizReviewQuestionResponse[];
}

export interface CourseQuizReviewResponse {
  courseId: string;
  reviews: QuizReviewResponse[];
}
