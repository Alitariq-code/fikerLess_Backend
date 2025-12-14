import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quote, QuoteDocument } from '../models/schemas/quote.schema';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

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
      is_today_quote: quote.is_today_quote || false,
      selected_date: quote.selected_date,
      created_at: (quote as any).createdAt,
      updated_at: (quote as any).updatedAt,
    };
  }

  // Admin methods
  async getAllQuotesForAdmin(
    search?: string,
    isTodayQuote?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (isTodayQuote !== undefined && isTodayQuote !== 'all') {
      query.is_today_quote = isTodayQuote === 'true';
    }

    if (search) {
      query.$or = [
        { quote_english: { $regex: search, $options: 'i' } },
        { quote_urdu: { $regex: search, $options: 'i' } },
        { quranic_verse: { $regex: search, $options: 'i' } },
      ];
    }

    const [quotes, total] = await Promise.all([
      this.quoteModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.quoteModel.countDocuments(query),
    ]);

    return {
      data: quotes.map((quote) => this.formatQuoteResponse(quote)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async getQuoteByIdForAdmin(quoteId: string) {
    const quote = await this.quoteModel.findById(quoteId).lean();
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return this.formatQuoteResponse(quote);
  }

  async createQuoteAsAdmin(dto: CreateQuoteDto) {
    // If setting as today's quote, clear other today's quotes first
    if (dto.is_today_quote) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      today.setMilliseconds(0);

      await this.quoteModel.updateMany(
        { is_today_quote: true },
        { $set: { is_today_quote: false } }
      ).exec();
    }

    const quote = await this.quoteModel.create({
      quote_english: dto.quote_english,
      quote_urdu: dto.quote_urdu || '',
      quranic_verse: dto.quranic_verse || '',
      is_today_quote: dto.is_today_quote || false,
      selected_date: dto.is_today_quote ? new Date() : undefined,
    });

    return this.formatQuoteResponse(quote);
  }

  async updateQuoteAsAdmin(quoteId: string, dto: UpdateQuoteDto) {
    const quote = await this.quoteModel.findById(quoteId);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // If setting as today's quote, clear other today's quotes first
    if (dto.is_today_quote === true && !quote.is_today_quote) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      today.setMilliseconds(0);

      await this.quoteModel.updateMany(
        { is_today_quote: true, _id: { $ne: quoteId } },
        { $set: { is_today_quote: false } }
      ).exec();
    }

    // If unsetting as today's quote
    if (dto.is_today_quote === false && quote.is_today_quote) {
      quote.selected_date = undefined;
    }

    if (dto.quote_english !== undefined) quote.quote_english = dto.quote_english;
    if (dto.quote_urdu !== undefined) quote.quote_urdu = dto.quote_urdu;
    if (dto.quranic_verse !== undefined) quote.quranic_verse = dto.quranic_verse;
    if (dto.is_today_quote !== undefined) {
      quote.is_today_quote = dto.is_today_quote;
      if (dto.is_today_quote) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        today.setMilliseconds(0);
        quote.selected_date = today;
      }
    }

    await quote.save();
    return this.formatQuoteResponse(quote);
  }

  async setQuoteOfTheDay(quoteId: string) {
    const quote = await this.quoteModel.findById(quoteId);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Clear all other today's quotes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setMilliseconds(0);

    await this.quoteModel.updateMany(
      { is_today_quote: true, _id: { $ne: quoteId } },
      { $set: { is_today_quote: false } }
    ).exec();

    // Set this quote as today's quote
    quote.is_today_quote = true;
    quote.selected_date = today;
    await quote.save();

    return this.formatQuoteResponse(quote);
  }

  async deleteQuoteAsAdmin(quoteId: string) {
    const quote = await this.quoteModel.findById(quoteId);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    await quote.deleteOne();
    return { success: true, message: 'Quote deleted successfully' };
  }
}

