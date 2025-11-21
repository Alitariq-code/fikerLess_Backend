import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationRequestDto } from './dto/notification-request.dto';

@Controller('api/notify')
export class FcmNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('chat')
  async sendChatNotification(@Body() request: NotificationRequestDto) {
    try {
      const response = await this.notificationService.sendNotificationToToken(
        request,
      );
      return {
        success: true,
        message: 'Notification sent',
        responseId: response,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Error sending notification',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

