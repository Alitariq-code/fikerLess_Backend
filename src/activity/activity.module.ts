import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StepsController } from './steps.controller';
import { StepsService } from './steps.service';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { AchievementModule } from '../achievement/achievement.module';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Steps.name, schema: StepsSchema },
      { name: User.name, schema: UserSchema }
    ]),
    forwardRef(() => AchievementModule),
    forwardRef(() => GoalsModule),
  ],
  controllers: [StepsController],
  providers: [StepsService],
  exports: [StepsService],
})
export class ActivityModule {}

