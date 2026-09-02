import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsString, Matches } from 'class-validator';

export class SearchWorkspacesQuery {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  area!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
