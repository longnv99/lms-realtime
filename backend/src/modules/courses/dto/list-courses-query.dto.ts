import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { CourseStatus } from '@lms/shared';

const COURSE_STATUSES: CourseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export class ListCoursesQueryDto {
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: CourseStatus;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
