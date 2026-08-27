import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsDateString()
  startsAt!: string;
}
