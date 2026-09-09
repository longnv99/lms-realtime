import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import type { UpdateLessonProgressInput } from '@lms/shared';

export class UpdateLessonProgressDto implements UpdateLessonProgressInput {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  positionSeconds?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
