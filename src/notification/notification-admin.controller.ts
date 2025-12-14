import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Get, Param, Query, Put, Delete, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
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
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    if (result.user.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can perform this action');
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

  @Get('templates/all')
  @HttpCode(HttpStatus.OK)
  async getAllTemplatesForAdmin(
    @Headers('authorization') token: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.notificationService.getAllTemplatesForAdmin(
      search,
      type,
      isActive,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
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

  @Put('templates/:id')
  @HttpCode(HttpStatus.OK)
  async updateTemplate(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    await this.ensureAdmin(token);
    const template = await this.notificationService.updateTemplateAsAdmin(id, dto);
    return {
      success: true,
      message: 'Notification template updated successfully',
      data: template,
    };
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.notificationService.deleteTemplateAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendNotification(
    @Headers('authorization') token: string,
    @Body() dto: SendNotificationDto,
  ) {
    await this.ensureAdmin(token);
    const result = await this.notificationService.sendNotificationAsAdmin(dto);
    return {
      success: true,
      ...result,
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

