import { IsEnum, IsString, IsOptional, Matches } from 'class-validator';
import { OverrideType } from '../../models/schemas/availability-override.schema';

export class UpdateAvailabilityOverrideDto {
  @IsOptional()
  @IsString({ message: 'date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @IsOptional()
  @IsEnum(OverrideType, { message: 'type must be either OFF or CUSTOM' })
  type?: OverrideType;

  @IsOptional()
  @IsString({ message: 'start_time must be a string' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'start_time must be in HH:mm format (e.g., 09:00)',
  })
  start_time?: string;

  @IsOptional()
  @IsString({ message: 'end_time must be a string' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'end_time must be in HH:mm format (e.g., 17:00)',
  })
  end_time?: string;

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;
}

