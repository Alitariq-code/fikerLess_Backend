import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type WeeklyGoalDocument = WeeklyGoal & Document;

@Schema({ collection: 'weekly_goals', timestamps: true })
export class WeeklyGoal {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Number, default: 6000, min: 1000 })
  target_steps: number;

  @Prop({ type: Number, default: 0, min: 0 })
  current_steps: number;

  @Prop({ type: Date, required: true, index: true })
  week_start_date: Date; // Monday of the week (YYYY-MM-DD at 00:00:00)
}

export const WeeklyGoalSchema = SchemaFactory.createForClass(WeeklyGoal);

// Unique constraint: one weekly goal per user per week
WeeklyGoalSchema.index({ user_id: 1, week_start_date: 1 }, { unique: true });
WeeklyGoalSchema.index({ user_id: 1, week_start_date: -1 });

