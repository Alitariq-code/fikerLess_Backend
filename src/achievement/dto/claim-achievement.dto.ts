import { IsMongoId } from 'class-validator';

export class ClaimAchievementDto {
  @IsMongoId({ message: 'Invalid achievement ID format' })
  id: string;
}

