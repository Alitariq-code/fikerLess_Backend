import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type BlockedSlotDocument = BlockedSlot & Document;

@Schema({ collection: 'blocked_slots', timestamps: true })
export class BlockedSlot {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }) // YYYY-MM-DD format
  date: string;

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }) // HH:mm format
  start_time: string;

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }) // HH:mm format
  end_time: string;

  @Prop({ type: Date, required: true, index: true })
  expires_at: Date; // When this block expires (auto-cleanup)

  @Prop({ type: Types.ObjectId, ref: 'SessionRequest', required: true })
  session_request_id: Types.ObjectId; // Reference to the session request that created this block
}

export const BlockedSlotSchema = SchemaFactory.createForClass(BlockedSlot);

// Index for efficient queries
BlockedSlotSchema.index({ doctor_id: 1, date: 1, start_time: 1, end_time: 1 });
BlockedSlotSchema.index({ expires_at: 1 }); // For cleanup of expired blocks
BlockedSlotSchema.index({ session_request_id: 1 }, { unique: true }); // One block per request

