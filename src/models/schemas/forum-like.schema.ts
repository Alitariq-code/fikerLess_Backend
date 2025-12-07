import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { ForumPost } from './forum-post.schema';

export type ForumLikeDocument = ForumLike & Document;

@Schema({ collection: 'forum_likes', timestamps: true })
export class ForumLike {
  @Prop({ type: Types.ObjectId, ref: ForumPost.name, required: true, index: true })
  post_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;
}

export const ForumLikeSchema = SchemaFactory.createForClass(ForumLike);

// Unique constraint: one user can like a post only once
ForumLikeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
ForumLikeSchema.index({ post_id: 1 });
ForumLikeSchema.index({ user_id: 1 });

