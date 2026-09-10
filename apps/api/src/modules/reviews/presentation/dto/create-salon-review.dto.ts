import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CreateSalonReviewInput } from '@salon-spot/contracts';

export class CreateSalonReviewDto implements CreateSalonReviewInput {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}
