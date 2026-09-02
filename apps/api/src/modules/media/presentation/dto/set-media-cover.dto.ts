import { IsDefined, IsString, MinLength, ValidateIf } from 'class-validator';
import type { SetMediaCoverInput } from '@salon-spot/contracts';

export class SetMediaCoverDto implements SetMediaCoverInput {
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  mediaId!: string | null;
}
