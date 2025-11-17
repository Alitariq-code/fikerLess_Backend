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
} from '@nestjs/common';
import { MoodService } from './mood.service';
import { CreateMoodDto } from './dto/create-mood.dto';
import { UpdateMoodDto } from './dto/update-mood.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/mood')
export class MoodController {
  constructor(
    private readonly moodService: MoodService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token: string): Promise<string> {
    if (!token) {
      throw new Error('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new Error(result.error || 'Invalid token');
    }
    return result.user._id.toString();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createMood(@Headers('authorization') token: string, @Body() dto: CreateMoodDto) {
    const userId = await this.getUserIdFromToken(token);
    return this.moodService.createOrUpdateMood(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMood(@Headers('authorization') token: string, @Query('date') date?: string) {
    const userId = await this.getUserIdFromToken(token);
    return this.moodService.getMood(userId, date);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  async getMoodHistory(
    @Headers('authorization') token: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const pageNum = page ? parseInt(page, 10) : 1;
    return this.moodService.getMoodHistory(userId, limitNum, pageNum);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateMood(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateMoodDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    return this.moodService.updateMood(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMood(@Headers('authorization') token: string, @Param('id') id: string) {
    const userId = await this.getUserIdFromToken(token);
    return this.moodService.deleteMood(userId, id);
  }
}

