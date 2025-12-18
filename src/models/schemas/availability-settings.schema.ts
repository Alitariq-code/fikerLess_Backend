import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type AvailabilitySettingsDocument = AvailabilitySettings & Document;

@Schema({ collection: 'availability_settings', timestamps: true })
export class AvailabilitySettings {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 60, min: 15 })
  slot_duration_minutes: number; // Duration of each session slot

  @Prop({ type: Number, required: true, default: 15, min: 0 })
  break_minutes: number; // Break time between sessions

  @Prop({ type: String, required: true, default: 'Asia/Karachi' })
  timezone: string; // IANA timezone string
}

export const AvailabilitySettingsSchema = SchemaFactory.createForClass(AvailabilitySettings);

