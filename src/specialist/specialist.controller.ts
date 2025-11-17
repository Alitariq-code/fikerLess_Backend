import { Controller, Post, Get, Put, Body, Query, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { SpecialistService } from './specialist.service';
import { CreateSpecialistProfileDto } from './dto/create-specialist-profile.dto';
import { UpdateSpecialistProfileDto } from './dto/update-specialist-profile.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/specialist')
export class SpecialistController {
  constructor(
    private readonly specialistService: SpecialistService,
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

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  async createProfile(@Headers('authorization') token: string, @Body() dto: CreateSpecialistProfileDto) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.specialistService.createProfile(userId, dto);
    return {
      success: true,
      message: 'Specialist profile created successfully',
      data: result,
    };
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.specialistService.getProfile(userId);
    return {
      success: true,
      data: result,
    };
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Headers('authorization') token: string, @Body() dto: UpdateSpecialistProfileDto) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.specialistService.updateProfile(userId, dto);
    return {
      success: true,
      message: 'Specialist profile updated successfully',
      data: result,
    };
  }

  @Get('specialists')
  @HttpCode(HttpStatus.OK)
  async getAllSpecialists(
    @Query('verified') verified?: string,
    @Query('location') location?: string,
    @Query('specialization') specialization?: string,
  ) {
    const verifiedBool = verified === 'true' ? true : verified === 'false' ? false : undefined;
    const result = await this.specialistService.getAllSpecialists(verifiedBool, location, specialization);
    return {
      success: true,
      data: result,
    };
  }
}

