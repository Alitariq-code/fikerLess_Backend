import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QuoteDocument = Quote & Document;

@Schema({ collection: 'quotes', timestamps: true })
export class Quote {
  @Prop({ required: true })
  quote_english: string;

  @Prop({ required: false, default: '' })
  quote_urdu?: string;

  @Prop({ required: false, default: '' })
  quranic_verse?: string;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

QuoteSchema.index({ quote_english: 'text', quote_urdu: 'text' });

