import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatSendDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
