import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { NotificationReadStatus } from '@salon-spot/contracts';

export class NotificationQueryDto {
  @IsOptional()
  @IsIn(['read', 'unread'])
  status?: NotificationReadStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
