import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/journal')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token?: string): Promise<string | undefined> {
    if (!token) return undefined;
    
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      return undefined;
    }
    return result.user._id.toString();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createJournal(
    @Headers('authorization') token: string,
    @Body() dto: CreateJournalDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to create a journal entry');
    }

    return this.journalService.createOrUpdateJournal(userId, dto);
  }

  @Get('today')
  @HttpCode(HttpStatus.OK)
  async getTodayJournal(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your journal');
    }

    return this.journalService.getTodayJournal(userId);
  }

  @Get('date/:date')
  @HttpCode(HttpStatus.OK)
  async getJournalByDate(
    @Headers('authorization') token: string,
    @Param('date') date: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your journal');
    }

    return this.journalService.getJournalByDate(userId, date);
  }

  @Get('entries')
  @HttpCode(HttpStatus.OK)
  async getJournalEntries(
    @Headers('authorization') token: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your journal entries');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.journalService.getJournalEntries(userId, pageNum, limitNum);
  }

  @Get('month')
  @HttpCode(HttpStatus.OK)
  async getJournalByMonth(
    @Headers('authorization') token: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your journal');
    }

    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const monthNum = month ? parseInt(month, 10) : new Date().getMonth() + 1;

    return this.journalService.getJournalByMonth(userId, yearNum, monthNum);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getJournalById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your journal');
    }

    return this.journalService.getJournalById(userId, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateJournal(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateJournalDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to update your journal');
    }

    return this.journalService.updateJournal(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteJournal(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to delete your journal entry');
    }

    return this.journalService.deleteJournal(userId, id);
  }
}

