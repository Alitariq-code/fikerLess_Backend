import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateSpecialistProfileDto } from './dto/create-specialist-profile.dto';
import { UpdateSpecialistProfileDto } from './dto/update-specialist-profile.dto';

@Injectable()
export class SpecialistService {
  constructor(
    @InjectModel(SpecialistProfile.name) private specialistModel: Model<SpecialistProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createProfile(userId: string, dto: CreateSpecialistProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.user_type !== 'specialist') {
      throw new ForbiddenException('Only specialists can create specialist profiles');
    }

    const existing = await this.specialistModel.findOne({ user_id: userId });
    if (existing) {
      throw new BadRequestException('Profile already exists. Use update endpoint.');
    }

    const profile = await this.specialistModel.create({
      user_id: userId,
      full_name: dto.basic_info.full_name,
      designation: dto.basic_info.designation,
      location: dto.basic_info.location,
      hourly_rate: dto.basic_info.hourly_rate,
      currency: dto.basic_info.currency,
      specializations: dto.basic_info.specializations,
      languages: dto.basic_info.languages,
      categories: dto.basic_info.categories,
      rating: 0,
      total_reviews: 0,
      experience_years: dto.basic_info.experience_years ?? 0,
      profile_photo: dto.basic_info.profile_photo,
      education: dto.education || [],
      certifications: dto.certifications || [],
      profile_completed: !!(dto.basic_info && dto.education && dto.certifications),
    });

    return this.formatProfile(profile);
  }

  async getProfile(userId: string) {
    const profile = await this.specialistModel.findOne({ user_id: userId });
    if (!profile) {
      throw new NotFoundException('Specialist profile not found');
    }

    return this.formatProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateSpecialistProfileDto) {
    const profile = await this.specialistModel.findOne({ user_id: userId });
    if (!profile) {
      throw new NotFoundException('Specialist profile not found');
    }

    if (dto.basic_info) {
      profile.full_name = dto.basic_info.full_name;
      profile.designation = dto.basic_info.designation;
      profile.location = dto.basic_info.location;
      profile.hourly_rate = dto.basic_info.hourly_rate;
      profile.currency = dto.basic_info.currency;
      profile.specializations = dto.basic_info.specializations;
      profile.languages = dto.basic_info.languages;
      profile.categories = dto.basic_info.categories;
      if (dto.basic_info.experience_years !== undefined) {
        profile.experience_years = dto.basic_info.experience_years;
      }
      if (dto.basic_info.profile_photo !== undefined) {
        profile.profile_photo = dto.basic_info.profile_photo;
      }
    }

    if (dto.education !== undefined) {
      profile.education = dto.education;
    }

    if (dto.certifications !== undefined) {
      profile.certifications = dto.certifications;
    }

    if (dto.profile_completed !== undefined) {
      profile.profile_completed = dto.profile_completed;
    } else {
      profile.profile_completed = !!(profile.full_name && profile.education.length > 0 && profile.certifications.length > 0);
    }

    await profile.save();

    return this.formatProfile(profile);
  }

  async getAllSpecialists(verified?: boolean, location?: string, specialization?: string) {
    const query: any = {};

    if (verified !== undefined) {
      query.is_verified = verified;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (specialization) {
      query.specializations = { $in: [specialization] };
    }

    const specialists = await this.specialistModel.find(query).sort({ createdAt: -1 });

    return specialists.map(profile => this.formatProfile(profile));
  }

  private formatProfile(profile: SpecialistProfileDocument) {
    return {
      id: profile._id.toString(),
      user_id: profile.user_id.toString(),
      basic_info: {
        full_name: profile.full_name,
        designation: profile.designation,
        location: profile.location,
        hourly_rate: profile.hourly_rate,
        currency: profile.currency,
        specializations: profile.specializations,
        languages: profile.languages,
        categories: profile.categories,
        rating: profile.rating,
        total_reviews: profile.total_reviews,
        experience_years: profile.experience_years,
        profile_photo: profile.profile_photo || null,
      },
      education: profile.education,
      certifications: profile.certifications,
      profile_completed: profile.profile_completed,
      is_verified: profile.is_verified,
      created_at: (profile as any).createdAt,
      updated_at: (profile as any).updatedAt,
    };
  }
}

