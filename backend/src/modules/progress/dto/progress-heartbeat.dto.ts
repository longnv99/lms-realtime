import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class ProgressHeartbeatDto {
  @IsString()
  lessonId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  positionSeconds!: number;
}
