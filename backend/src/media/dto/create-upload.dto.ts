import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
