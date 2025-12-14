import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InternshipDocument = Internship & Document;

export class Program {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  duration: string;

  @Prop({ required: true, type: Number, default: 0 })
  fees: number;

  @Prop({ default: 'online' })
  mode: string; // 'online', 'in-person', 'hybrid'

  @Prop()
  description?: string;
}

@Schema({ collection: 'internships', timestamps: true })
export class Internship {
  @Prop({ required: true, index: true })
  mentorName: string;

  @Prop({ required: true })
  profession: string;

  @Prop()
  specialization?: string;

  @Prop({ type: [Program], required: true, default: [] })
  programs: Program[];

  @Prop({ type: [String], default: [] })
  includes: string[];

  @Prop({ required: true })
  city: string;

  @Prop()
  cityNote?: string;

  @Prop()
  additionalInfo?: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ type: Number, default: 0 })
  view_count: number;

  @Prop({ type: Number, default: 0 })
  application_count: number;
}

export const InternshipSchema = SchemaFactory.createForClass(Internship);

// Indexes for better query performance
InternshipSchema.index({ mentorName: 'text', profession: 'text', specialization: 'text', city: 'text' });
InternshipSchema.index({ is_active: 1 });
InternshipSchema.index({ city: 1, is_active: 1 });

