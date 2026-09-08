import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationLocale } from '@prisma/client';
import type { UpdateNotificationPreferencesInput } from '@salon-spot/contracts';

export class UpdateNotificationPreferencesDto implements UpdateNotificationPreferencesInput {
  @IsOptional()
  @IsEnum(NotificationLocale)
  locale?: NotificationLocale;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEnabled?: boolean;
}
