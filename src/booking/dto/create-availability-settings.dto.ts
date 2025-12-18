import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateAvailabilitySettingsDto {
  @IsNumber({}, { message: 'slot_duration_minutes must be a number' })
  @Min(15, { message: 'slot_duration_minutes must be at least 15 minutes' })
  @Max(480, { message: 'slot_duration_minutes must not exceed 480 minutes (8 hours)' })
  slot_duration_minutes: number;

  @IsNumber({}, { message: 'break_minutes must be a number' })
  @Min(0, { message: 'break_minutes must be at least 0' })
  @Max(60, { message: 'break_minutes must not exceed 60 minutes' })
  break_minutes: number;

  @IsOptional()
  @IsString({ message: 'timezone must be a string' })
  timezone?: string;
}

