import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User, UserSchema } from '../models/schemas/user.schema';
import { Demographics, DemographicsSchema } from '../models/schemas/demographics.schema';
import { Session, SessionSchema } from '../models/schemas/session.schema';
import { SessionRequest, SessionRequestSchema } from '../models/schemas/session-request.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../models/schemas/specialist-profile.schema';
import { Journal, JournalSchema } from '../models/schemas/journal.schema';
import { Mood, MoodSchema } from '../models/schemas/mood.schema';
import { Goal, GoalSchema } from '../models/schemas/goal.schema';
import { Article, ArticleSchema } from '../models/schemas/article.schema';
import { Audio, AudioSchema } from '../models/schemas/audio.schema';
import { ForumPost, ForumPostSchema } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentSchema } from '../models/schemas/forum-comment.schema';
import { ForumLike, ForumLikeSchema } from '../models/schemas/forum-like.schema';
import { Quote, QuoteSchema } from '../models/schemas/quote.schema';
import { NotificationTemplate, NotificationTemplateSchema } from '../models/schemas/notification-template.schema';
import { Internship, InternshipSchema } from '../models/schemas/internship.schema';
import { UserNotification, UserNotificationSchema } from '../models/schemas/user-notification.schema';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { UserAchievement, UserAchievementSchema } from '../models/schemas/user-achievement.schema';
import { Achievement, AchievementSchema } from '../models/schemas/achievement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Demographics.name, schema: DemographicsSchema },
      { name: Session.name, schema: SessionSchema },
      { name: SessionRequest.name, schema: SessionRequestSchema },
      { name: SpecialistProfile.name, schema: SpecialistProfileSchema },
      { name: Journal.name, schema: JournalSchema },
      { name: Mood.name, schema: MoodSchema },
      { name: Goal.name, schema: GoalSchema },
      { name: Article.name, schema: ArticleSchema },
      { name: Audio.name, schema: AudioSchema },
      { name: ForumPost.name, schema: ForumPostSchema },
      { name: ForumComment.name, schema: ForumCommentSchema },
      { name: ForumLike.name, schema: ForumLikeSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: Internship.name, schema: InternshipSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
      { name: Steps.name, schema: StepsSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: Achievement.name, schema: AchievementSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

