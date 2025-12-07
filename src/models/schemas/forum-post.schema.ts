import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { ArticleCategory } from './article.schema';

export type ForumPostDocument = ForumPost & Document;

@Schema({ collection: 'forum_posts', timestamps: true })
export class ForumPost {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, minlength: 3, maxlength: 200 })
  title: string;

  @Prop({ required: true, minlength: 10 })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(ArticleCategory),
    required: true,
    index: true,
  })
  category: ArticleCategory;

  @Prop({ type: Boolean, default: false })
  is_anonymous: boolean;

  @Prop({ type: Number, default: 0 })
  likes_count: number;

  @Prop({ type: Number, default: 0 })
  comments_count: number;

  @Prop({ type: Number, default: 0 })
  views: number;
}

export const ForumPostSchema = SchemaFactory.createForClass(ForumPost);

ForumPostSchema.index({ user_id: 1 });
ForumPostSchema.index({ category: 1 });
ForumPostSchema.index({ title: 'text', description: 'text' });
ForumPostSchema.index({ createdAt: -1 });


