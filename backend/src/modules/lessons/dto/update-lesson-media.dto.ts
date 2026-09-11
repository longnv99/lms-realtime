import { IsOptional, IsString } from 'class-validator';

export class UpdateLessonMediaDto {
  @IsOptional()
  @IsString()
  mediaAssetId?: string | null;
}
