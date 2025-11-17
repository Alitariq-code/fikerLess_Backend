import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Get, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { getUserFromToken } from '../utils/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Model } from 'mongoose';

@Controller('api/v1/notifications/admin')
export class NotificationAdminController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async ensureAdmin(token: string): Promise<void> {
    if (!token) {
      throw new Error('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new Error(result.error || 'Invalid token');
    }
    if (result.user.user_type !== 'admin') {
      throw new Error('Only admins can perform this action');
    }
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Headers('authorization') token: string,
    @Body() dto: CreateNotificationTemplateDto,
  ) {
    await this.ensureAdmin(token);
    const template = await this.notificationService.createTemplate(dto);
    return {
      success: true,
      message: 'Notification template created successfully',
      data: template,
    };
  }

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  async listTemplates(
    @Headers('authorization') token: string,
    @Query('type') type?: string,
  ) {
    await this.ensureAdmin(token);
    const templates = await this.notificationService.listTemplates(type);
    return {
      success: true,
      data: templates,
    };
  }

  @Get('templates/:id')
  @HttpCode(HttpStatus.OK)
  async getTemplate(@Headers('authorization') token: string, @Param('id') id: string) {
    await this.ensureAdmin(token);
    const template = await this.notificationService.getTemplateById(id);
    return {
      success: true,
      data: template,
    };
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcast(
    @Headers('authorization') token: string,
    @Body() dto: BroadcastNotificationDto,
  ) {
    await this.ensureAdmin(token);
    const result = await this.notificationService.broadcast(dto);
    return {
      success: true,
      message: 'Notification broadcast initiated',
      data: result,
    };
  }
}

