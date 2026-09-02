import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { TrimString } from '../../../../common/validation/trim-string.transform.js';

export class CreateWorkspaceDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  rentalLabel!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceCents!: number;
}

export class CreateSalonWithWorkspaceDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  area!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @ValidateNested()
  @Type(() => CreateWorkspaceDto)
  workspace!: CreateWorkspaceDto;
}
