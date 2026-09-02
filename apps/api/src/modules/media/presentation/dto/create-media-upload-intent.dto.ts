import { IsIn } from 'class-validator';
import type { CreateMediaUploadIntentInput } from '@salon-spot/contracts';

export class CreateMediaUploadIntentDto implements CreateMediaUploadIntentInput {
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: 'image/jpeg' | 'image/png' | 'image/webp';
}
