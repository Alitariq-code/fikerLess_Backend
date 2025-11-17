import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationTemplate, NotificationTemplateDocument } from '../models/schemas/notification-template.schema';
import { UserNotification, UserNotificationDocument } from '../models/schemas/user-notification.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(NotificationTemplate.name) private templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(UserNotification.name) private userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
}

