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
import { BookingService } from './booking.service';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilitySettingsDto } from './dto/create-availability-settings.dto';
import { UpdateAvailabilitySettingsDto } from './dto/update-availability-settings.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dto/update-availability-override.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/booking/availability')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
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

  // ==================== Availability Settings Endpoints ====================

  @Post('settings')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilitySettings(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilitySettingsDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilitySettings(doctorId, dto);
  }

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async getAvailabilitySettings(@Headers('authorization') token: string) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilitySettings(doctorId);
  }

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilitySettings(
    @Headers('authorization') token: string,
    @Body() dto: UpdateAvailabilitySettingsDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilitySettings(doctorId, dto);
  }

  // ==================== Availability Rules Endpoints ====================

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilityRule(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilityRule(doctorId, dto);
  }

  @Get('rules')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityRules(@Headers('authorization') token: string) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityRules(doctorId);
  }

  @Get('rules/:id')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityRuleById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityRuleById(doctorId, id);
  }

  @Put('rules/:id')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilityRule(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilityRule(doctorId, id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAvailabilityRule(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.deleteAvailabilityRule(doctorId, id);
  }

  // ==================== Availability Overrides Endpoints ====================

  @Post('overrides')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilityOverride(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilityOverride(doctorId, dto);
  }

  @Get('overrides')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityOverrides(
    @Headers('authorization') token: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityOverrides(doctorId, startDate, endDate);
  }

  @Get('overrides/:id')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityOverrideById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityOverrideById(doctorId, id);
  }

  @Put('overrides/:id')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilityOverride(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityOverrideDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilityOverride(doctorId, id, dto);
  }

  @Delete('overrides/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAvailabilityOverride(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.deleteAvailabilityOverride(doctorId, id);
  }
}

