import { Transform } from 'class-transformer';
import { REGISTRATION_INTENTS, type RegistrationIntent } from '@salon-spot/contracts';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../../../common/validation/trim-string.transform.js';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Optional only to preserve existing API clients during the onboarding rollout. */
  @IsOptional()
  @IsIn(REGISTRATION_INTENTS)
  onboardingIntent?: RegistrationIntent;
}
