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
}

export const ForumCommentSchema = SchemaFactory.createForClass(ForumComment);

ForumCommentSchema.index({ post_id: 1, createdAt: -1 });
ForumCommentSchema.index({ user_id: 1 });

