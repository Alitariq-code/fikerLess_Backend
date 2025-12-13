import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumPost, ForumPostSchema } from '../models/schemas/forum-post.schema';
import { ForumLike, ForumLikeSchema } from '../models/schemas/forum-like.schema';
import { ForumComment, ForumCommentSchema } from '../models/schemas/forum-comment.schema';
import { ForumCommentLike, ForumCommentLikeSchema } from '../models/schemas/forum-comment-like.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { NotificationModule } from '../notification/notification.module';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ForumPost.name, schema: ForumPostSchema },
      { name: ForumLike.name, schema: ForumLikeSchema },
      { name: ForumComment.name, schema: ForumCommentSchema },
      { name: ForumCommentLike.name, schema: ForumCommentLikeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationModule,
    forwardRef(() => AchievementModule),
  ],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}

