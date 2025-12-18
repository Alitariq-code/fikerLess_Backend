import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AvailabilityRule, AvailabilityRuleDocument } from '../models/schemas/availability-rule.schema';
import { AvailabilitySettings, AvailabilitySettingsDocument } from '../models/schemas/availability-settings.schema';
import { AvailabilityOverride, AvailabilityOverrideDocument, OverrideType } from '../models/schemas/availability-override.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilitySettingsDto } from './dto/create-availability-settings.dto';
import { UpdateAvailabilitySettingsDto } from './dto/update-availability-settings.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dto/update-availability-override.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(AvailabilityRule.name) private availabilityRuleModel: Model<AvailabilityRuleDocument>,
    @InjectModel(AvailabilitySettings.name) private availabilitySettingsModel: Model<AvailabilitySettingsDocument>,
    @InjectModel(AvailabilityOverride.name) private availabilityOverrideModel: Model<AvailabilityOverrideDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    const existingRules = await this.availabilityRuleModel.find({
      doctor_id: doctorId,
      day_of_week: dayOfWeek,
      is_active: true,
      ...(excludeRuleId ? { _id: { $ne: excludeRuleId } } : {}),
    });

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
    const settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
    if (!settings) {
      throw new BadRequestException(
        'Availability settings must be created before adding availability rules',
      );
    }
  }

  // ==================== Availability Settings ====================

  async createAvailabilitySettings(doctorId: string, dto: CreateAvailabilitySettingsDto) {
    await this.validateDoctor(doctorId);

    const existing = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
    if (existing) {
      throw new BadRequestException('Availability settings already exist. Use update endpoint.');
    }

    const settings = await this.availabilitySettingsModel.create({
      doctor_id: doctorId,
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

    const settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
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

    const settings = await this.availabilitySettingsModel.findOne({ doctor_id: doctorId });
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

    const rule = await this.availabilityRuleModel.create({
      doctor_id: doctorId,
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

    const rules = await this.availabilityRuleModel
      .find({ doctor_id: doctorId })
      .sort({ day_of_week: 1, start_time: 1 });

    return {
      success: true,
      data: rules,
    };
  }

  async getAvailabilityRuleById(doctorId: string, ruleId: string) {
    await this.validateDoctor(doctorId);

    const rule = await this.availabilityRuleModel.findOne({
      _id: ruleId,
      doctor_id: doctorId,
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

    const rule = await this.availabilityRuleModel.findOne({
      _id: ruleId,
      doctor_id: doctorId,
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

    const rule = await this.availabilityRuleModel.findOneAndDelete({
      _id: ruleId,
      doctor_id: doctorId,
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

    // Check if override already exists for this date
    const existing = await this.availabilityOverrideModel.findOne({
      doctor_id: doctorId,
      date: dto.date,
    });

    if (existing) {
      throw new BadRequestException(
        `Override already exists for date ${dto.date}. Use update endpoint.`,
      );
    }

    const override = await this.availabilityOverrideModel.create({
      doctor_id: doctorId,
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

    const query: any = { doctor_id: doctorId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
    }

    const overrides = await this.availabilityOverrideModel
      .find(query)
      .sort({ date: 1 });

    return {
      success: true,
      data: overrides,
    };
  }

  async getAvailabilityOverrideById(doctorId: string, overrideId: string) {
    await this.validateDoctor(doctorId);

    const override = await this.availabilityOverrideModel.findOne({
      _id: overrideId,
      doctor_id: doctorId,
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

    const override = await this.availabilityOverrideModel.findOne({
      _id: overrideId,
      doctor_id: doctorId,
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

    const override = await this.availabilityOverrideModel.findOneAndDelete({
      _id: overrideId,
      doctor_id: doctorId,
    });

    if (!override) {
      throw new NotFoundException('Availability override not found');
    }

    return {
      success: true,
      message: 'Availability override deleted successfully',
    };
  }
}

