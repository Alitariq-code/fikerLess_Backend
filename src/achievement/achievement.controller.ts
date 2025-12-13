import { Controller, Get, Post, Param, Query, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AchievementService } from './achievement.service';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetRecentAchievementsDto } from './dto/get-recent-achievements.dto';
import { GetAllAchievementsDto } from './dto/get-all-achievements.dto';

@Controller('api/v1/achievements')
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
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

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getRecentAchievements(
    @Headers('authorization') token: string,
    @Query() query: GetRecentAchievementsDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const limit = query.limit || 2;
    const achievements = await this.achievementService.getRecentAchievements(userId, limit);
    
    return {
      success: true,
      data: achievements,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getAllAchievements(
    @Headers('authorization') token: string,
    @Query() query: GetAllAchievementsDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const page = query.page || 1;
    const limit = query.limit || 50;
    const status = query.status;
    const result = await this.achievementService.getAllAchievements(userId, status, page, limit);
    
    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute (lower for write operations)
  async claimAchievement(
    @Headers('authorization') token: string,
    @Param('id') achievementId: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.achievementService.claimAchievement(userId, achievementId);
    
    return {
      success: true,
      ...result,
    };
  }
}

