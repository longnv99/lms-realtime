import type {
  QuizOption,
  QuizQuestionPayload,
  QuizRunListItemResponse,
  QuizRunResponse,
  QuizRunStatus,
  QuizWithQuestionsResponse,
} from '@lms/shared';
import { deleteEnvelope, getEnvelope, patchEnvelope, postEnvelope } from './client';
import type { DeletedResponse } from './courses';

export type QuizQuestionInput = {
  correctOptionId: string;
  options: QuizOption[];
  text: string;
};

export type QuizRunStateResponse = {
  currentQuestionIndex: number | null;
  id: string;
  question: QuizQuestionPayload['question'] | null;
  status: QuizRunStatus;
};

export async function listQuizzes(lessonId: string): Promise<QuizWithQuestionsResponse[]> {
  return getEnvelope<QuizWithQuestionsResponse[]>(`/lessons/${lessonId}/quizzes`);
}

export async function createQuiz(
  lessonId: string,
  input: { questions: QuizQuestionInput[]; title: string },
): Promise<QuizWithQuestionsResponse> {
  return postEnvelope<QuizWithQuestionsResponse>(`/lessons/${lessonId}/quizzes`, input);
}

export async function updateQuiz(
  id: string,
  input: { questions?: QuizQuestionInput[]; title?: string },
): Promise<QuizWithQuestionsResponse> {
  return patchEnvelope<QuizWithQuestionsResponse>(`/quizzes/${id}`, input);
}

export async function deleteQuiz(id: string): Promise<DeletedResponse> {
  return deleteEnvelope<DeletedResponse>(`/quizzes/${id}`);
}

export async function createQuizRun(sessionId: string, quizId: string): Promise<QuizRunResponse> {
  return postEnvelope<QuizRunResponse>(`/sessions/${sessionId}/quiz-runs`, { quizId });
}

export async function listQuizRuns(sessionId: string): Promise<QuizRunListItemResponse[]> {
  return getEnvelope<QuizRunListItemResponse[]>(`/sessions/${sessionId}/quiz-runs`);
}

export async function getQuizRunState(id: string): Promise<QuizRunStateResponse> {
  return getEnvelope<QuizRunStateResponse>(`/quiz-runs/${id}/state`);
}

export async function openNextQuestion(id: string): Promise<QuizRunResponse & QuizQuestionPayload> {
  return postEnvelope<QuizRunResponse & QuizQuestionPayload>(`/quiz-runs/${id}/questions/next`);
}

export async function closeQuestion(
  id: string,
): Promise<QuizRunResponse & { answerCount: number; questionId: string }> {
  return postEnvelope<QuizRunResponse & { answerCount: number; questionId: string }>(
    `/quiz-runs/${id}/questions/close`,
  );
}

export async function revealQuestion(
  id: string,
): Promise<
  QuizRunResponse & { correctCount: number; correctOptionId: string; questionId: string }
> {
  return postEnvelope<
    QuizRunResponse & { correctCount: number; correctOptionId: string; questionId: string }
  >(`/quiz-runs/${id}/reveal`);
}

export async function finishQuizRun(id: string): Promise<QuizRunResponse> {
  return postEnvelope<QuizRunResponse>(`/quiz-runs/${id}/finish`);
}
