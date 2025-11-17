import { Controller, Post, Get, Put, Body, Query, Headers, HttpCode, HttpStatus, Param, UnauthorizedException } from '@nestjs/common';
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
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
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
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('min_experience') minExperience?: string,
    @Query('min_rating') minRating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const verifiedBool = verified === 'true' ? true : verified === 'false' ? false : undefined;
    const result = await this.specialistService.getAllSpecialists({
      verified: verifiedBool,
      location,
      specialization,
      category,
      search,
      min_experience: minExperience ? parseFloat(minExperience) : undefined,
      min_rating: minRating ? parseFloat(minRating) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      success: true,
      data: result.results,
      pagination: result.pagination,
    };
  }

  @Get('profiles/:id')
  @HttpCode(HttpStatus.OK)
  async getPublicProfile(@Param('id') id: string) {
    const result = await this.specialistService.getSpecialistById(id);
    return {
      success: true,
      data: result,
    };
  }

  @Get('highlights')
  @HttpCode(HttpStatus.OK)
  async getHighlights(@Query('location') location?: string, @Query('limit') limit?: string) {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 3, 10) : 3;
    const data = await this.specialistService.getHighlights(limitNum, location);
    return {
      success: true,
      data,
    };
  }

  @Get('suggestions')
  @HttpCode(HttpStatus.OK)
  async getSuggestions(@Query('term') term: string) {
    const data = await this.specialistService.getSuggestions(term);
    return {
      success: true,
      data,
    };
  }
}

