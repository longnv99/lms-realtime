import { IsUUID } from 'class-validator';

export class QuizJoinDto {
  @IsUUID()
  quizRunId!: string;
}
