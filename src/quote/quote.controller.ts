import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/quote')
export class QuoteController {
  constructor(
    private readonly quoteService: QuoteService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    return result.user._id.toString();
  }

  private async ensureAdmin(token: string): Promise<string> {
    const userId = await this.getUserIdFromToken(token);
    const result = await getUserFromToken(token, this.userModel);
    if (result.user?.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }
    return userId;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getTodayQuote() {
    const quote = await this.quoteService.getTodayQuote();
    return {
      success: true,
      data: quote,
    };
  }

  @Get('images/random')
  @HttpCode(HttpStatus.OK)
  async getRandomQuoteImages() {
    const imageUrls = await this.quoteService.getRandomQuoteImages();
    return {
      success: true,
      data: imageUrls,
    };
  }

  // Admin endpoints
  @Get('admin/all')
  @HttpCode(HttpStatus.OK)
  async getAllQuotesForAdmin(
    @Headers('authorization') token: string,
    @Query('search') search?: string,
    @Query('is_today_quote') isTodayQuote?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.quoteService.getAllQuotesForAdmin(
      search,
      isTodayQuote,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get('admin/:id')
  @HttpCode(HttpStatus.OK)
  async getQuoteByIdForAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const quote = await this.quoteService.getQuoteByIdForAdmin(id);
    return {
      success: true,
      data: quote,
    };
  }

  @Post('admin/create')
  @HttpCode(HttpStatus.OK)
  async createQuoteAsAdmin(
    @Headers('authorization') token: string,
    @Body() dto: CreateQuoteDto,
  ) {
    await this.ensureAdmin(token);
    const quote = await this.quoteService.createQuoteAsAdmin(dto);
    return {
      success: true,
      message: 'Quote created successfully',
      data: quote,
    };
  }

  @Put('admin/:id')
  @HttpCode(HttpStatus.OK)
  async updateQuoteAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    await this.ensureAdmin(token);
    const quote = await this.quoteService.updateQuoteAsAdmin(id, dto);
    return {
      success: true,
      message: 'Quote updated successfully',
      data: quote,
    };
  }

  @Patch('admin/:id/set-today')
  @HttpCode(HttpStatus.OK)
  async setQuoteOfTheDay(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const quote = await this.quoteService.setQuoteOfTheDay(id);
    return {
      success: true,
      message: 'Quote set as quote of the day successfully',
      data: quote,
    };
  }

  @Delete('admin/:id')
  @HttpCode(HttpStatus.OK)
  async deleteQuoteAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.quoteService.deleteQuoteAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }
}

