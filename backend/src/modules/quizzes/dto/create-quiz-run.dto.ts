import { IsString } from 'class-validator';

export class CreateQuizRunDto {
  @IsString()
  quizId!: string;
}
