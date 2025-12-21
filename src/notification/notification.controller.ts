import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';
import { UpsertFcmTokenDto } from './dto/upsert-fcm-token.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
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

  @Get()
  @HttpCode(HttpStatus.OK)
  async getNotifications(
    @Headers('authorization') token: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.notificationService.listUserNotifications(userId, {
      status,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  async getUnreadCount(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    const result = await this.notificationService.getUnreadCount(userId);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getNotification(@Headers('authorization') token: string, @Param('id') id: string) {
    const userId = await this.getUserIdFromToken(token);
    const notification = await this.notificationService.getUserNotification(userId, id);
    return {
      success: true,
      data: notification,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateNotificationStatus(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationStatusDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const notification = await this.notificationService.updateNotificationStatus(userId, id, dto);
    return {
      success: true,
      message: 'Notification status updated successfully',
      data: notification,
    };
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    await this.notificationService.markAllRead(userId);
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteNotification(@Headers('authorization') token: string, @Param('id') id: string) {
    const userId = await this.getUserIdFromToken(token);
    await this.notificationService.deleteNotification(userId, id);
    return {
      success: true,
      message: 'Notification removed successfully',
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearAll(@Headers('authorization') token: string) {
    const userId = await this.getUserIdFromToken(token);
    await this.notificationService.clearAll(userId);
    return {
      success: true,
      message: 'All notifications cleared',
    };
  }

  @Post('fcm-token')
  @HttpCode(HttpStatus.OK)
  async upsertFcmToken(
    @Headers('authorization') token: string,
    @Body() dto: UpsertFcmTokenDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const fcmToken = await this.notificationService.upsertFcmToken(userId, dto.fcm_token);
    return {
      success: true,
      message: 'FCM token saved successfully',
      data: {
        user_id: fcmToken.user_id.toString(),
        fcm_token: fcmToken.fcm_token,
      },
    };
  }

}

