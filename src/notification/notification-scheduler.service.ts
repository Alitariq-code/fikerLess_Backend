import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Session, SessionDocument, SessionStatus } from '../models/schemas/session.schema';
import { SessionRequest, SessionRequestDocument, SessionRequestStatus } from '../models/schemas/session-request.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { NotificationService } from './notification.service';
import moment from 'moment-timezone';

@Injectable()
export class NotificationSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private readonly REMINDER_24H_WINDOW_MINUTES = 5; // 5-minute window for 24h reminder
  private readonly REMINDER_1H_WINDOW_MINUTES = 5; // 5-minute window for 1h reminder
  private readonly PAYMENT_REMINDER_WINDOW_MINUTES = 5; // Remind 5 minutes before expiry

  // Track sent reminders to avoid duplicates
  private sent24hReminders = new Set<string>(); // session_id -> reminder sent
  private sent1hReminders = new Set<string>(); // session_id -> reminder sent
  private sentPaymentReminders = new Set<string>(); // request_id -> reminder sent
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(SessionRequest.name) private sessionRequestModel: Model<SessionRequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
  ) {
    // Clean up reminder tracking sets periodically (every 24 hours)
    this.cleanupInterval = setInterval(() => {
      const beforeSize = this.sent24hReminders.size + this.sent1hReminders.size + this.sentPaymentReminders.size;
      this.sent24hReminders.clear();
      this.sent1hReminders.clear();
      this.sentPaymentReminders.clear();
      this.logger.debug(`Cleared reminder tracking sets (freed ${beforeSize} entries)`);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  onModuleDestroy() {
    // Clean up interval on module destruction to prevent memory leaks
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.debug('Cleaned up reminder tracking interval');
    }
  }

  /**
   * Check and send session reminders (24 hours before)
   * Runs every 30 minutes
   */
  @Cron('0 */30 * * * *') // Every 30 minutes
  async handleSession24HourReminders() {
    this.logger.debug('Running 24-hour session reminder check...');
    
    try {
      const now = moment();
      const reminderTime = now.clone().add(24, 'hours');
      const windowStart = reminderTime.clone().subtract(this.REMINDER_24H_WINDOW_MINUTES, 'minutes');
      const windowEnd = reminderTime.clone().add(this.REMINDER_24H_WINDOW_MINUTES, 'minutes');

      // Find sessions starting between windowStart and windowEnd
      const sessions = await this.sessionModel
        .find({
          status: SessionStatus.CONFIRMED,
          date: {
            $gte: windowStart.format('YYYY-MM-DD'),
            $lte: windowEnd.format('YYYY-MM-DD'),
          },
        })
        .populate('user_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name')
        .lean();

      let remindersSent = 0;

      for (const session of sessions) {
        const sessionId = session._id.toString();
        
        // Skip if already sent
        if (this.sent24hReminders.has(sessionId)) {
          continue;
        }

        // Validate session data
        if (!session.date || !session.start_time) {
          this.logger.warn(`Skipping session ${sessionId}: missing date or start_time`);
          continue;
        }

        // Calculate session datetime
        const sessionDateTime = moment.tz(
          `${session.date} ${session.start_time}`,
          'YYYY-MM-DD HH:mm',
          'Asia/Karachi', // Adjust timezone as needed
        );

        // Validate datetime
        if (!sessionDateTime.isValid()) {
          this.logger.warn(`Skipping session ${sessionId}: invalid date/time format`);
          continue;
        }

        // Check if session is within 24h window (±5 minutes)
        const hoursUntilSession = sessionDateTime.diff(now, 'hours', true);
        if (hoursUntilSession >= 23.5 && hoursUntilSession <= 24.5) {
          const user = session.user_id as any;
          const doctor = session.doctor_id as any;
          
          // Validate user and doctor exist
          if (!user || !doctor) {
            this.logger.warn(`Skipping session ${sessionId}: missing user or doctor data`);
            continue;
          }

          const doctorName = doctor 
            ? `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || 'your specialist'
            : 'your specialist';

          // Send reminder to user
          const userReminderSent = await this.notificationService.sendFcmPushNotification(
            session.user_id.toString(),
            'Session Reminder - Tomorrow',
            `You have a session with ${doctorName} tomorrow at ${session.start_time}. Don't forget!`,
            'booking_reminder',
            {
              session_id: sessionId,
              doctor_id: session.doctor_id.toString(),
              date: session.date,
              start_time: session.start_time,
              end_time: session.end_time,
              reminder_type: '24h',
            },
            true, // Check appointment_reminders setting
          );

          // Send reminder to doctor
          const doctorReminderSent = await this.notificationService.sendFcmPushNotification(
            session.doctor_id.toString(),
            'Session Reminder - Tomorrow',
            `You have a session with ${user?.first_name || 'a client'} ${user?.last_name || ''} tomorrow at ${session.start_time}.`,
            'booking_reminder',
            {
              session_id: sessionId,
              user_id: session.user_id.toString(),
              date: session.date,
              start_time: session.start_time,
              end_time: session.end_time,
              reminder_type: '24h',
            },
            true, // Check appointment_reminders setting
          );

          if (userReminderSent || doctorReminderSent) {
            this.sent24hReminders.add(sessionId);
            remindersSent++;
            this.logger.log(
              `24h reminder sent for session ${sessionId} (user: ${userReminderSent}, doctor: ${doctorReminderSent})`,
            );
          }
        }
      }

      if (remindersSent > 0) {
        this.logger.log(`Sent ${remindersSent} 24-hour session reminders`);
      }
    } catch (error) {
      this.logger.error(`Error in 24-hour session reminder check: ${error.message}`, error.stack);
    }
  }

  /**
   * Check and send session reminders (1 hour before)
   * Runs every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async handleSession1HourReminders() {
    this.logger.debug('Running 1-hour session reminder check...');
    
    try {
      const now = moment();
      const reminderTime = now.clone().add(1, 'hour');
      const windowStart = reminderTime.clone().subtract(this.REMINDER_1H_WINDOW_MINUTES, 'minutes');
      const windowEnd = reminderTime.clone().add(this.REMINDER_1H_WINDOW_MINUTES, 'minutes');

      // Find sessions starting between windowStart and windowEnd
      // Only get confirmed sessions that haven't been cancelled
      const sessions = await this.sessionModel
        .find({
          status: SessionStatus.CONFIRMED,
          date: {
            $gte: windowStart.format('YYYY-MM-DD'),
            $lte: windowEnd.format('YYYY-MM-DD'),
          },
          cancelled_at: { $exists: false }, // Exclude cancelled sessions
        })
        .populate('user_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name')
        .lean()
        .limit(100); // Limit to prevent processing too many at once

      let remindersSent = 0;

      for (const session of sessions) {
        const sessionId = session._id.toString();
        
        // Skip if already sent
        if (this.sent1hReminders.has(sessionId)) {
          continue;
        }

        // Validate session data
        if (!session.date || !session.start_time) {
          this.logger.warn(`Skipping session ${sessionId}: missing date or start_time`);
          continue;
        }

        // Calculate session datetime
        const sessionDateTime = moment.tz(
          `${session.date} ${session.start_time}`,
          'YYYY-MM-DD HH:mm',
          'Asia/Karachi', // Adjust timezone as needed
        );

        // Validate datetime
        if (!sessionDateTime.isValid()) {
          this.logger.warn(`Skipping session ${sessionId}: invalid date/time format`);
          continue;
        }

        // Check if session is within 1h window (±5 minutes)
        const minutesUntilSession = sessionDateTime.diff(now, 'minutes', true);
        if (minutesUntilSession >= 55 && minutesUntilSession <= 65) {
          const user = session.user_id as any;
          const doctor = session.doctor_id as any;
          
          // Validate user and doctor exist
          if (!user || !doctor) {
            this.logger.warn(`Skipping session ${sessionId}: missing user or doctor data`);
            continue;
          }

          const doctorName = doctor 
            ? `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || 'your specialist'
            : 'your specialist';

          // Send reminder to user
          const userReminderSent = await this.notificationService.sendFcmPushNotification(
            session.user_id.toString(),
            'Session Starting Soon',
            `Your session with ${doctorName} starts in 1 hour at ${session.start_time}. Please be ready!`,
            'booking_reminder',
            {
              session_id: sessionId,
              doctor_id: session.doctor_id.toString(),
              date: session.date,
              start_time: session.start_time,
              end_time: session.end_time,
              reminder_type: '1h',
            },
            true, // Check appointment_reminders setting
          );

          // Send reminder to doctor
          const doctorReminderSent = await this.notificationService.sendFcmPushNotification(
            session.doctor_id.toString(),
            'Session Starting Soon',
            `Your session with ${user?.first_name || 'a client'} ${user?.last_name || ''} starts in 1 hour at ${session.start_time}.`,
            'booking_reminder',
            {
              session_id: sessionId,
              user_id: session.user_id.toString(),
              date: session.date,
              start_time: session.start_time,
              end_time: session.end_time,
              reminder_type: '1h',
            },
            true, // Check appointment_reminders setting
          );

          if (userReminderSent || doctorReminderSent) {
            this.sent1hReminders.add(sessionId);
            remindersSent++;
            this.logger.log(
              `1h reminder sent for session ${sessionId} (user: ${userReminderSent}, doctor: ${doctorReminderSent})`,
            );
          }
        }
      }

      if (remindersSent > 0) {
        this.logger.log(`Sent ${remindersSent} 1-hour session reminders`);
      }
    } catch (error) {
      this.logger.error(`Error in 1-hour session reminder check: ${error.message}`, error.stack);
    }
  }

  /**
   * Check and send payment upload reminders (5 minutes before expiry)
   * Runs every 2 minutes
   */
  @Cron('0 */2 * * * *') // Every 2 minutes
  async handlePaymentUploadReminders() {
    this.logger.debug('Running payment upload reminder check...');
    
    try {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + this.PAYMENT_REMINDER_WINDOW_MINUTES * 60 * 1000);

      // Find session requests expiring in ~5 minutes that haven't been reminded
      const requests = await this.sessionRequestModel
        .find({
          status: SessionRequestStatus.PENDING_PAYMENT,
          expires_at: {
            $gte: new Date(reminderTime.getTime() - 2 * 60 * 1000), // 2 min buffer
            $lte: new Date(reminderTime.getTime() + 2 * 60 * 1000), // 2 min buffer
          },
        })
        .populate('user_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name')
        .lean()
        .limit(100); // Limit to prevent processing too many at once

      let remindersSent = 0;

      for (const request of requests) {
        const requestId = request._id.toString();
        
        // Skip if already sent
        if (this.sentPaymentReminders.has(requestId)) {
          continue;
        }

          // Check if payment is expiring in ~5 minutes
          if (request.expires_at) {
            const expiresAt = moment(request.expires_at);
            
            if (!expiresAt.isValid()) {
              this.logger.warn(`Skipping request ${requestId}: invalid expires_at date`);
              continue;
            }

            const minutesUntilExpiry = expiresAt.diff(moment(), 'minutes', true);
            
            if (minutesUntilExpiry >= 4 && minutesUntilExpiry <= 6) {
              const user = request.user_id as any;
              const doctor = request.doctor_id as any;
              
              // Validate user and doctor exist
              if (!user || !doctor) {
                this.logger.warn(`Skipping request ${requestId}: missing user or doctor data`);
                continue;
              }

              const doctorName = doctor 
                ? `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || 'your specialist'
                : 'your specialist';

            // Send reminder to user
            const reminderSent = await this.notificationService.sendFcmPushNotification(
              request.user_id.toString(),
              'Payment Upload Reminder',
              `Your payment for the session with ${doctorName} expires in 5 minutes. Please upload your payment screenshot now!`,
              'payment_reminder',
              {
                request_id: requestId,
                doctor_id: request.doctor_id.toString(),
                date: request.date,
                start_time: request.start_time,
                expires_at: request.expires_at.toISOString(),
              },
              true, // Check payment_notifications setting (automatically checked based on type)
            );

            if (reminderSent) {
              this.sentPaymentReminders.add(requestId);
              remindersSent++;
              this.logger.log(`Payment upload reminder sent for request ${requestId}`);
            }
          }
        }
      }

      if (remindersSent > 0) {
        this.logger.log(`Sent ${remindersSent} payment upload reminders`);
      }
    } catch (error) {
      this.logger.error(`Error in payment upload reminder check: ${error.message}`, error.stack);
    }
  }

  /**
   * Manually trigger reminder checks (useful for testing)
   */
  async triggerReminderChecks() {
    this.logger.log('Manually triggering reminder checks...');
    await Promise.all([
      this.handleSession24HourReminders(),
      this.handleSession1HourReminders(),
      this.handlePaymentUploadReminders(),
    ]);
  }
}

