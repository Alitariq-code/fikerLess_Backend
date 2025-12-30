import { IsString, IsEnum, IsOptional, MinLength, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';
import { GoalCategory, GoalFrequency } from '../../models/schemas/goal.schema';

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title must be at least 1 character long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsEnum(GoalCategory, { message: 'Invalid category' })
  category?: GoalCategory;

  @ValidateIf((o) => o.category === 'Other')
  @IsNotEmpty({ message: 'custom_category is required when category is "Other"' })
  @IsString()
  @IsOptional()
  custom_category?: string;

  @IsOptional()
  @IsEnum(GoalFrequency, { message: 'Invalid frequency' })
  frequency?: GoalFrequency;

  @IsOptional()
  target_streak?: number;
}


