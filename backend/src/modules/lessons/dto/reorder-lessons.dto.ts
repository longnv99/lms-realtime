import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class ReorderLessonItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(1)
  order!: number;
}

export class ReorderLessonsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonItemDto)
  items!: ReorderLessonItemDto[];
}
