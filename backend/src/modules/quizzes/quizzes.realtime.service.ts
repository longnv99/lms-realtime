import { Injectable } from '@nestjs/common';
import type {
  QuizFinishedPayload,
  QuizLeaderboardPayload,
  QuizQuestionClosedPayload,
  QuizQuestionPayload,
  QuizRevealPayload,
} from '@lms/shared';

type RoomEmitter = {
  to(room: string): {
    emit(event: string, payload: unknown): void;
  };
};

@Injectable()
export class QuizzesRealtimeService {
  private server?: RoomEmitter;

  registerServer(server: RoomEmitter): void {
    this.server = server;
  }

  emitQuestion(quizRunId: string, payload: QuizQuestionPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:question', payload);
  }

  emitQuestionClosed(quizRunId: string, payload: QuizQuestionClosedPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:question:closed', payload);
  }

  emitReveal(quizRunId: string, payload: QuizRevealPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:reveal', payload);
  }

  emitLeaderboard(quizRunId: string, payload: QuizLeaderboardPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:leaderboard', payload);
  }

  emitFinished(quizRunId: string, payload: QuizFinishedPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:finished', payload);
  }
}
