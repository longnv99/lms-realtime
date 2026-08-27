import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizScoringService {
  calculateScore(isCorrect: boolean, questionOpenedAt: Date, answeredAt: Date): number {
    if (!isCorrect) {
      return 0;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((answeredAt.getTime() - questionOpenedAt.getTime()) / 1000),
    );

    return 100 + Math.max(0, 50 - elapsedSeconds);
  }
}
