import {
  Controller,
  Get,
  Headers,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/dashboard/admin')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async ensureAdmin(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    if (result.user.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }
    return result.user._id.toString();
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getDashboardStats(
    @Headers('authorization') token: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.ensureAdmin(token);
    const stats = await this.dashboardService.getDashboardStats(startDate, endDate);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('user/:userId/insights')
  @HttpCode(HttpStatus.OK)
  async getUserInsights(
    @Headers('authorization') token: string,
    @Param('userId') userId: string,
  ) {
    await this.ensureAdmin(token);
    const insights = await this.dashboardService.getUserInsights(userId);
    return {
      success: true,
      data: insights,
    };
  }
}

