import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementController } from './achievement.controller';
import { AchievementAdminController } from './achievement-admin.controller';
import { AchievementService } from './achievement.service';
import { Achievement, AchievementSchema } from '../models/schemas/achievement.schema';
import { UserAchievement, UserAchievementSchema } from '../models/schemas/user-achievement.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { ForumPost, ForumPostSchema } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentSchema } from '../models/schemas/forum-comment.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Achievement.name, schema: AchievementSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: User.name, schema: UserSchema },
      { name: ForumPost.name, schema: ForumPostSchema },
      { name: ForumComment.name, schema: ForumCommentSchema },
    ]),
    NotificationModule,
  ],
  controllers: [AchievementController, AchievementAdminController],
  providers: [AchievementService],
  exports: [AchievementService], // Export so other services can use it
})
export class AchievementModule {}

