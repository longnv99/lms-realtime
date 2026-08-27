export interface SessionJoinPayload {
  sessionId: string;
}

export interface SessionStatePayload {
  id: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  participantCount: number;
}

export interface ChatSendPayload {
  sessionId: string;
  content: string;
}

export interface ChatMessagePayload {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface QuizJoinPayload {
  quizRunId: string;
}

export interface QuizAnswerPayload {
  quizRunId: string;
  questionId: string;
  optionId: string;
}

export interface QuizQuestionPayload {
  currentQuestionIndex: number;
  question: {
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
  };
}

export interface QuizQuestionClosedPayload {
  questionId: string;
  answerCount: number;
}

export interface QuizRevealPayload {
  questionId: string;
  correctOptionId: string;
  correctCount: number;
}

export interface QuizLeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
}

export interface QuizLeaderboardPayload {
  entries: QuizLeaderboardEntry[];
}

export interface QuizFinishedPayload {
  summaryUrl: string;
}
