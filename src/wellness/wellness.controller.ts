import { Controller, Get, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { WellnessService } from './wellness.service';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/wellness')
export class WellnessController {
  constructor(
    private readonly wellnessService: WellnessService,
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

  @Get('progress')
  @HttpCode(HttpStatus.OK)
  async getProgress(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your progress');
    }

    const progress = await this.wellnessService.getProgress(userId);
    return {
      success: true,
      data: progress,
    };
  }

  @Get('pet-growth')
  @HttpCode(HttpStatus.OK)
  async getPetGrowth(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your plant growth');
    }

    const petGrowth = await this.wellnessService.getPetGrowth(userId);
    return {
      success: true,
      data: petGrowth,
    };
  }

  @Get('rewards')
  @HttpCode(HttpStatus.OK)
  async getRewards(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your rewards');
    }

    const rewards = await this.wellnessService.getRewards(userId);
    return {
      success: true,
      data: rewards,
    };
  }

  @Get('xp')
  @HttpCode(HttpStatus.OK)
  async getUserXP(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your XP');
    }

    const xpData = await this.wellnessService.getUserXP(userId);
    return {
      success: true,
      data: xpData,
    };
  }
}

