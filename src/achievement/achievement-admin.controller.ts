import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { getUserFromToken } from '../utils/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Model } from 'mongoose';

@Controller('api/v1/achievements/admin')
export class AchievementAdminController {
  constructor(
    private readonly achievementService: AchievementService,
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

  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllAchievementsForAdmin(
    @Headers('authorization') token: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('condition_type') conditionType?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.achievementService.getAllAchievementsForAdmin(
      search,
      category,
      conditionType,
      isActive,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAchievementByIdForAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const achievement = await this.achievementService.getAchievementByIdForAdmin(id);
    return {
      success: true,
      data: achievement,
    };
  }

  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createAchievementAsAdmin(
    @Headers('authorization') token: string,
    @Body() dto: CreateAchievementDto,
  ) {
    await this.ensureAdmin(token);
    const achievement = await this.achievementService.createAchievementAsAdmin(dto);
    return {
      success: true,
      message: 'Achievement created successfully',
      data: achievement,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateAchievementAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAchievementDto,
  ) {
    await this.ensureAdmin(token);
    const achievement = await this.achievementService.updateAchievementAsAdmin(id, dto);
    return {
      success: true,
      message: 'Achievement updated successfully',
      data: achievement,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAchievementAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.achievementService.deleteAchievementAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }

  @Get('user-achievements/all')
  @HttpCode(HttpStatus.OK)
  async getAllUserAchievementsForAdmin(
    @Headers('authorization') token: string,
    @Query('user_id') userId?: string,
    @Query('achievement_id') achievementId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.achievementService.getAllUserAchievementsForAdmin(
      userId,
      achievementId,
      status,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
    };
  }
}

