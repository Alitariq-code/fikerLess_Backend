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

  @Prop({ type: Boolean, default: false, index: true })
  is_today_quote?: boolean;

  @Prop({ type: Date })
  selected_date?: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

QuoteSchema.index({ quote_english: 'text', quote_urdu: 'text' });
QuoteSchema.index({ is_today_quote: 1, selected_date: 1 });

