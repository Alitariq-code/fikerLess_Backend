import { Controller, Post, Get, Put, Delete, Body, Param, Query, Headers, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { StepsService } from './steps.service';
import { SyncStepsDto } from './dto/sync-steps.dto';
import { CreateStepsDto } from './dto/create-steps.dto';
import { UpdateStepsDto } from './dto/update-steps.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/activity/steps')
export class StepsController {
  constructor(
    private readonly stepsService: StepsService,
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

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncSteps(@Headers('authorization') token: string, @Body() dto: SyncStepsDto) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.syncSteps(userId, dto);
    return {
      success: true,
      message: 'Steps synced successfully',
      data: result
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createSteps(@Headers('authorization') token: string, @Body() dto: CreateStepsDto) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.createSteps(userId, dto);
    return {
      success: true,
      message: 'Steps saved successfully',
      data: result
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getSteps(@Headers('authorization') token: string, @Query('date') date?: string) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.getSteps(userId, date);
    return {
      success: true,
      data: result
    };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  async getHistory(
    @Headers('authorization') token: string,
    @Query('period') period?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string
  ) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.getHistory(
      userId,
      period || 'daily',
      startDate,
      endDate,
      limit ? parseInt(limit) : 30,
      page ? parseInt(page) : 1
    );
    return {
      success: true,
      data: result
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateSteps(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateStepsDto
  ) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.updateSteps(userId, id, dto);
    return {
      success: true,
      message: 'Steps updated successfully',
      data: result
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSteps(@Headers('authorization') token: string, @Param('id') id: string) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.deleteSteps(userId, id);
    return {
      success: true,
      ...result
    };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(
    @Headers('authorization') token: string,
    @Query('period') period?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const userId = await this.getUserIdFromToken(token);
    const periodNum = period ? parseInt(period) : 30;
    const result = await this.stepsService.getStats(userId, periodNum, startDate, endDate);
    return {
      success: true,
      data: result
    };
  }

  @Get('current-streak')
  @HttpCode(HttpStatus.OK)
  async getCurrentStreak(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.stepsService.getCurrentStreak(userId);
    return {
      success: true,
      data: result
    };
  }
}

