import { IsNumber, IsString, IsISO8601, Matches, Min, IsOptional } from 'class-validator';

export class CreateStepsDto {
  @IsNumber()
  @Min(0)
  steps: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  date?: string;

  @IsString()
  @IsISO8601()
  @IsOptional()
  timestamp?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  calories_burned?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  distance_km?: number;
}

