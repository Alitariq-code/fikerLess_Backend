import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AudioDocument = Audio & Document;

export enum AudioLanguage {
  URDU = 'Urdu',
  ENGLISH = 'English',
}

export enum AudioCategory {
  BREATHING = 'Breathing',
  MEDITATION = 'Meditation',
  SLEEP = 'Sleep',
  RELAXATION = 'Relaxation',
  MINDFULNESS = 'Mindfulness',
}

@Schema({ collection: 'audios', timestamps: true })
export class Audio {
  @Prop({ required: true, unique: true })
  filename: string;

  @Prop({ required: true })
  title: string;

  @Prop({
    type: String,
    enum: Object.values(AudioLanguage),
    required: true,
    index: true,
  })
  language: AudioLanguage;

  @Prop({
    type: String,
    enum: Object.values(AudioCategory),
    default: AudioCategory.BREATHING,
    index: true,
  })
  category: AudioCategory;

  @Prop({ required: true, type: Number })
  duration: number; // Duration in seconds

  @Prop({ required: true, type: Number })
  file_size: number; // File size in bytes

  @Prop({ required: true })
  stream_url: string; // URL path for streaming

  @Prop()
  thumbnail_url?: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Number })
  bitrate?: number; // Audio bitrate in kbps

  @Prop({ type: Number })
  sample_rate?: number; // Sample rate in Hz

  @Prop({ type: String })
  format?: string; // Audio format (e.g., 'mp3')

  @Prop({ default: true, index: true })
  is_active: boolean;

  @Prop({ type: Number, default: 0 })
  play_count: number; // Track how many times played

  @Prop({ type: Number, default: 0 })
  order: number; // For custom ordering
}

export const AudioSchema = SchemaFactory.createForClass(Audio);

AudioSchema.index({ filename: 1 });
AudioSchema.index({ language: 1, category: 1 });
// Text index without language specification (supports multiple languages)
AudioSchema.index({ title: 'text', description: 'text' }, { default_language: 'none' });
AudioSchema.index({ is_active: 1, order: 1 });

