import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type ArticleDocument = Article & Document;

export enum ArticleCategory {
  SLEEP = 'Sleep',
  EXERCISE = 'Exercise',
  MEDITATION = 'Meditation',
  MOOD_TRACKING = 'Mood Tracking',
  FITNESS = 'Fitness',
  YOGA = 'Yoga',
  ANXIETY = 'Anxiety',
  DEPRESSION = 'Depression',
  STRESS_MANAGEMENT = 'Stress Management',
  SELF_CARE = 'Self-Care',
  RELATIONSHIPS = 'Relationships',
  NUTRITION = 'Nutrition',
  MINDFULNESS = 'Mindfulness',
  THERAPY_COUNSELING = 'Therapy & Counseling',
  PERSONAL_GROWTH = 'Personal Growth',
  WORK_LIFE_BALANCE = 'Work-Life Balance',
  ADDICTION_RECOVERY = 'Addiction Recovery',
  TRAUMA_HEALING = 'Trauma Healing',
  PARENTING_FAMILY = 'Parenting & Family',                                                                                                                      
  GRIEF_LOSS = 'Grief & Loss',
  CBT = 'Cognitive Behavioral Therapy (CBT)',
  OTHER='Other',
}

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Schema({ collection: 'articles', timestamps: true })
export class Article {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  specialist_id: Types.ObjectId;

  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({
    type: String,
    enum: Object.values(ArticleCategory),
    required: true,
    index: true,
  })
  category: ArticleCategory;

  @Prop({ required: true, type: String })
  content: string;

  @Prop()
  featured_image_url?: string;

  @Prop({
    type: String,
    enum: Object.values(ArticleStatus),
    default: ArticleStatus.DRAFT,
    index: true,
  })
  status: ArticleStatus;

  @Prop({ type: Date })
  published_at?: Date;

  @Prop({ type: Number, default: 0 })
  views: number;

  @Prop({ type: Number, default: 0 })
  likes: number;

  @Prop({ type: Number })
  read_time_minutes?: number;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);

ArticleSchema.index({ specialist_id: 1, status: 1 });
ArticleSchema.index({ category: 1, status: 1 });
ArticleSchema.index({ status: 1, published_at: -1 });
ArticleSchema.index({ title: 'text', content: 'text' });

