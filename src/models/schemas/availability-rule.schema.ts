import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type AvailabilityRuleDocument = AvailabilityRule & Document;

export enum DayOfWeek {
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
  SAT = 'SAT',
  SUN = 'SUN',
}

@Schema({ collection: 'availability_rules', timestamps: true })
export class AvailabilityRule {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DayOfWeek),
    required: true,
    index: true,
  })
  day_of_week: DayOfWeek;

  @Prop({ required: true })
  start_time: string; // Format: "HH:mm" (e.g., "09:00")

  @Prop({ required: true })
  end_time: string; // Format: "HH:mm" (e.g., "17:00")

  @Prop({ type: Boolean, default: true, index: true })
  is_active: boolean;
}

export const AvailabilityRuleSchema = SchemaFactory.createForClass(AvailabilityRule);

// Index for efficient queries
AvailabilityRuleSchema.index({ doctor_id: 1, day_of_week: 1 });
AvailabilityRuleSchema.index({ doctor_id: 1, is_active: 1 });

