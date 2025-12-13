import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { ForumComment } from './forum-comment.schema';

export type ForumCommentLikeDocument = ForumCommentLike & Document;

@Schema({ collection: 'forum_comment_likes', timestamps: true })
export class ForumCommentLike {
  @Prop({ type: Types.ObjectId, ref: ForumComment.name, required: true, index: true })
  comment_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;
}

export const ForumCommentLikeSchema = SchemaFactory.createForClass(ForumCommentLike);

// Unique constraint: one user can like a comment only once
ForumCommentLikeSchema.index({ comment_id: 1, user_id: 1 }, { unique: true });
ForumCommentLikeSchema.index({ comment_id: 1 });
ForumCommentLikeSchema.index({ user_id: 1 });

