import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { Achievement } from './achievement.schema';

export type UserAchievementDocument = UserAchievement & Document;

export enum UserAchievementStatus {
  LOCKED = 'locked',
  IN_PROGRESS = 'in_progress',
  UNLOCKED = 'unlocked',
  CLAIMED = 'claimed',
}

@Schema({ collection: 'user_achievements', timestamps: true })
export class UserAchievement {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Achievement.name, required: true, index: true })
  achievement_id: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  progress_current: number;

  @Prop({ type: Number, required: true })
  progress_target: number;

  @Prop({
    type: String,
    enum: Object.values(UserAchievementStatus),
    default: UserAchievementStatus.LOCKED,
    index: true,
  })
  status: UserAchievementStatus;

  @Prop({ type: Date })
  unlocked_at?: Date;

  @Prop({ type: Date })
  claimed_at?: Date;

  @Prop({ type: Date, default: Date.now })
  last_updated: Date;
}

export const UserAchievementSchema = SchemaFactory.createForClass(UserAchievement);

// Unique constraint: one record per user per achievement
UserAchievementSchema.index({ user_id: 1, achievement_id: 1 }, { unique: true });

// Index for recent achievements query
UserAchievementSchema.index({ user_id: 1, status: 1, unlocked_at: -1 });

// Index for progress updates
UserAchievementSchema.index({ user_id: 1, status: 1, last_updated: -1 });

