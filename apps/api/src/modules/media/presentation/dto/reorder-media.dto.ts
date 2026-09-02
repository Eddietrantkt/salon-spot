import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';
import type { ReorderMediaInput } from '@salon-spot/contracts';

export class ReorderMediaDto implements ReorderMediaInput {
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  mediaIds!: string[];
}
