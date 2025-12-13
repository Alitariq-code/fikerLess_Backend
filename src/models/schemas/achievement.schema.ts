import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AchievementDocument = Achievement & Document;

export enum AchievementCategory {
  STREAK = 'streak',
  COMMUNITY = 'community',
  ACTIVITY = 'activity',
  MILESTONE = 'milestone',
}

export enum AchievementConditionType {
  STREAK_DAYS = 'streak_days',
  FORUM_HELPS = 'forum_helps',
  STEPS_TOTAL = 'steps_total',
  MOOD_DAYS = 'mood_days',
  JOURNAL_DAYS = 'journal_days',
}

@Schema({ collection: 'achievements', timestamps: true })
export class Achievement {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  icon: string;

  @Prop({
    type: String,
    enum: Object.values(AchievementCategory),
    required: true,
    index: true,
  })
  category: AchievementCategory;

  @Prop({
    type: String,
    enum: Object.values(AchievementConditionType),
    required: true,
    index: true,
  })
  condition_type: AchievementConditionType;

  @Prop({ required: true, type: Number })
  condition_value: number;

  @Prop({ type: Number, default: 0 })
  xp_reward: number;

  @Prop({ default: true, index: true })
  is_active: boolean;

  @Prop({ type: Number, default: 0 })
  order: number;
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);

AchievementSchema.index({ category: 1, is_active: 1 });
AchievementSchema.index({ condition_type: 1, is_active: 1 });

