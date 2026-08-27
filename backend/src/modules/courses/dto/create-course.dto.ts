import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
