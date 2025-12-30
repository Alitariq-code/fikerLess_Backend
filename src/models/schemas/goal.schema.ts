import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type GoalDocument = Goal & Document;

export enum GoalCategory {
  EXERCISE = 'Exercise',
  READ_ARTICLE = 'Read an Article',
  MEDITATION = 'Meditation',
  MOOD_TRACKING = 'Mood Tracking',
  OTHER = 'Other',
}

export enum GoalFrequency {
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
}

export enum GoalStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Schema({ collection: 'goals', timestamps: true })
export class Goal {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, minlength: 1, maxlength: 200 })
  title: string;

  @Prop({
    type: String,
    enum: Object.values(GoalCategory),
    required: true,
    index: true,
  })
  category: GoalCategory;

  @Prop()
  custom_category?: string;

  @Prop({
    type: String,
    enum: Object.values(GoalFrequency),
    required: true,
  })
  frequency: GoalFrequency;

  @Prop({
    type: String,
    enum: Object.values(GoalStatus),
    default: GoalStatus.IN_PROGRESS,
    index: true,
  })
  status: GoalStatus;

  @Prop({ type: Number, default: 0 })
  current_streak: number;

  @Prop({ type: Number })
  target_streak?: number;

  @Prop({ type: Date })
  completed_at?: Date;

  @Prop({ type: Date })
  last_completed_date?: Date;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);

// Indexes for efficient queries
GoalSchema.index({ user_id: 1, status: 1 });
GoalSchema.index({ user_id: 1, category: 1 });


