import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../models/schemas/specialist-profile.schema';
import { Demographics, DemographicsSchema } from '../models/schemas/demographics.schema';
import { Journal, JournalSchema } from '../models/schemas/journal.schema';
import { Mood, MoodSchema } from '../models/schemas/mood.schema';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { Goal, GoalSchema } from '../models/schemas/goal.schema';
import { UserAchievement, UserAchievementSchema } from '../models/schemas/user-achievement.schema';
import { UserPlant, UserPlantSchema } from '../models/schemas/user-plant.schema';
import { WeeklyGoal, WeeklyGoalSchema } from '../models/schemas/weekly-goal.schema';
import { ForumPost, ForumPostSchema } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentSchema } from '../models/schemas/forum-comment.schema';
import { ForumLike, ForumLikeSchema } from '../models/schemas/forum-like.schema';
import { ForumCommentLike, ForumCommentLikeSchema } from '../models/schemas/forum-comment-like.schema';
import { UserNotification, UserNotificationSchema } from '../models/schemas/user-notification.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SpecialistProfile.name, schema: SpecialistProfileSchema },
      { name: Demographics.name, schema: DemographicsSchema },
      { name: Journal.name, schema: JournalSchema },
      { name: Mood.name, schema: MoodSchema },
      { name: Steps.name, schema: StepsSchema },
      { name: Goal.name, schema: GoalSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: UserPlant.name, schema: UserPlantSchema },
      { name: WeeklyGoal.name, schema: WeeklyGoalSchema },
      { name: ForumPost.name, schema: ForumPostSchema },
      { name: ForumComment.name, schema: ForumCommentSchema },
      { name: ForumLike.name, schema: ForumLikeSchema },
      { name: ForumCommentLike.name, schema: ForumCommentLikeSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
    ]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

