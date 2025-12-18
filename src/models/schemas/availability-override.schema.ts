import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type AvailabilityOverrideDocument = AvailabilityOverride & Document;

export enum OverrideType {
  OFF = 'OFF', // Completely unavailable
  CUSTOM = 'CUSTOM', // Custom hours different from weekly rules
}

@Schema({ collection: 'availability_overrides', timestamps: true })
export class AvailabilityOverride {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // Format: "YYYY-MM-DD"

  @Prop({
    type: String,
    enum: Object.values(OverrideType),
    required: true,
  })
  type: OverrideType;

  @Prop()
  start_time?: string; // Format: "HH:mm" (required if type is CUSTOM)

  @Prop()
  end_time?: string; // Format: "HH:mm" (required if type is CUSTOM)

  @Prop()
  reason?: string; // Optional reason for the override (e.g., "Holiday", "Personal leave")
}

export const AvailabilityOverrideSchema = SchemaFactory.createForClass(AvailabilityOverride);

// Index for efficient queries
AvailabilityOverrideSchema.index({ doctor_id: 1, date: 1 }, { unique: true });
AvailabilityOverrideSchema.index({ doctor_id: 1, date: -1 });

