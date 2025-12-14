import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, MinLength, Min } from 'class-validator';
import { AchievementCategory, AchievementConditionType } from '../../models/schemas/achievement.schema';

export class UpdateAchievementDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name cannot be empty' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Description cannot be empty' })
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Icon cannot be empty' })
  icon?: string;

  @IsOptional()
  @IsEnum(AchievementCategory, { message: 'Invalid category' })
  category?: AchievementCategory;

  @IsOptional()
  @IsEnum(AchievementConditionType, { message: 'Invalid condition type' })
  condition_type?: AchievementConditionType;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Condition value must be at least 1' })
  condition_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'XP reward cannot be negative' })
  xp_reward?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Order cannot be negative' })
  order?: number;
}

