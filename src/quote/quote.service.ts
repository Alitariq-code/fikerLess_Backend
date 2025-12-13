import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quote, QuoteDocument } from '../models/schemas/quote.schema';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
  ) {}

  async getTodayQuote(): Promise<any> {
    // Get today's date at midnight (YYYY-MM-DD)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setMilliseconds(0);

    // Check if a quote is already selected for today
    const todayQuote = await this.quoteModel.findOne({
      is_today_quote: true,
      selected_date: today,
    }).exec();

    if (todayQuote) {
      // Quote already selected for today, return it
      return {
        ...this.formatQuoteResponse(todayQuote),
        today_quote: true,
      };
    }

    // No quote selected for today, need to:
    // 1. Clear any old today_quote flags
    // 2. Pick a random quote (avoiding recently used ones)
    
    // Clear old today_quote flags (from previous days)
    await this.quoteModel.updateMany(
      { is_today_quote: true },
      { $set: { is_today_quote: false } }
    ).exec();

    // Get recently used quotes (last 30 days) to avoid repetition
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setMilliseconds(0);
    
    const recentQuotes = await this.quoteModel
      .find({
        selected_date: { $gte: thirtyDaysAgo },
      })
      .select('_id')
      .lean()
      .exec();
    
    const recentQuoteIds = recentQuotes.map(q => q._id.toString());

    // Get all quotes excluding recently used ones
    let availableQuotes = await this.quoteModel
      .find({ _id: { $nin: recentQuoteIds } })
      .lean()
      .exec();

    // If all quotes have been used recently, reset and use all quotes
    if (availableQuotes.length === 0) {
      this.logger.log('All quotes used recently, resetting selection pool');
      availableQuotes = await this.quoteModel.find().lean().exec();
    }

    // Randomly select a quote
    const randomIndex = Math.floor(Math.random() * availableQuotes.length);
    const selectedQuote = availableQuotes[randomIndex];

    // Mark this quote as today's quote
    await this.quoteModel.findByIdAndUpdate(selectedQuote._id, {
      $set: {
        is_today_quote: true,
        selected_date: today,
      },
    }).exec();

    this.logger.log(`Selected quote ${selectedQuote._id} for date ${today.toISOString().split('T')[0]}`);

    return {
      ...this.formatQuoteResponse(selectedQuote),
      today_quote: true,
    };
  }

  private formatQuoteResponse(quote: any): any {
    return {
      _id: quote._id.toString(),
      quote_english: quote.quote_english,
      quote_urdu: quote.quote_urdu || '',
      quranic_verse: quote.quranic_verse || '',
    };
  }
}

