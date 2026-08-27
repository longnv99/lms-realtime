import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsIn(['SCHEDULED', 'CANCELLED'])
  status?: 'SCHEDULED' | 'CANCELLED';
}
