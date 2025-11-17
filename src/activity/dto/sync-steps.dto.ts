import { IsArray, IsNumber, IsString, IsISO8601, Matches, Min, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class StepsEntryDto {
  @IsNumber()
  @Min(0)
  steps: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @IsISO8601()
  timestamp: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  calories_burned?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  distance_km?: number;
}

export class SyncStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepsEntryDto)
  entries: StepsEntryDto[];
}

