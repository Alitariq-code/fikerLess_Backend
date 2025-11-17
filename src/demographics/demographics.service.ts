import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Demographics, DemographicsDocument } from '../models/schemas/demographics.schema';
import { parseJsonData } from '../utils/utils';

@Injectable()
export class DemographicsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Demographics.name) private demographicsModel: Model<DemographicsDocument>,
  ) {}

  async saveDemographics(userId: string, demographicsData: any) {
    if (!userId) {
      throw new BadRequestException('user id is required');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!demographicsData) {
      throw new BadRequestException('demographics data is required');
    }

    const userObjectId = userId.toString();
    let demographics = await this.demographicsModel.findOne({ user_id: userObjectId }).exec();

    if (!demographics) {
      demographics = new this.demographicsModel({ user_id: userObjectId });
    }

    const listFields = [
      'what_brings_you_here',
      'diagnosed_conditions',
      'goals_for_using_app',
      'preferred_support_type',
    ];

    const stringFields = [
      'age_range',
      'gender_identity',
      'country_of_residence',
      'relationship_status',
      'other_reason',
      'mental_health_diagnosis',
      'seeing_professional',
      'suicidal_thoughts',
      'exercise_frequency',
      'substance_use',
      'support_system',
      'preferred_therapist_gender',
      'preferred_language',
    ];

    for (const field of listFields) {
      if (field in demographicsData) {
        try {
          let fieldData = demographicsData[field];

          if (typeof fieldData === 'string') {
            fieldData = parseJsonData(fieldData);
          }

          if (Array.isArray(fieldData) && fieldData.every(item => typeof item === 'string')) {
            demographics[field] = fieldData;
          } else if (typeof fieldData === 'string') {
            demographics[field] = [fieldData];
          } else {
            throw new BadRequestException(`${field} must be a list of strings`);
          }
        } catch (error) {
          throw new BadRequestException(`Invalid format for ${field}`);
        }
      }
    }

    for (const field of stringFields) {
      if (field in demographicsData) {
        const value = demographicsData[field];
        if (value !== null && value !== 'null' && value !== '') {
          if (typeof value === 'string') {
            demographics[field] = value.trim();
          } else {
            demographics[field] = String(value);
          }
        }
      }
    }

    if ('understands_emergency_disclaimer' in demographicsData) {
      const disclaimer = demographicsData['understands_emergency_disclaimer'];
      if (typeof disclaimer === 'boolean') {
        demographics.understands_emergency_disclaimer = disclaimer;
      } else if (typeof disclaimer === 'string') {
        demographics.understands_emergency_disclaimer = ['true', 'yes', '1'].includes(disclaimer.toLowerCase());
      }
    }

    await demographics.save();

    user.has_demographics = true;
    await user.save();

    return {
      message: 'Demographics saved successfully',
      user_id: userId,
      demographics_id: demographics._id.toString(),
    };
  }
}

