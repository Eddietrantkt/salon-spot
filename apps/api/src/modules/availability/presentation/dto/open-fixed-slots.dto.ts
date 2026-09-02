import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsIn, Matches } from 'class-validator';
import { FIXED_SLOT_PERIODS, type FixedSlotPeriod } from '@salon-spot/contracts';

export class FixedSlotsDateQueryDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate!: string;
}

export class ManageFixedSlotsDto extends FixedSlotsDateQueryDto {

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(FIXED_SLOT_PERIODS, { each: true })
  periods!: FixedSlotPeriod[];
}
