import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { UserRole } from '@lms/shared';

const USER_ROLES: UserRole[] = ['ADMIN', 'INSTRUCTOR', 'STUDENT'];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
