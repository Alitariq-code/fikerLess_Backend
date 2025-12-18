import { IsEnum, IsString, IsBoolean, IsOptional, Matches } from 'class-validator';
import { DayOfWeek } from '../../models/schemas/availability-rule.schema';

export class CreateAvailabilityRuleDto {
  @IsEnum(DayOfWeek, { message: 'day_of_week must be one of: MON, TUE, WED, THU, FRI, SAT, SUN' })
  day_of_week: DayOfWeek;

  @IsString({ message: 'start_time must be a string' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'start_time must be in HH:mm format (e.g., 09:00)',
  })
  start_time: string;

  @IsString({ message: 'end_time must be a string' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'end_time must be in HH:mm format (e.g., 17:00)',
  })
  end_time: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;
}

