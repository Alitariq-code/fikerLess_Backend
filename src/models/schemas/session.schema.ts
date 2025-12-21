import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { SessionRequest } from './session-request.schema';

export type SessionDocument = Session & Document;

export enum SessionStatus {
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum SessionType {
  VIDEO_CALL = 'video call',
  AUDIO_CALL = 'audio call',
}

@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  doctor_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }) // YYYY-MM-DD
  date: string;

  @Prop({ required: true, match: /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/ }) // HH:mm format
  start_time: string;

  @Prop({ required: true, match: /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/ }) // HH:mm format
  end_time: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, default: 'PKR' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(SessionStatus),
    required: true,
    default: SessionStatus.CONFIRMED,
    index: true,
  })
  status: SessionStatus;

  @Prop({ type: Types.ObjectId, ref: SessionRequest.name, required: true, unique: true })
  session_request_id: Types.ObjectId; // Reference to the original session request

  @Prop({ default: null })
  notes?: string; // Admin or doctor notes

  @Prop({ default: null })
  cancellation_reason?: string; // If cancelled

  @Prop({ type: Date, default: null })
  completed_at?: Date; // When session was marked as completed

  @Prop({ type: Date, default: null })
  cancelled_at?: Date; // When session was cancelled

  @Prop()
  session_title?: string; // Title/name of the session

  @Prop({ type: String, enum: Object.values(SessionType) })
  session_type?: SessionType; // Type of session: video call or audio call

  @Prop()
  session_file?: string; // URL of uploaded session file (doc, pdf, etc.)
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Indexes for efficient querying
SessionSchema.index({ doctor_id: 1, date: 1, start_time: 1 }, { unique: true }); // Prevent double booking
SessionSchema.index({ user_id: 1, date: 1 }); // User's sessions by date
SessionSchema.index({ doctor_id: 1, date: 1 }); // Doctor's sessions by date
SessionSchema.index({ status: 1, date: 1 }); // Filter by status and date
SessionSchema.index({ date: 1, start_time: 1 }); // Date and time queries

