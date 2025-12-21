import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AvailabilityRule, AvailabilityRuleDocument, DayOfWeek } from '../models/schemas/availability-rule.schema';
import { AvailabilitySettings, AvailabilitySettingsDocument } from '../models/schemas/availability-settings.schema';
import { AvailabilityOverride, AvailabilityOverrideDocument, OverrideType } from '../models/schemas/availability-override.schema';
import { SessionRequest, SessionRequestDocument, SessionRequestStatus } from '../models/schemas/session-request.schema';
import { BlockedSlot, BlockedSlotDocument } from '../models/schemas/blocked-slot.schema';
import { Session, SessionDocument, SessionStatus, SessionType } from '../models/schemas/session.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Demographics, DemographicsDocument } from '../models/schemas/demographics.schema';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilitySettingsDto } from './dto/create-availability-settings.dto';
import { UpdateAvailabilitySettingsDto } from './dto/update-availability-settings.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dto/update-availability-override.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { CreateSessionRequestDto } from './dto/create-session-request.dto';
import { ApproveSessionRequestDto } from './dto/approve-session-request.dto';
import { RejectSessionRequestDto } from './dto/reject-session-request.dto';
import { GetSessionsDto } from './dto/get-sessions.dto';
import { NotificationService } from '../notification/notification.service';
import moment from 'moment-timezone';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly PAYMENT_UPLOAD_EXPIRY_MINUTES = 10; // 10 minutes to upload payment
  private readonly APPROVAL_WAIT_HOURS = 24; // 24 hours for admin to approve

  constructor(
    @InjectModel(AvailabilityRule.name) private availabilityRuleModel: Model<AvailabilityRuleDocument>,
    @InjectModel(AvailabilitySettings.name) private availabilitySettingsModel: Model<AvailabilitySettingsDocument>,
    @InjectModel(AvailabilityOverride.name) private availabilityOverrideModel: Model<AvailabilityOverrideDocument>,
    @InjectModel(SessionRequest.name) private sessionRequestModel: Model<SessionRequestDocument>,
    @InjectModel(BlockedSlot.name) private blockedSlotModel: Model<BlockedSlotDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Demographics.name) private demographicsModel: Model<DemographicsDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Validate that user is a specialist/doctor
   */
  private async validateDoctor(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.user_type !== 'specialist') {
      throw new ForbiddenException('Only specialists can manage availability');
    }
    return user;
  }

  /**
   * Validate time format and ensure start_time < end_time
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('start_time must be before end_time');
    }
  }

  /**
   * Check for overlapping rules on the same day
   */
  private async checkOverlappingRules(
    doctorId: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeRuleId?: string,
  ): Promise<void> {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const doctorObjectId = new Types.ObjectId(doctorId);
    const query: any = {
      doctor_id: doctorObjectId,
      day_of_week: dayOfWeek,
      is_active: true,
    };
    if (excludeRuleId) {
      query._id = { $ne: new Types.ObjectId(excludeRuleId) };
    }
    const existingRules = await this.availabilityRuleModel.find(query);

    for (const rule of existingRules) {
      const [ruleStartHour, ruleStartMin] = rule.start_time.split(':').map(Number);
      const [ruleEndHour, ruleEndMin] = rule.end_time.split(':').map(Number);
      const ruleStartMinutes = ruleStartHour * 60 + ruleStartMin;
      const ruleEndMinutes = ruleEndHour * 60 + ruleEndMin;

      // Check for overlap
      if (
        (startMinutes >= ruleStartMinutes && startMinutes < ruleEndMinutes) ||
        (endMinutes > ruleStartMinutes && endMinutes <= ruleEndMinutes) ||
        (startMinutes <= ruleStartMinutes && endMinutes >= ruleEndMinutes)
      ) {
        throw new BadRequestException(
          `Overlapping availability rule exists for ${dayOfWeek} between ${rule.start_time} and ${rule.end_time}`,
        );
      }
    }
  }

  /**
   * Ensure settings exist before creating rules
   */
  private async ensureSettingsExist(doctorId: string): Promise<void> {
    const doctorObjectId = new Types.ObjectId(doctorId);
    let settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorObjectId });
    if (!settings) {
      // Fallback: try with string format
      settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
    }
    if (!settings) {
      throw new BadRequestException(
        'Availability settings must be created before adding availability rules',
      );
    }
  }

  // ==================== Availability Settings ====================

  async createAvailabilitySettings(doctorId: string, dto: CreateAvailabilitySettingsDto) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const existing = await this.availabilitySettingsModel.findOne({ doctor_id: doctorObjectId });
    if (existing) {
      throw new BadRequestException('Availability settings already exist. Use update endpoint.');
    }

    const settings = await this.availabilitySettingsModel.create({
      doctor_id: doctorObjectId,
      slot_duration_minutes: dto.slot_duration_minutes,
      break_minutes: dto.break_minutes,
      timezone: dto.timezone || 'Asia/Karachi',
    });

    return {
      success: true,
      message: 'Availability settings created successfully',
      data: settings,
    };
  }

  async getAvailabilitySettings(doctorId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    let settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorObjectId });
    if (!settings) {
      // Fallback: try with string format
      settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
    }
    if (!settings) {
      throw new NotFoundException('Availability settings not found');
    }

    return {
      success: true,
      data: settings,
    };
  }

  async updateAvailabilitySettings(doctorId: string, dto: UpdateAvailabilitySettingsDto) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    let settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorObjectId });
    if (!settings) {
      // Fallback: try with string format
      settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
    }
    if (!settings) {
      throw new NotFoundException('Availability settings not found');
    }

    if (dto.slot_duration_minutes !== undefined) {
      settings.slot_duration_minutes = dto.slot_duration_minutes;
    }
    if (dto.break_minutes !== undefined) {
      settings.break_minutes = dto.break_minutes;
    }
    if (dto.timezone !== undefined) {
      settings.timezone = dto.timezone;
    }

    await settings.save();

    return {
      success: true,
      message: 'Availability settings updated successfully',
      data: settings,
    };
  }

  // ==================== Availability Rules ====================

  async createAvailabilityRule(doctorId: string, dto: CreateAvailabilityRuleDto) {
    await this.validateDoctor(doctorId);
    await this.ensureSettingsExist(doctorId);

    this.validateTimeRange(dto.start_time, dto.end_time);
    await this.checkOverlappingRules(doctorId, dto.day_of_week, dto.start_time, dto.end_time);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const rule = await this.availabilityRuleModel.create({
      doctor_id: doctorObjectId,
      day_of_week: dto.day_of_week,
      start_time: dto.start_time,
      end_time: dto.end_time,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    });

    return {
      success: true,
      message: 'Availability rule created successfully',
      data: rule,
    };
  }

  async getAvailabilityRules(doctorId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    let rules = await this.availabilityRuleModel
      .find({ doctor_id: doctorObjectId })
      .sort({ day_of_week: 1, start_time: 1 });
    if (!rules || rules.length === 0) {
      // Fallback: try with string format
      rules = await this.availabilityRuleModel
        .find({ doctor_id: doctorId })
        .sort({ day_of_week: 1, start_time: 1 });
    }

    return {
      success: true,
      data: rules,
    };
  }

  async getAvailabilityRuleById(doctorId: string, ruleId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const ruleObjectId = new Types.ObjectId(ruleId);
    const rule = await this.availabilityRuleModel.findOne({
      _id: ruleObjectId,
      doctor_id: doctorObjectId,
    });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    return {
      success: true,
      data: rule,
    };
  }

  async updateAvailabilityRule(doctorId: string, ruleId: string, dto: UpdateAvailabilityRuleDto) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const ruleObjectId = new Types.ObjectId(ruleId);
    const rule = await this.availabilityRuleModel.findOne({
      _id: ruleObjectId,
      doctor_id: doctorObjectId,
    });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    // If updating times, validate them
    const startTime = dto.start_time || rule.start_time;
    const endTime = dto.end_time || rule.end_time;
    const dayOfWeek = dto.day_of_week || rule.day_of_week;

    if (dto.start_time || dto.end_time) {
      this.validateTimeRange(startTime, endTime);
    }

    // Check for overlaps if day or time is being changed
    if (dto.day_of_week || dto.start_time || dto.end_time) {
      await this.checkOverlappingRules(doctorId, dayOfWeek, startTime, endTime, ruleId);
    }

    if (dto.day_of_week !== undefined) {
      rule.day_of_week = dto.day_of_week;
    }
    if (dto.start_time !== undefined) {
      rule.start_time = dto.start_time;
    }
    if (dto.end_time !== undefined) {
      rule.end_time = dto.end_time;
    }
    if (dto.is_active !== undefined) {
      rule.is_active = dto.is_active;
    }

    await rule.save();

    return {
      success: true,
      message: 'Availability rule updated successfully',
      data: rule,
    };
  }

  async deleteAvailabilityRule(doctorId: string, ruleId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const ruleObjectId = new Types.ObjectId(ruleId);
    const rule = await this.availabilityRuleModel.findOneAndDelete({
      _id: ruleObjectId,
      doctor_id: doctorObjectId,
    });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    return {
      success: true,
      message: 'Availability rule deleted successfully',
    };
  }

  // ==================== Availability Overrides ====================

  async createAvailabilityOverride(doctorId: string, dto: CreateAvailabilityOverrideDto) {
    await this.validateDoctor(doctorId);

    // Validate date is in the future
    const overrideDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (overrideDate < today) {
      throw new BadRequestException('Override date must be today or in the future');
    }

    // Validate CUSTOM type requires times
    if (dto.type === OverrideType.CUSTOM) {
      if (!dto.start_time || !dto.end_time) {
        throw new BadRequestException('start_time and end_time are required for CUSTOM type');
      }
      this.validateTimeRange(dto.start_time, dto.end_time);
    }

    const doctorObjectId = new Types.ObjectId(doctorId);
    // Check if override already exists for this date
    const existing = await this.availabilityOverrideModel.findOne({
      doctor_id: doctorObjectId,
      date: dto.date,
    });

    if (existing) {
      throw new BadRequestException(
        `Override already exists for date ${dto.date}. Use update endpoint.`,
      );
    }

    const override = await this.availabilityOverrideModel.create({
      doctor_id: doctorObjectId,
      date: dto.date,
      type: dto.type,
      start_time: dto.start_time,
      end_time: dto.end_time,
      reason: dto.reason,
    });

    return {
      success: true,
      message: 'Availability override created successfully',
      data: override,
    };
  }

  async getAvailabilityOverrides(doctorId: string, startDate?: string, endDate?: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const query: any = { doctor_id: doctorObjectId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
    }

    let overrides = await this.availabilityOverrideModel
      .find(query)
      .sort({ date: 1 });
    if (!overrides || overrides.length === 0) {
      // Fallback: try with string format
      const stringQuery: any = { doctor_id: doctorId };
      if (startDate || endDate) {
        stringQuery.date = {};
        if (startDate) {
          stringQuery.date.$gte = startDate;
        }
        if (endDate) {
          stringQuery.date.$lte = endDate;
        }
      }
      overrides = await this.availabilityOverrideModel
        .find(stringQuery)
        .sort({ date: 1 });
    }

    return {
      success: true,
      data: overrides,
    };
  }

  async getAvailabilityOverrideById(doctorId: string, overrideId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const overrideObjectId = new Types.ObjectId(overrideId);
    const override = await this.availabilityOverrideModel.findOne({
      _id: overrideObjectId,
      doctor_id: doctorObjectId,
    });

    if (!override) {
      throw new NotFoundException('Availability override not found');
    }

    return {
      success: true,
      data: override,
    };
  }

  async updateAvailabilityOverride(
    doctorId: string,
    overrideId: string,
    dto: UpdateAvailabilityOverrideDto,
  ) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const overrideObjectId = new Types.ObjectId(overrideId);
    const override = await this.availabilityOverrideModel.findOne({
      _id: overrideObjectId,
      doctor_id: doctorObjectId,
    });

    if (!override) {
      throw new NotFoundException('Availability override not found');
    }

    // Validate date if being updated
    if (dto.date) {
      const overrideDate = new Date(dto.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (overrideDate < today) {
        throw new BadRequestException('Override date must be today or in the future');
      }
    }

    // Validate CUSTOM type requires times
    const type = dto.type || override.type;
    const startTime = dto.start_time || override.start_time;
    const endTime = dto.end_time || override.end_time;

    if (type === OverrideType.CUSTOM) {
      if (!startTime || !endTime) {
        throw new BadRequestException('start_time and end_time are required for CUSTOM type');
      }
      this.validateTimeRange(startTime, endTime);
    }

    if (dto.date !== undefined) {
      override.date = dto.date;
    }
    if (dto.type !== undefined) {
      override.type = dto.type;
    }
    if (dto.start_time !== undefined) {
      override.start_time = dto.start_time;
    }
    if (dto.end_time !== undefined) {
      override.end_time = dto.end_time;
    }
    if (dto.reason !== undefined) {
      override.reason = dto.reason;
    }

    await override.save();

    return {
      success: true,
      message: 'Availability override updated successfully',
      data: override,
    };
  }

  async deleteAvailabilityOverride(doctorId: string, overrideId: string) {
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const overrideObjectId = new Types.ObjectId(overrideId);
    const override = await this.availabilityOverrideModel.findOneAndDelete({
      _id: overrideObjectId,
      doctor_id: doctorObjectId,
    });

    if (!override) {
      throw new NotFoundException('Availability override not found');
    }

    return {
      success: true,
      message: 'Availability override deleted successfully',
    };
  }

  // ==================== Slot Generation & Session Requests ====================

  /**
   * Get day of week from date string (YYYY-MM-DD)
   */
  private getDayOfWeek(dateStr: string): DayOfWeek {
    const date = moment(dateStr, 'YYYY-MM-DD');
    const dayNames: DayOfWeek[] = [
      DayOfWeek.SUN,
      DayOfWeek.MON,
      DayOfWeek.TUE,
      DayOfWeek.WED,
      DayOfWeek.THU,
      DayOfWeek.FRI,
      DayOfWeek.SAT,
    ];
    return dayNames[date.day()];
  }

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:mm)
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Generate available slots for a doctor on a specific date
   */
  async getAvailableSlots(doctorId: string, dto: GetAvailableSlotsDto) {
    // Validate doctor exists and is a specialist
    const doctor = await this.validateDoctor(dto.doctor_id);
    const doctorObjectId = new Types.ObjectId(dto.doctor_id);

    // Validate date is today or in the future
    const requestedDate = moment(dto.date, 'YYYY-MM-DD').startOf('day');
    const today = moment().startOf('day');
    // Check if date is before today (not same day)
    if (requestedDate.isBefore(today)) {
      throw new BadRequestException('Cannot get slots for past dates');
    }

    // Get doctor's availability settings (handle both ObjectId and string formats)
    let settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorObjectId });
    if (!settings) {
      // Fallback: try with string format (for existing data that might be stored as string)
      settings = await this.availabilitySettingsModel.findOne({ doctor_id: dto.doctor_id });
    }
    if (!settings) {
      throw new BadRequestException('Doctor has not set up availability settings');
    }

    // Check for date override (handle both ObjectId and string formats)
    let override = await this.availabilityOverrideModel.findOne({
      doctor_id: doctorObjectId,
      date: dto.date,
    });
    if (!override) {
      // Fallback: try with string format
      override = await this.availabilityOverrideModel.findOne({
        doctor_id: dto.doctor_id,
        date: dto.date,
      });
    }

    let availableStartTime: string | null = null;
    let availableEndTime: string | null = null;

    if (override) {
      if (override.type === OverrideType.OFF) {
        // Doctor is completely off
        return {
          success: true,
          data: [],
          message: 'Doctor is not available on this date',
        };
      } else if (override.type === OverrideType.CUSTOM && override.start_time && override.end_time) {
        // Use custom hours from override
        availableStartTime = override.start_time;
        availableEndTime = override.end_time;
      }
    }
    
    // Only use weekly rules if no override or override is not CUSTOM
    if (!availableStartTime || !availableEndTime) {
      // Use weekly rules (handle both ObjectId and string formats)
      const dayOfWeek = this.getDayOfWeek(dto.date);
      let rule = await this.availabilityRuleModel.findOne({
        doctor_id: doctorObjectId,
        day_of_week: dayOfWeek,
        is_active: true,
      });
      if (!rule) {
        // Fallback: try with string format
        rule = await this.availabilityRuleModel.findOne({
          doctor_id: dto.doctor_id,
          day_of_week: dayOfWeek,
          is_active: true,
        });
      }

      if (!rule) {
        return {
          success: true,
          data: [],
          message: 'No availability rule for this day',
        };
      }

      availableStartTime = rule.start_time;
      availableEndTime = rule.end_time;
    }

    if (!availableStartTime || !availableEndTime) {
      return {
        success: true,
        data: [],
        message: 'No availability for this date',
      };
    }

    // Generate slots
    const slotDuration = settings.slot_duration_minutes;
    const breakMinutes = settings.break_minutes;
    const startMinutes = this.timeToMinutes(availableStartTime);
    const endMinutes = this.timeToMinutes(availableEndTime);

    const slots: Array<{ start_time: string; end_time: string }> = [];
    let currentStart = startMinutes;

    while (currentStart < endMinutes) {
      // Check if slot would exceed end time
      if (currentStart + slotDuration > endMinutes) {
        break;
      }

      const slotStart = this.minutesToTime(currentStart);
      const slotEnd = this.minutesToTime(currentStart + slotDuration);

      // Double-check slot doesn't exceed end time
      const slotEndMinutes = this.timeToMinutes(slotEnd);
      if (slotEndMinutes > endMinutes) {
        break;
      }

      // Check if this slot is in the past (for today)
      if (requestedDate.isSame(today, 'day')) {
        const now = moment();
        const slotDateTime = moment(`${dto.date} ${slotStart}`, 'YYYY-MM-DD HH:mm');
        if (slotDateTime.isBefore(now)) {
          currentStart += slotDuration + breakMinutes;
          // Check if new currentStart would exceed end time
          if (currentStart >= endMinutes) {
            break;
          }
          continue;
        }
      }

      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
      });

      currentStart += slotDuration + breakMinutes;
    }

    // Get confirmed sessions for this date (handle both ObjectId and string formats)
    let confirmedSessions = await this.sessionRequestModel.find({
      doctor_id: doctorObjectId,
      date: dto.date,
      status: SessionRequestStatus.CONFIRMED,
    });
    if (confirmedSessions.length === 0) {
      // Fallback: try with string format
      confirmedSessions = await this.sessionRequestModel.find({
        doctor_id: dto.doctor_id,
        date: dto.date,
        status: SessionRequestStatus.CONFIRMED,
      });
    }

    // Get active blocked slots (not expired) (handle both ObjectId and string formats)
    const now = new Date();
    let activeBlocks = await this.blockedSlotModel.find({
      doctor_id: doctorObjectId,
      date: dto.date,
      expires_at: { $gt: now },
    });
    if (activeBlocks.length === 0) {
      // Fallback: try with string format
      activeBlocks = await this.blockedSlotModel.find({
        doctor_id: dto.doctor_id,
        date: dto.date,
        expires_at: { $gt: now },
      });
    }

    // Filter out slots that are booked or blocked, and ensure they don't exceed end time
    const endTimeMinutes = this.timeToMinutes(availableEndTime);
    const availableSlots = slots.filter((slot) => {
      // Ensure slot doesn't exceed available end time
      const slotStartMinutes = this.timeToMinutes(slot.start_time);
      const slotEndMinutes = this.timeToMinutes(slot.end_time);
      if (slotEndMinutes > endTimeMinutes) {
        return false;
      }

      // Check if slot is confirmed
      const isConfirmed = confirmedSessions.some(
        (session) => session.start_time === slot.start_time && session.end_time === slot.end_time,
      );

      // Check if slot is blocked
      const isBlocked = activeBlocks.some(
        (block) => block.start_time === slot.start_time && block.end_time === slot.end_time,
      );

      return !isConfirmed && !isBlocked;
    });

    return {
      success: true,
      data: availableSlots,
    };
  }

  /**
   * Create a session request
   */
  async createSessionRequest(userId: string, dto: CreateSessionRequestDto) {
    // Validate user exists
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate doctor exists and is a specialist
    const doctor = await this.validateDoctor(dto.doctor_id);

    // Validate date is today or in the future
    const requestedDate = moment(dto.date, 'YYYY-MM-DD').startOf('day');
    const today = moment().startOf('day');
    if (requestedDate.isBefore(today)) {
      throw new BadRequestException('Cannot create session request for past dates');
    }

    // Check if slot is available
    const availableSlots = await this.getAvailableSlots(dto.doctor_id, {
      date: dto.date,
      doctor_id: dto.doctor_id,
    });

    const isSlotAvailable = availableSlots.data.some(
      (slot) => slot.start_time === dto.start_time && slot.end_time === dto.end_time,
    );

    if (!isSlotAvailable) {
      throw new BadRequestException('This slot is no longer available');
    }

    // Get doctor's hourly rate from specialist profile
    // For now, we'll use a default amount. In production, fetch from specialist profile
    const amount = 1000; // Default amount, should be fetched from specialist profile
    const currency = 'PKR';

    // Create blocked slot (expires in 10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.PAYMENT_UPLOAD_EXPIRY_MINUTES);

    // Create session request first to get its ID
    const sessionRequest = await this.sessionRequestModel.create({
      doctor_id: new Types.ObjectId(dto.doctor_id),
      user_id: new Types.ObjectId(userId),
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      amount,
      currency,
      status: SessionRequestStatus.PENDING_PAYMENT,
      expires_at: expiresAt,
      session_title: dto.session_title,
      session_type: dto.session_type,
    });

    // Create blocked slot with session request ID
    const blockedSlot = await this.blockedSlotModel.create({
      doctor_id: new Types.ObjectId(dto.doctor_id),
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      expires_at: expiresAt,
      session_request_id: sessionRequest._id,
    });

    // Update session request with blocked slot ID
    sessionRequest.blocked_slot_id = blockedSlot._id;
    await sessionRequest.save();

    return {
      success: true,
      message: 'Session request created successfully. Please upload payment screenshot within 10 minutes.',
      data: {
        ...sessionRequest.toObject(),
        expires_at: expiresAt,
      },
    };
  }

  /**
   * Get user's session requests
   */
  async getUserSessionRequests(userId: string, status?: SessionRequestStatus) {
    const userObjectId = new Types.ObjectId(userId);
    const query: any = { user_id: userObjectId };
    if (status) {
      query.status = status;
    }

    const requests = await this.sessionRequestModel
      .find(query)
      .populate('doctor_id', 'first_name last_name email')
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: requests,
    };
  }

  /**
   * Get session request by ID
   */
  async getSessionRequestById(userId: string, requestId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const requestObjectId = new Types.ObjectId(requestId);
    
    const request = await this.sessionRequestModel
      .findOne({
        _id: requestObjectId,
        $or: [{ user_id: userObjectId }, { doctor_id: userObjectId }], // User or doctor can view
      })
      .populate('doctor_id', 'first_name last_name email')
      .populate('user_id', 'first_name last_name email');

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Upload payment screenshot
   */
  async uploadPaymentScreenshot(
    userId: string,
    requestId: string,
    file: Express.Multer.File,
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const requestObjectId = new Types.ObjectId(requestId);
    
    const request = await this.sessionRequestModel.findOne({
      _id: requestObjectId,
      user_id: userObjectId,
    });

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    if (request.status !== SessionRequestStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot upload payment. Current status: ${request.status}`,
      );
    }

    // Check if payment upload has expired
    if (request.expires_at && new Date() > request.expires_at) {
      request.status = SessionRequestStatus.EXPIRED;
      await request.save();

      // Delete blocked slot
      if (request.blocked_slot_id) {
        await this.blockedSlotModel.findByIdAndDelete(request.blocked_slot_id);
      }

      throw new BadRequestException('Payment upload time has expired. Please create a new request.');
    }

    // Save file URL (assuming file is saved and URL is provided)
    const fileUrl = `/uploads/payments/${file.filename}`;

    request.payment_screenshot_url = fileUrl;
    request.status = SessionRequestStatus.PENDING_APPROVAL;

    // Extend blocked slot expiry (24 hours for admin review)
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + this.APPROVAL_WAIT_HOURS);

    if (request.blocked_slot_id) {
      const blockedSlot = await this.blockedSlotModel.findById(request.blocked_slot_id);
      if (blockedSlot) {
        blockedSlot.expires_at = newExpiry;
        await blockedSlot.save();
      }
    }

    request.expires_at = newExpiry; // Update expiry for admin review
    await request.save();

    return {
      success: true,
      message: 'Payment screenshot uploaded successfully. Waiting for admin approval.',
      data: request,
    };
  }

  /**
   * Cancel session request (only before payment)
   */
  async cancelSessionRequest(userId: string, requestId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const requestObjectId = new Types.ObjectId(requestId);
    
    const request = await this.sessionRequestModel.findOne({
      _id: requestObjectId,
      user_id: userObjectId,
    });

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    if (request.status !== SessionRequestStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot cancel request. Current status: ${request.status}. Only pending payment requests can be cancelled.`,
      );
    }

    // Update status
    request.status = SessionRequestStatus.CANCELLED;
    await request.save();

    // Delete blocked slot
    if (request.blocked_slot_id) {
      await this.blockedSlotModel.findByIdAndDelete(request.blocked_slot_id);
    }

    return {
      success: true,
      message: 'Session request cancelled successfully',
    };
  }

  // ==================== Admin Approval & Session Management ====================

  /**
   * Get pending session requests for admin review
   */
  async getPendingSessionRequests(adminId: string, page: number = 1, limit: number = 20) {
    // Validate admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access pending requests');
    }

    const skip = (page - 1) * limit;
    const requests = await this.sessionRequestModel
      .find({ status: SessionRequestStatus.PENDING_APPROVAL })
      .populate('doctor_id', 'first_name last_name email')
      .populate('user_id', 'first_name last_name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.sessionRequestModel.countDocuments({
      status: SessionRequestStatus.PENDING_APPROVAL,
    });

    return {
      success: true,
      data: requests,
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

  /**
   * Get pending session request details by ID (admin)
   */
  async getPendingSessionRequestById(adminId: string, requestId: string) {
    // Validate admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access pending requests');
    }

    const requestObjectId = new Types.ObjectId(requestId);
    const request = await this.sessionRequestModel
      .findById(requestObjectId)
      .populate('doctor_id', 'first_name last_name email phone')
      .populate('user_id', 'first_name last_name email phone')
      .lean();

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    if (request.status !== SessionRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Request is not pending approval. Current status: ${request.status}`,
      );
    }

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Approve session request and create confirmed session
   */
  async approveSessionRequest(adminId: string, requestId: string, dto: ApproveSessionRequestDto) {
    // Validate admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can approve session requests');
    }

    const requestObjectId = new Types.ObjectId(requestId);
    const request = await this.sessionRequestModel.findById(requestObjectId);

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    if (request.status !== SessionRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve request. Current status: ${request.status}. Only PENDING_APPROVAL requests can be approved.`,
      );
    }

    // Check if slot is still available (no conflicts)
    const existingSession = await this.sessionModel.findOne({
      doctor_id: request.doctor_id,
      date: request.date,
      start_time: request.start_time,
      end_time: request.end_time,
      status: { $in: [SessionStatus.CONFIRMED, SessionStatus.COMPLETED] },
    });

    if (existingSession) {
      throw new BadRequestException(
        'Slot is no longer available. Another session has been confirmed for this time.',
      );
    }

    // Create confirmed session
    const session = await this.sessionModel.create({
      doctor_id: request.doctor_id,
      user_id: request.user_id,
      date: request.date,
      start_time: request.start_time,
      end_time: request.end_time,
      amount: request.amount,
      currency: request.currency,
      status: SessionStatus.CONFIRMED,
      session_request_id: request._id,
      notes: dto.notes || null,
      session_title: request.session_title,
      session_type: request.session_type,
    });

    // Update session request status to CONFIRMED (linked to session)
    // Note: SessionRequestStatus.CONFIRMED indicates the request was approved and a session was created
    request.status = SessionRequestStatus.CONFIRMED;
    await request.save();

    // Delete blocked slot (slot is now confirmed, no longer blocked)
    if (request.blocked_slot_id) {
      await this.blockedSlotModel.findByIdAndDelete(request.blocked_slot_id);
    }

    // Send notifications
    try {
      const doctor = await this.userModel.findById(request.doctor_id);
      const user = await this.userModel.findById(request.user_id);

      // Notify user
      await this.notificationService.createDirectNotification(
        request.user_id.toString(),
        'Session Approved',
        `Your session with ${doctor?.first_name} ${doctor?.last_name} on ${request.date} at ${request.start_time} has been approved.`,
        'booking',
        {
          session_id: session._id.toString(),
          doctor_id: request.doctor_id.toString(),
          date: request.date,
          start_time: request.start_time,
          end_time: request.end_time,
        },
        `/sessions/${session._id}`,
      );

      // Notify doctor
      await this.notificationService.createDirectNotification(
        request.doctor_id.toString(),
        'New Session Booked',
        `${user?.first_name} ${user?.last_name} has booked a session with you on ${request.date} at ${request.start_time}.`,
        'booking',
        {
          session_id: session._id.toString(),
          user_id: request.user_id.toString(),
          date: request.date,
          start_time: request.start_time,
          end_time: request.end_time,
        },
        `/sessions/${session._id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send notifications for approved session: ${error.message}`);
      // Don't fail the approval if notification fails
    }

    // Populate session with user/doctor details
    const populatedSession = await this.sessionModel
      .findById(session._id)
      .populate('doctor_id', 'first_name last_name email')
      .populate('user_id', 'first_name last_name email')
      .lean();

    return {
      success: true,
      message: 'Session request approved and session created successfully',
      data: populatedSession,
    };
  }

  /**
   * Reject session request
   */
  async rejectSessionRequest(adminId: string, requestId: string, dto: RejectSessionRequestDto) {
    // Validate admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can reject session requests');
    }

    const requestObjectId = new Types.ObjectId(requestId);
    const request = await this.sessionRequestModel.findById(requestObjectId);

    if (!request) {
      throw new NotFoundException('Session request not found');
    }

    if (request.status !== SessionRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject request. Current status: ${request.status}. Only PENDING_APPROVAL requests can be rejected.`,
      );
    }

    // Update request status
    request.status = SessionRequestStatus.REJECTED;
    await request.save();

    // Delete blocked slot (release the slot)
    if (request.blocked_slot_id) {
      await this.blockedSlotModel.findByIdAndDelete(request.blocked_slot_id);
    }

    // Send notification to user
    try {
      const doctor = await this.userModel.findById(request.doctor_id);
      await this.notificationService.createDirectNotification(
        request.user_id.toString(),
        'Session Request Rejected',
        `Your session request with ${doctor?.first_name} ${doctor?.last_name} on ${request.date} at ${request.start_time} has been rejected. Reason: ${dto.reason}`,
        'booking',
        {
          request_id: request._id.toString(),
          doctor_id: request.doctor_id.toString(),
          date: request.date,
          rejection_reason: dto.reason,
        },
        null,
      );
    } catch (error) {
      this.logger.error(`Failed to send rejection notification: ${error.message}`);
      // Don't fail the rejection if notification fails
    }

    return {
      success: true,
      message: 'Session request rejected successfully',
    };
  }

  // ==================== Session Queries ====================

  /**
   * Get user's confirmed sessions
   */
  async getUserSessions(userId: string, dto: GetSessionsDto) {
    const userObjectId = new Types.ObjectId(userId);
    const query: any = { user_id: userObjectId };

    // Apply filters
    if (dto.start_date || dto.end_date) {
      query.date = {};
      if (dto.start_date) {
        query.date.$gte = dto.start_date;
      }
      if (dto.end_date) {
        query.date.$lte = dto.end_date;
      }
    }

    if (dto.status) {
      query.status = dto.status;
    }

    const sessions = await this.sessionModel
      .find(query)
      .populate('doctor_id', 'first_name last_name email')
      .sort({ date: 1, start_time: 1 })
      .lean();

    return {
      success: true,
      data: sessions,
    };
  }

  /**
   * Get wallet summary: total earnings and upcoming sessions count
   */
  async getWalletSummary(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const today = moment().format('YYYY-MM-DD');

    const [totalEarnings, upcomingCount] = await Promise.all([
      this.sessionModel.aggregate([
        {
          $match: {
            user_id: userObjectId,
            status: SessionStatus.COMPLETED,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.sessionModel.countDocuments({
        user_id: userObjectId,
        status: SessionStatus.CONFIRMED,
        date: { $gte: today },
      }),
    ]);

    return {
      success: true,
      data: {
        total_earnings: totalEarnings[0]?.total || 0,
        upcoming_sessions: upcomingCount,
      },
    };
  }

  /**
   * Get user's sessions by specific date (optional) with optional status filter
   * If date is not provided, returns all sessions for the user
   */
  async getSessionsByDate(userId: string, date?: string, status?: SessionStatus) {
    const userObjectId = new Types.ObjectId(userId);
    const query: any = { 
      user_id: userObjectId,
    };

    // Add date filter only if date is provided
    if (date) {
      query.date = date;
    }

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    const sessions = await this.sessionModel
      .find(query)
      .populate('doctor_id', 'first_name last_name email phone')
      .populate('user_id', 'first_name last_name email phone')
      .sort({ date: -1, start_time: 1 }) // Sort by date descending, then by time ascending
      .lean();

    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Update session file URL
   */
  async updateSessionFile(userId: string, sessionId: string, fileUrl: string) {
    const userObjectId = new Types.ObjectId(userId);
    const sessionObjectId = new Types.ObjectId(sessionId);

    const session = await this.sessionModel.findOne({
      _id: sessionObjectId,
      user_id: userObjectId,
    });

    if (!session) {
      throw new NotFoundException('Session not found or you do not have access to it');
    }

    session.session_file = fileUrl;
    await session.save();

    return {
      success: true,
      message: 'Session file uploaded successfully',
      data: {
        session_id: session._id.toString(),
        session_file: session.session_file,
      },
    };
  }

  /**
   * Get doctor's sessions
   */
  async getDoctorSessions(doctorId: string, dto: GetSessionsDto) {
    // Validate doctor
    await this.validateDoctor(doctorId);

    const doctorObjectId = new Types.ObjectId(doctorId);
    const query: any = { doctor_id: doctorObjectId };

    // Apply filters
    if (dto.start_date || dto.end_date) {
      query.date = {};
      if (dto.start_date) {
        query.date.$gte = dto.start_date;
      }
      if (dto.end_date) {
        query.date.$lte = dto.end_date;
      }
    }

    if (dto.status) {
      query.status = dto.status;
    }

    const sessions = await this.sessionModel
      .find(query)
      .populate('user_id', 'first_name last_name email')
      .sort({ date: 1, start_time: 1 })
      .lean();

    return {
      success: true,
      data: sessions,
    };
  }

  /**
   * Get session by ID
   */
  async getSessionById(userId: string, sessionId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const sessionObjectId = new Types.ObjectId(sessionId);

    const session = await this.sessionModel
      .findOne({
        _id: sessionObjectId,
        $or: [{ user_id: userObjectId }, { doctor_id: userObjectId }],
      })
      .populate('doctor_id', 'first_name last_name email phone')
      .populate('user_id', 'first_name last_name email phone')
      .lean();

    if (!session) {
      throw new NotFoundException('Session not found or you do not have access to it');
    }

    return {
      success: true,
      data: session,
    };
  }

  /**
   * Get comprehensive session details for session details screen
   */
  async getSessionDetails(userId: string, sessionId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const sessionObjectId = new Types.ObjectId(sessionId);

    // Get session with populated doctor and user
    const session = await this.sessionModel
      .findOne({
        _id: sessionObjectId,
        $or: [{ user_id: userObjectId }, { doctor_id: userObjectId }],
      })
      .populate('doctor_id', 'first_name last_name email phone')
      .populate('user_id', 'first_name last_name email phone username')
      .lean();

    if (!session) {
      throw new NotFoundException('Session not found or you do not have access to it');
    }

    // Calculate duration in minutes
    const startTime = moment(session.start_time, 'HH:mm');
    const endTime = moment(session.end_time, 'HH:mm');
    const durationMinutes = endTime.diff(startTime, 'minutes');

    // Get user ID from populated object (lean() returns populated objects)
    const sessionUser = session.user_id as any;
    const sessionUserId = sessionUser?._id || sessionUser;
    const sessionUserObjectId = sessionUserId instanceof Types.ObjectId 
      ? sessionUserId 
      : new Types.ObjectId(sessionUserId.toString());

    // Get client (user) demographics for preferred language
    const demographics = await this.demographicsModel
      .findOne({ user_id: sessionUserObjectId })
      .lean();

    // Get total sessions count for the user
    const totalSessions = await this.sessionModel.countDocuments({
      user_id: sessionUserObjectId,
    });

    // Get last session (most recent before current)
    const lastSession = await this.sessionModel
      .findOne({
        user_id: sessionUserObjectId,
        _id: { $ne: sessionObjectId },
      })
      .sort({ date: -1, start_time: -1 })
      .lean();

    // Extract filename from session_file URL
    let fileName = null;
    if (session.session_file) {
      const parts = session.session_file.split('/');
      fileName = parts[parts.length - 1];
    }

    // Format client ID (use username if available, otherwise email)
    const clientId = (session.user_id as any)?.username || (session.user_id as any)?.email || 'anonymous_user';

    return {
      success: true,
      data: {
        session_details: {
          session_title: session.session_title || 'Session',
          time: `${session.start_time} - ${session.end_time}`,
          duration: `${durationMinutes} minutes`,
          client_id: clientId,
          session_type: session.session_type || 'video call',
        },
        session_notes: {
          upload_documents: session.session_file ? {
            file_url: session.session_file,
            file_name: fileName,
          } : null,
          notes: session.notes || null,
        },
        client_information: {
          total_sessions: totalSessions,
          is_new_client: totalSessions === 1,
          last_session: lastSession ? {
            date: lastSession.date,
            status: lastSession.status,
            title: lastSession.session_title || 'Previous Session',
          } : null,
          preferred_language: demographics?.preferred_language || 'English',
        },
        doctor_information: {
          doctor_id: (session.doctor_id as any)?._id?.toString(),
          full_name: session.doctor_id
            ? `${(session.doctor_id as any).first_name || ''} ${(session.doctor_id as any).last_name || ''}`.trim()
            : null,
          email: (session.doctor_id as any)?.email || null,
          phone: (session.doctor_id as any)?.phone || null,
        },
        user_information: {
          user_id: (session.user_id as any)?._id?.toString(),
          full_name: session.user_id
            ? `${(session.user_id as any).first_name || ''} ${(session.user_id as any).last_name || ''}`.trim()
            : null,
          email: (session.user_id as any)?.email || null,
          phone: (session.user_id as any)?.phone || null,
          username: (session.user_id as any)?.username || null,
        },
      },
    };
  }

  /**
   * Get all sessions (admin only, with filters)
   */
  async getAllSessions(adminId: string, dto: GetSessionsDto, page: number = 1, limit: number = 20) {
    // Validate admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access all sessions');
    }

    const query: any = {};

    // Apply filters
    if (dto.start_date || dto.end_date) {
      query.date = {};
      if (dto.start_date) {
        query.date.$gte = dto.start_date;
      }
      if (dto.end_date) {
        query.date.$lte = dto.end_date;
      }
    }

    if (dto.status) {
      query.status = dto.status;
    }

    if (dto.doctor_id) {
      query.doctor_id = new Types.ObjectId(dto.doctor_id);
    }

    if (dto.user_id) {
      query.user_id = new Types.ObjectId(dto.user_id);
    }

    const skip = (page - 1) * limit;
    const sessions = await this.sessionModel
      .find(query)
      .populate('doctor_id', 'first_name last_name email')
      .populate('user_id', 'first_name last_name email')
      .sort({ date: -1, start_time: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.sessionModel.countDocuments(query);

    return {
      success: true,
      data: sessions,
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
}

