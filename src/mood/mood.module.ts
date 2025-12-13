import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoodController } from './mood.controller';
import { MoodService } from './mood.service';
import { Mood, MoodSchema } from '../models/schemas/mood.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { AchievementModule } from '../achievement/achievement.module';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mood.name, schema: MoodSchema },
      { name: User.name, schema: UserSchema },
      { name: Steps.name, schema: StepsSchema },
    ]),
    forwardRef(() => AchievementModule),
    forwardRef(() => GoalsModule),
  ],
  controllers: [MoodController],
  providers: [MoodService],
  exports: [MoodService],
})
export class MoodModule {}

