import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationTemplate, NotificationTemplateDocument } from '../models/schemas/notification-template.schema';
import { UserNotification, UserNotificationDocument } from '../models/schemas/user-notification.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';
import { NotificationRequestDto } from './dto/notification-request.dto';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(NotificationTemplate.name) private templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(UserNotification.name) private userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly firebaseService: FirebaseService,
  ) {}

  async createTemplate(dto: CreateNotificationTemplateDto) {
    const template = await this.templateModel.create({
      title: dto.title,
      body: dto.body,
      type: dto.type || 'general',
      metadata: dto.metadata || {},
      cta_text: dto.cta_text,
      cta_url: dto.cta_url,
      schedule_at: dto.schedule_at ? new Date(dto.schedule_at) : undefined,
      is_active: dto.is_active ?? true,
    });
    return template;
  }

  async listTemplates(type?: string) {
    const query: Record<string, any> = {};
    if (type) {
      query.type = type;
    }
    return this.templateModel.find(query).sort({ createdAt: -1 });
  }

  async getAllTemplatesForAdmin(
    search?: string,
    type?: string,
    isActive?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.is_active = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.templateModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.templateModel.countDocuments(query),
    ]);

    return {
      data: templates.map((template) => ({
        _id: template._id.toString(),
        title: template.title,
        body: template.body,
        type: template.type,
        metadata: template.metadata || {},
        cta_text: template.cta_text,
        cta_url: template.cta_url,
        schedule_at: template.schedule_at,
        is_active: template.is_active,
        created_at: (template as any).createdAt,
        updated_at: (template as any).updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async getTemplateById(id: string) {
    const template = await this.templateModel.findById(id);
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }
    return template;
  }

  async broadcast(dto: BroadcastNotificationDto) {
    const template = await this.templateModel.findById(dto.template_id);
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    let targetUsers: Types.ObjectId[] = [];

    if (dto.send_to_all) {
      const users = await this.userModel.find({}, '_id').lean();
      targetUsers = users.map((u) => u._id as Types.ObjectId);
    } else if (dto.user_ids && dto.user_ids.length) {
      targetUsers = dto.user_ids.map((id) => new Types.ObjectId(id));
    } else {
      throw new BadRequestException('Please specify send_to_all or provide user_ids');
    }

    if (!targetUsers.length) {
      throw new BadRequestException('No target users found for this broadcast');
    }

    const payload = {
      title: template.title,
      body: template.body,
      type: template.type,
      metadata: template.metadata || {},
      cta_text: template.cta_text,
      cta_url: template.cta_url,
    };

    const operations = targetUsers.map((userId) => ({
      updateOne: {
        filter: { template_id: template._id, user_id: userId },
        update: {
          $setOnInsert: {
            template_id: template._id,
            user_id: userId,
            payload,
            status: 'unread',
            deleted_at: null,
            read_at: null,
          },
        },
        upsert: true,
      },
    }));

    await this.userNotificationModel.bulkWrite(operations, { ordered: false });

    return { total_recipients: targetUsers.length };
  }

  async listUserNotifications(
    userId: string,
    options: { status?: string; type?: string; page?: number; limit?: number },
  ) {
    const query: Record<string, any> = {
      user_id: new Types.ObjectId(userId),
      deleted_at: null,
    };

    if (options.status && options.status !== 'all') {
      query.status = options.status;
    }

    if (options.type) {
      query['payload.type'] = options.type;
    }

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 && options.limit <= 50 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.userNotificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userNotificationModel.countDocuments(query),
    ]);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserNotification(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundException('Notification not found');
    }

    const notification = await this.userNotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      user_id: new Types.ObjectId(userId),
      deleted_at: null,
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async updateNotificationStatus(userId: string, notificationId: string, dto: UpdateNotificationStatusDto) {
    const notification = await this.getUserNotification(userId, notificationId);
    notification.status = dto.status;
    notification.read_at = dto.status === 'read' ? new Date() : null;
    await notification.save();
    return notification;
  }

  async markAllRead(userId: string) {
    await this.userNotificationModel.updateMany(
      {
        user_id: new Types.ObjectId(userId),
        status: { $ne: 'read' },
        deleted_at: null,
      },
      {
        $set: {
          status: 'read',
          read_at: new Date(),
        },
      },
    );
    return { success: true };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.getUserNotification(userId, notificationId);
    notification.deleted_at = new Date();
    await notification.save();
    return { success: true };
  }

  async clearAll(userId: string) {
    await this.userNotificationModel.updateMany(
      { user_id: new Types.ObjectId(userId), deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const count = await this.userNotificationModel.countDocuments({
      user_id: new Types.ObjectId(userId),
      deleted_at: null,
      status: 'unread',
    });
    return { count };
  }

  async sendNotificationToToken(request: NotificationRequestDto): Promise<string> {
    if (!request.token || !request.token.trim()) {
      throw new BadRequestException('Token is required and cannot be empty');
    }

    const messaging = this.firebaseService.getMessaging();

    const message: admin.messaging.Message = {
      data: {
        FCM: 'https://firebase.google.com/docs/cloud-messaging',
        flutter: 'https://flutter.dev/',
        ...(request.data || {}),
      },
      notification: {
        title: request.title,
        body: request.body,
      },
      token: request.token.trim(),
    };

    try {
      const response = await messaging.send(message);
      console.log('Notification sent: ', response);
      return response;
    } catch (error) {
      console.error('Error sending notification: ', error);
      throw error;
    }
  }

  async createDirectNotification(
    userId: string,
    title: string,
    body: string,
    type: string = 'forum',
    metadata?: Record<string, any>,
    cta_url?: string,
  ): Promise<void> {
    // Create a unique template for each notification to avoid unique constraint issues
    // The unique index on template_id + user_id means we need a unique template per notification
    const uniqueTemplateType = `direct_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const template = await this.templateModel.create({
      title: title.substring(0, 100), // Template title (max length)
      body: body.substring(0, 200), // Template body (max length)
      type: uniqueTemplateType,
      is_active: true,
    });

    // Create notification with the unique template
    await this.userNotificationModel.create({
      template_id: template._id,
      user_id: new Types.ObjectId(userId),
      status: 'unread',
      payload: {
        title,
        body,
        type,
        metadata: metadata || {},
        cta_url,
      },
    });
  }

  // Admin methods
  async updateTemplateAsAdmin(templateId: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.templateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    if (dto.title !== undefined) template.title = dto.title;
    if (dto.body !== undefined) template.body = dto.body;
    if (dto.type !== undefined) template.type = dto.type;
    if (dto.metadata !== undefined) template.metadata = dto.metadata;
    if (dto.cta_text !== undefined) template.cta_text = dto.cta_text;
    if (dto.cta_url !== undefined) template.cta_url = dto.cta_url;
    if (dto.schedule_at !== undefined) {
      template.schedule_at = dto.schedule_at ? new Date(dto.schedule_at) : undefined;
    }
    if (dto.is_active !== undefined) template.is_active = dto.is_active;

    await template.save();
    return {
      _id: template._id.toString(),
      title: template.title,
      body: template.body,
      type: template.type,
      metadata: template.metadata || {},
      cta_text: template.cta_text,
      cta_url: template.cta_url,
      schedule_at: template.schedule_at,
      is_active: template.is_active,
      created_at: (template as any).createdAt,
      updated_at: (template as any).updatedAt,
    };
  }

  async deleteTemplateAsAdmin(templateId: string) {
    const template = await this.templateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    await template.deleteOne();
    return { success: true, message: 'Template deleted successfully' };
  }

  async sendNotificationAsAdmin(dto: SendNotificationDto) {
    // If sending to a single user
    if (dto.user_id) {
      await this.createDirectNotification(
        dto.user_id,
        dto.title,
        dto.body,
        dto.type || 'general',
        dto.metadata,
        dto.cta_url,
      );
      return { success: true, message: 'Notification sent successfully', recipients: 1 };
    }

    // If broadcasting
    let targetUsers: Types.ObjectId[] = [];

    if (dto.send_to_all) {
      const users = await this.userModel.find({ is_disabled: { $ne: true } }, '_id').lean();
      targetUsers = users.map((u) => u._id as Types.ObjectId);
    } else if (dto.user_ids && dto.user_ids.length) {
      targetUsers = dto.user_ids.map((id) => new Types.ObjectId(id));
    } else {
      throw new BadRequestException('Please specify user_id, send_to_all, or provide user_ids');
    }

    if (!targetUsers.length) {
      throw new BadRequestException('No target users found for this notification');
    }

    // Create a unique template for this notification
    const uniqueTemplateType = `admin_${dto.type || 'general'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const template = await this.templateModel.create({
      title: dto.title.substring(0, 100),
      body: dto.body.substring(0, 200),
      type: uniqueTemplateType,
      is_active: true,
      metadata: dto.metadata || {},
      cta_text: dto.cta_text,
      cta_url: dto.cta_url,
    });

    const payload = {
      title: dto.title,
      body: dto.body,
      type: dto.type || 'general',
      metadata: dto.metadata || {},
      cta_text: dto.cta_text,
      cta_url: dto.cta_url,
    };

    const operations = targetUsers.map((userId) => ({
      updateOne: {
        filter: { template_id: template._id, user_id: userId },
        update: {
          $setOnInsert: {
            template_id: template._id,
            user_id: userId,
            payload,
            status: 'unread',
            deleted_at: null,
            read_at: null,
          },
        },
        upsert: true,
      },
    }));

    await this.userNotificationModel.bulkWrite(operations, { ordered: false });

    return { success: true, message: 'Notification sent successfully', recipients: targetUsers.length };
  }
}

