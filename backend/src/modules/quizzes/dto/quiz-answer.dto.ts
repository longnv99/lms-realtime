import { IsString, IsUUID, MinLength } from 'class-validator';

export class QuizAnswerDto {
  @IsUUID()
  quizRunId!: string;

  @IsUUID()
  questionId!: string;

  @IsString()
  @MinLength(1)
  optionId!: string;
}
