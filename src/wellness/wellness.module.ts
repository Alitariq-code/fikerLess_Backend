import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WellnessController } from './wellness.controller';
import { WellnessService } from './wellness.service';
import { UserPlant, UserPlantSchema } from '../models/schemas/user-plant.schema';
import { WeeklyGoal, WeeklyGoalSchema } from '../models/schemas/weekly-goal.schema';
import { UserAchievement, UserAchievementSchema } from '../models/schemas/user-achievement.schema';
import { Achievement, AchievementSchema } from '../models/schemas/achievement.schema';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserPlant.name, schema: UserPlantSchema },
      { name: WeeklyGoal.name, schema: WeeklyGoalSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: Steps.name, schema: StepsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WellnessController],
  providers: [WellnessService],
  exports: [WellnessService],
})
export class WellnessModule {}

