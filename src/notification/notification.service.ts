import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
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
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { FcmToken, FcmTokenDocument } from '../models/schemas/fcm-token.schema';
import { NotificationSettings, NotificationSettingsDocument } from '../models/schemas/notification-settings.schema';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(NotificationTemplate.name) private templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(UserNotification.name) private userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(FcmToken.name) private fcmTokenModel: Model<FcmTokenDocument>,
    @InjectModel(NotificationSettings.name) private notificationSettingsModel: Model<NotificationSettingsDocument>,
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
    const query: Record<string, any> = {
      // Exclude templates that start with "direct_" prefix (user activity notifications)
      type: { $not: /^direct_/ },
    };
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

    // Always exclude templates that start with "direct_" prefix (user activity notifications)
    const typeConditions: any[] = [{ type: { $not: /^direct_/ } }];

    if (type && type !== 'all') {
      // If specific type is requested, match it but still exclude direct_ templates
      typeConditions.push({ type });
    }

    // Use $and to combine type conditions
    if (typeConditions.length > 1) {
      query.$and = typeConditions;
    } else {
      query.type = { $not: /^direct_/ };
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.is_active = isActive === 'true';
    }

    if (search) {
      const searchConditions = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { body: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } },
        ],
      };

      // Combine type filter with search conditions
      if (query.$and) {
        query.$and.push(searchConditions);
      } else if (query.type) {
        query.$and = [
          { type: { $not: /^direct_/ } },
          searchConditions,
        ];
        delete query.type;
      } else {
        query.$and = [{ type: { $not: /^direct_/ } }, searchConditions];
      }
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

  /**
   * Send FCM push notification to a user by user ID
   * This is a production-ready helper method that handles:
   * - FCM token retrieval
   * - Notification settings check
   * - Error handling (graceful failures)
   * - Proper logging
   * 
   * @param userId - User ID to send notification to
   * @param title - Notification title
   * @param body - Notification body
   * @param type - Notification type (e.g., 'booking', 'forum', 'achievement', 'payment_approved', 'payment_reminder')
   * @param metadata - Additional metadata to include in the notification
   * @param checkAppointmentReminders - Whether to check appointment_reminders or payment_notifications setting (default: false)
   * @returns Promise<boolean> - Returns true if notification was sent successfully, false otherwise
   */
  async sendFcmPushNotification(
    userId: string,
    title: string,
    body: string,
    type: string = 'general',
    metadata?: Record<string, any>,
    checkAppointmentReminders: boolean = false,
  ): Promise<boolean> {
    try {
      // Input validation
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        this.logger.warn('FCM notification skipped: invalid userId provided');
        return false;
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`FCM notification skipped: invalid userId format: ${userId}`);
        return false;
      }

      // Validate title and body
      if (!title || typeof title !== 'string' || title.trim() === '') {
        this.logger.warn(`FCM notification skipped for user ${userId}: empty or invalid title`);
        return false;
      }

      if (!body || typeof body !== 'string' || body.trim() === '') {
        this.logger.warn(`FCM notification skipped for user ${userId}: empty or invalid body`);
        return false;
      }

      const userIdObj = new Types.ObjectId(userId);

      // Check notification settings if required
      if (checkAppointmentReminders) {
        const settings = await this.notificationSettingsModel.findOne({ user_id: userIdObj }).exec();
        if (settings) {
          // Check payment_notifications for payment-related notifications
          if (type === 'payment_approved' || type === 'payment_reminder') {
            if (!settings.payment_notifications) {
              this.logger.debug(`FCM notification skipped for user ${userId}: payment_notifications is disabled`);
              return false;
            }
          } else {
            // Check appointment_reminders for booking-related notifications
            if (!settings.appointment_reminders) {
              this.logger.debug(`FCM notification skipped for user ${userId}: appointment_reminders is disabled`);
              return false;
            }
          }
        }
      }

      // Get user's FCM token
      const fcmTokenDoc = await this.fcmTokenModel.findOne({ user_id: userIdObj }).exec();
      if (!fcmTokenDoc || !fcmTokenDoc.fcm_token || !fcmTokenDoc.fcm_token.trim()) {
        this.logger.debug(`FCM notification skipped for user ${userId}: no FCM token found`);
        return false;
      }

      const messaging = this.firebaseService.getMessaging();

      // Prepare notification data payload
      const dataPayload: Record<string, string> = {
        type,
        notification_type: type,
        ...(metadata || {}),
      };

      // Convert all metadata values to strings (FCM data payload requires string values)
      // FCM has a limit of 4KB for the entire data payload
      let totalSize = 0;
      const maxPayloadSize = 4000; // 4KB limit
      
      Object.keys(dataPayload).forEach((key) => {
        if (typeof dataPayload[key] !== 'string') {
          dataPayload[key] = JSON.stringify(dataPayload[key]);
        }
        // Estimate size (rough calculation)
        totalSize += key.length + dataPayload[key].length;
      });

      // If payload is too large, truncate or remove some metadata
      if (totalSize > maxPayloadSize) {
        this.logger.warn(`FCM data payload too large (${totalSize} bytes) for user ${userId}, truncating metadata`);
        // Keep only essential fields
        const essentialKeys = ['type', 'notification_type'];
        const newPayload: Record<string, string> = {};
        essentialKeys.forEach(key => {
          if (dataPayload[key]) {
            newPayload[key] = dataPayload[key];
          }
        });
        // Add other keys until we hit the limit
        Object.keys(dataPayload).forEach(key => {
          if (!essentialKeys.includes(key) && newPayload[key] === undefined) {
            const estimatedSize = key.length + dataPayload[key].length;
            if (Object.values(newPayload).reduce((sum, val) => sum + val.length, 0) + estimatedSize < maxPayloadSize) {
              newPayload[key] = dataPayload[key];
            }
          }
        });
        Object.assign(dataPayload, newPayload);
      }

      // Validate and sanitize FCM token
      const fcmToken = fcmTokenDoc.fcm_token.trim();
      if (!fcmToken || fcmToken.length < 10) {
        this.logger.warn(`FCM notification skipped for user ${userId}: invalid token format`);
        return false;
      }

      const message: admin.messaging.Message = {
        data: dataPayload,
        notification: {
          title: title.trim().substring(0, 100), // FCM title limit
          body: body.trim().substring(0, 200), // FCM body limit
        },
        token: fcmToken,
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high' as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // Send notification
      const response = await messaging.send(message);
      this.logger.log(`FCM push notification sent successfully to user ${userId} (type: ${type}) - Message ID: ${response}`);
      return true;
    } catch (error: any) {
      // Handle specific FCM errors
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-argument') {
        // Token is invalid or expired, remove it from database
        this.logger.warn(`Invalid FCM token for user ${userId} (code: ${error.code}), removing from database`);
        try {
          if (Types.ObjectId.isValid(userId)) {
            await this.fcmTokenModel.deleteOne({ user_id: new Types.ObjectId(userId) }).exec();
          }
        } catch (deleteError: any) {
          this.logger.error(`Failed to delete invalid FCM token for user ${userId}:`, deleteError?.message || deleteError);
        }
        return false;
      }

      // Handle rate limiting errors
      if (error.code === 'messaging/quota-exceeded' || error.code === 'messaging/unavailable') {
        this.logger.warn(`FCM service unavailable or quota exceeded for user ${userId}: ${error.message}`);
        return false;
      }

      // Log other errors but don't throw (graceful failure)
      this.logger.error(
        `Failed to send FCM push notification to user ${userId} (type: ${type}): ${error.message || error}`,
        error.stack || error,
      );
      return false;
    }
  }

  async createDirectNotification(
    userId: string,
    title: string,
    body: string,
    type: string = 'forum',
    metadata?: Record<string, any>,
    cta_url?: string,
  ): Promise<boolean> {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        this.logger.warn(`createDirectNotification: Invalid userId provided: ${userId}`);
        return false;
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`createDirectNotification: Invalid userId format: ${userId}`);
        return false;
      }

      // Validate title and body
      if (!title || typeof title !== 'string' || title.trim() === '') {
        this.logger.warn(`createDirectNotification: Invalid title for user ${userId}`);
        return false;
      }

      if (!body || typeof body !== 'string' || body.trim() === '') {
        this.logger.warn(`createDirectNotification: Invalid body for user ${userId}`);
        return false;
      }

      const userIdObj = new Types.ObjectId(userId);
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        metadata: metadata || {},
        cta_url,
      };

      // For forum notifications, check for exact duplicates (same post/comment + same liker/commenter)
      // This prevents duplicate notifications when the same user likes/comments multiple times
      // But allows multiple notifications from different users
      let existing = null;
      
      if (type === 'forum_like' && metadata?.post_id && metadata?.liker_id) {
        // Check for existing like notification from same liker on same post
        existing = await this.userNotificationModel.findOne({
          user_id: userIdObj,
          'payload.type': 'forum_like',
          'payload.metadata.post_id': metadata.post_id,
          'payload.metadata.liker_id': metadata.liker_id,
          deleted_at: null,
        }).exec();
      } else if ((type === 'forum_comment' || type === 'forum_comment_reply') && metadata?.comment_id && metadata?.commenter_id) {
        // Check for existing comment notification from same commenter on same comment
        existing = await this.userNotificationModel.findOne({
          user_id: userIdObj,
          'payload.type': { $in: ['forum_comment', 'forum_comment_reply'] },
          'payload.metadata.comment_id': metadata.comment_id,
          'payload.metadata.commenter_id': metadata.commenter_id,
          deleted_at: null,
        }).exec();
      }

      if (existing) {
        // Update existing notification to unread status and refresh content
        existing.status = 'unread';
        existing.read_at = null;
        existing.payload = payload;
        await existing.save();
        this.logger.debug(`Direct notification updated for user ${userId} (type: ${type}, id: ${existing._id})`);
        return true;
      }

      // Create new notification if no duplicate found
      const notification = await this.userNotificationModel.create({
        // template_id is omitted for direct notifications
        user_id: userIdObj,
        status: 'unread',
        payload,
      });
      
      this.logger.debug(`Direct notification created successfully for user ${userId} (type: ${type}, id: ${notification._id})`);
      return true;
    } catch (error: any) {
      // If duplicate key error, try to update existing notification
      if (error.code === 11000) {
        this.logger.debug(`Duplicate notification detected for user ${userId} (type: ${type}), attempting to update`);
        try {
          // Try to find and update the existing notification
          const existing = await this.userNotificationModel.findOne({
            user_id: new Types.ObjectId(userId),
            'payload.type': type,
            deleted_at: null,
          }).sort({ createdAt: -1 }).exec();

          if (existing) {
            existing.status = 'unread';
            existing.read_at = null;
            existing.payload = {
              title: title.trim(),
              body: body.trim(),
              type,
              metadata: metadata || {},
              cta_url,
            };
            await existing.save();
            this.logger.debug(`Duplicate notification updated for user ${userId} (type: ${type})`);
            return true;
          }
        } catch (updateError: any) {
          this.logger.warn(`Failed to update duplicate notification for user ${userId}: ${updateError.message}`);
        }
        return false;
      }
      // Log and return false for other errors (don't throw to prevent breaking the main operation)
      this.logger.error(
        `Failed to create direct notification for user ${userId} (type: ${type}): ${error.message || error}`,
        error.stack || error,
      );
      return false;
    }
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
      const created = await this.createDirectNotification(
        dto.user_id,
        dto.title,
        dto.body,
        dto.type || 'general',
        dto.metadata,
        dto.cta_url,
      );
      if (!created) {
        this.logger.warn(`Failed to create notification for user ${dto.user_id}`);
      }
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

  async upsertFcmToken(userId: string, fcmToken: string): Promise<FcmTokenDocument> {
    const userIdObj = new Types.ObjectId(userId);
    
    return await this.fcmTokenModel.findOneAndUpdate(
      { user_id: userIdObj },
      { 
        user_id: userIdObj,
        fcm_token: fcmToken.trim(),
      },
      { 
        upsert: true, 
        new: true 
      }
    );
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettingsDocument> {
    const userIdObj = new Types.ObjectId(userId);
    let settings = await this.notificationSettingsModel.findOne({ user_id: userIdObj }).exec();
    
    if (!settings) {
      settings = await this.notificationSettingsModel.create({
        user_id: userIdObj,
        email_notifications: true,
        sms_notifications: false,
        appointment_reminders: true,
        payment_notifications: true,
      });
    }
    
    return settings;
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDocument> {
    const userIdObj = new Types.ObjectId(userId);
    
    return await this.notificationSettingsModel.findOneAndUpdate(
      { user_id: userIdObj },
      { $set: dto },
      { upsert: true, new: true },
    );
  }
}

