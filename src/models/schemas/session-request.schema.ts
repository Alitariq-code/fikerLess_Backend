import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type SessionRequestDocument = SessionRequest & Document;

export enum SessionRequestStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT', // User needs to upload payment screenshot
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Payment uploaded, waiting for admin approval
  CONFIRMED = 'CONFIRMED', // Admin approved, session is confirmed
  CANCELLED = 'CANCELLED', // User cancelled before payment
  REJECTED = 'REJECTED', // Admin rejected the payment
  EXPIRED = 'EXPIRED', // Payment not uploaded in time
}

export enum SessionType {
  VIDEO_CALL = 'video call',
  AUDIO_CALL = 'audio call',
}

@Schema({ collection: 'session_requests', timestamps: true })
export class SessionRequest {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }) // YYYY-MM-DD format
  date: string;

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }) // HH:mm format
  start_time: string;

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }) // HH:mm format
  end_time: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, default: 'PKR' })
  currency: string;

  @Prop({ type: String, enum: Object.values(SessionRequestStatus), required: true, default: SessionRequestStatus.PENDING_PAYMENT, index: true })
  status: SessionRequestStatus;

  @Prop()
  payment_screenshot_url?: string; // URL to uploaded payment screenshot

  @Prop({ type: Date })
  expires_at?: Date; // When the payment upload expires (for PENDING_PAYMENT status)

  @Prop()
  rejection_reason?: string; // Reason if rejected by admin

  @Prop({ type: Date })
  confirmed_at?: Date; // When admin confirmed the session

  @Prop({ type: Types.ObjectId, ref: 'BlockedSlot' })
  blocked_slot_id?: Types.ObjectId; // Reference to the blocked slot

  @Prop({ required: true })
  session_title: string; // Title/name of the session

  @Prop({ type: String, enum: Object.values(SessionType) })
  session_type?: SessionType; // Type of session: video call or audio call
}

export const SessionRequestSchema = SchemaFactory.createForClass(SessionRequest);

// Index for efficient queries
SessionRequestSchema.index({ doctor_id: 1, date: 1, start_time: 1 });
SessionRequestSchema.index({ user_id: 1, status: 1 });
SessionRequestSchema.index({ status: 1, expires_at: 1 }); // For cleanup of expired requests

