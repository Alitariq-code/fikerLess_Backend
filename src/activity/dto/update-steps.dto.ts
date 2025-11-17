import { IsNumber, IsString, Matches, Min, IsOptional } from 'class-validator';

export class UpdateStepsDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  steps?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  date?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  calories_burned?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  distance_km?: number;
}

