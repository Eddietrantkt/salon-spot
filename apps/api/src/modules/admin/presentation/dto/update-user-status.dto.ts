import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { TrimString } from '../../../../common/validation/trim-string.transform.js';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @TrimString()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;
}
