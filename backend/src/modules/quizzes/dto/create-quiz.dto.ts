import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class QuizOptionDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}

export class QuizQuestionDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options!: QuizOptionDto[];

  @IsString()
  correctOptionId!: string;
}

export class CreateQuizDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}
