import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { QuoteService } from './quote.service';

@Controller('api/v1/quote')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getTodayQuote() {
    const quote = await this.quoteService.getTodayQuote();
    return {
      success: true,
      data: quote,
    };
  }
}

