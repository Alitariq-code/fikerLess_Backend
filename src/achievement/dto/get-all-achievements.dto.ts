import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserAchievementStatus } from '../../models/schemas/user-achievement.schema';

export class GetAllAchievementsDto {
  @IsOptional()
  @IsEnum(UserAchievementStatus, { message: 'Invalid status filter' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number;
}

