import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { ForumPost } from './forum-post.schema';

export type ForumCommentDocument = ForumComment & Document;

@Schema({ collection: 'forum_comments', timestamps: true })
export class ForumComment {
  @Prop({ type: Types.ObjectId, ref: ForumPost.name, required: true, index: true })
  post_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, minlength: 1, maxlength: 1000 })
  content: string;

  @Prop({ type: Boolean, default: false })
  is_anonymous: boolean;

  // Reply functionality
  @Prop({ type: Types.ObjectId, ref: 'ForumComment', index: true })
  parent_comment_id?: Types.ObjectId;

  // Likes functionality
  @Prop({ type: Number, default: 0 })
  likes_count: number;
}

export const ForumCommentSchema = SchemaFactory.createForClass(ForumComment);

// Indexes for efficient queries
ForumCommentSchema.index({ post_id: 1, parent_comment_id: 1, createdAt: -1 }); // For getting top-level comments and replies
ForumCommentSchema.index({ post_id: 1, createdAt: -1 }); // For getting all comments on a post
ForumCommentSchema.index({ parent_comment_id: 1, createdAt: 1 }); // For getting replies to a comment
ForumCommentSchema.index({ user_id: 1 });

