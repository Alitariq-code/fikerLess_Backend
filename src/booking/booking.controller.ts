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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BookingService } from './booking.service';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilitySettingsDto } from './dto/create-availability-settings.dto';
import { UpdateAvailabilitySettingsDto } from './dto/update-availability-settings.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dto/update-availability-override.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { CreateSessionRequestDto } from './dto/create-session-request.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionRequestStatus } from '../models/schemas/session-request.schema';

@Controller('api/v1/booking')
export class BookingController {
  private readonly paymentUploadDir = join(process.cwd(), 'public', 'uploads', 'payments');
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  constructor(
    private readonly bookingService: BookingService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    // Ensure payment upload directory exists
    if (!existsSync(this.paymentUploadDir)) {
      mkdirSync(this.paymentUploadDir, { recursive: true });
    }
  }

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

  @Post('availability/settings')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilitySettings(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilitySettingsDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilitySettings(doctorId, dto);
  }

  @Get('availability/settings')
  @HttpCode(HttpStatus.OK)
  async getAvailabilitySettings(@Headers('authorization') token: string) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilitySettings(doctorId);
  }

  @Put('availability/settings')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilitySettings(
    @Headers('authorization') token: string,
    @Body() dto: UpdateAvailabilitySettingsDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilitySettings(doctorId, dto);
  }

  // ==================== Availability Rules Endpoints ====================

  @Post('availability/rules')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilityRule(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilityRule(doctorId, dto);
  }

  @Get('availability/rules')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityRules(@Headers('authorization') token: string) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityRules(doctorId);
  }

  @Get('availability/rules/:id')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityRuleById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityRuleById(doctorId, id);
  }

  @Put('availability/rules/:id')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilityRule(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilityRule(doctorId, id, dto);
  }

  @Delete('availability/rules/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAvailabilityRule(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.deleteAvailabilityRule(doctorId, id);
  }

  // ==================== Availability Overrides Endpoints ====================

  @Post('availability/overrides')
  @HttpCode(HttpStatus.CREATED)
  async createAvailabilityOverride(
    @Headers('authorization') token: string,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.createAvailabilityOverride(doctorId, dto);
  }

  @Get('availability/overrides')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityOverrides(
    @Headers('authorization') token: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityOverrides(doctorId, startDate, endDate);
  }

  @Get('availability/overrides/:id')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityOverrideById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.getAvailabilityOverrideById(doctorId, id);
  }

  @Put('availability/overrides/:id')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilityOverride(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityOverrideDto,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.updateAvailabilityOverride(doctorId, id, dto);
  }

  @Delete('availability/overrides/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAvailabilityOverride(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const doctorId = await this.getUserIdFromToken(token);
    return this.bookingService.deleteAvailabilityOverride(doctorId, id);
  }

  // ==================== Slot Generation & Session Requests ====================

  @Get('slots/available')
  @HttpCode(HttpStatus.OK)
  async getAvailableSlots(
    @Headers('authorization') token: string,
    @Query() query: GetAvailableSlotsDto,
  ) {
    await this.getUserIdFromToken(token); // Just validate token, any user can view slots
    if (!query.doctor_id) {
      throw new BadRequestException('doctor_id is required');
    }
    return this.bookingService.getAvailableSlots(query.doctor_id, query);
  }

  @Post('session-requests')
  @HttpCode(HttpStatus.CREATED)
  async createSessionRequest(
    @Headers('authorization') token: string,
    @Body() dto: CreateSessionRequestDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    return this.bookingService.createSessionRequest(userId, dto);
  }

  @Get('session-requests/my-requests')
  @HttpCode(HttpStatus.OK)
  async getMySessionRequests(
    @Headers('authorization') token: string,
    @Query('status') status?: SessionRequestStatus,
  ) {
    const userId = await this.getUserIdFromToken(token);
    return this.bookingService.getUserSessionRequests(userId, status);
  }

  @Get('session-requests/:id')
  @HttpCode(HttpStatus.OK)
  async getSessionRequestById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    return this.bookingService.getSessionRequestById(userId, id);
  }

  @Put('session-requests/:id/payment')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('payment_screenshot', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, join(process.cwd(), 'public', 'uploads', 'payments'));
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `payment-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadPaymentScreenshot(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Payment screenshot file is required');
    }

    const userId = await this.getUserIdFromToken(token);
    return this.bookingService.uploadPaymentScreenshot(userId, id, file);
  }

  @Delete('session-requests/:id')
  @HttpCode(HttpStatus.OK)
  async cancelSessionRequest(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    return this.bookingService.cancelSessionRequest(userId, id);
  }
}

