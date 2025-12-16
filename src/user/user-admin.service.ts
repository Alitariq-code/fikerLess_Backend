import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Demographics, DemographicsDocument } from '../models/schemas/demographics.schema';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { generateUniqueUsername } from '../utils/utils';

@Injectable()
export class UserAdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Demographics.name) private demographicsModel: Model<DemographicsDocument>,
    @InjectModel(SpecialistProfile.name) private specialistModel: Model<SpecialistProfileDocument>,
  ) {}

  async getAllUsersForAdmin(
    search?: string,
    userType?: string,
    isDisabled?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userType && userType !== 'all') {
      query.user_type = userType;
    }

    if (isDisabled !== undefined && isDisabled !== 'all') {
      query.is_disabled = isDisabled === 'true';
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -otp_token')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const demographics = await this.demographicsModel.findOne({ user_id: user._id }).lean();
        const specialistProfile = user.user_type === 'specialist' 
          ? await this.specialistModel.findOne({ user_id: user._id }).lean()
          : null;
        
        return {
          _id: user._id.toString(),
          email: user.email,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          phone_number: user.phone_number || '',
          username: user.username || '',
          user_type: user.user_type,
          is_email_verified: user.is_email_verified || false,
          has_demographics: user.has_demographics || false,
          is_disabled: user.is_disabled || false,
          demographics: demographics || null,
          specialist_profile: specialistProfile ? {
            _id: specialistProfile._id.toString(),
            user_id: specialistProfile.user_id.toString(),
            full_name: specialistProfile.full_name,
            designation: specialistProfile.designation,
            location: specialistProfile.location,
            hourly_rate: specialistProfile.hourly_rate,
            currency: specialistProfile.currency,
            specializations: specialistProfile.specializations || [],
            languages: specialistProfile.languages || [],
            categories: specialistProfile.categories || [],
            rating: specialistProfile.rating || 0,
            total_reviews: specialistProfile.total_reviews || 0,
            experience_years: specialistProfile.experience_years || 0,
            profile_photo: specialistProfile.profile_photo || null,
            education: specialistProfile.education || [],
            certifications: specialistProfile.certifications || [],
            profile_completed: specialistProfile.profile_completed || false,
            is_verified: specialistProfile.is_verified || false,
            created_at: (specialistProfile as any).createdAt,
            updated_at: (specialistProfile as any).updatedAt,
          } : null,
          created_at: (user as any).createdAt,
          updated_at: (user as any).updatedAt,
        };
      }),
    );

    return {
      data: enrichedUsers,
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

  async getUserByIdForAdmin(userId: string) {
    const user = await this.userModel.findById(userId).select('-password -otp_token').lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const demographics = await this.demographicsModel.findOne({ user_id: userId }).lean();
    const specialistProfile = user.user_type === 'specialist'
      ? await this.specialistModel.findOne({ user_id: userId }).lean()
      : null;

    return {
      _id: user._id.toString(),
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      username: user.username || '',
      user_type: user.user_type,
      is_email_verified: user.is_email_verified || false,
      has_demographics: user.has_demographics || false,
      is_disabled: user.is_disabled || false,
      demographics: demographics || null,
      specialist_profile: specialistProfile ? {
        _id: specialistProfile._id.toString(),
        user_id: specialistProfile.user_id.toString(),
        full_name: specialistProfile.full_name,
        designation: specialistProfile.designation,
        location: specialistProfile.location,
        hourly_rate: specialistProfile.hourly_rate,
        currency: specialistProfile.currency,
        specializations: specialistProfile.specializations || [],
        languages: specialistProfile.languages || [],
        categories: specialistProfile.categories || [],
        rating: specialistProfile.rating || 0,
        total_reviews: specialistProfile.total_reviews || 0,
        experience_years: specialistProfile.experience_years || 0,
        profile_photo: specialistProfile.profile_photo || null,
        education: specialistProfile.education || [],
        certifications: specialistProfile.certifications || [],
        profile_completed: specialistProfile.profile_completed || false,
        is_verified: specialistProfile.is_verified || false,
        created_at: (specialistProfile as any).createdAt,
        updated_at: (specialistProfile as any).updatedAt,
      } : null,
      created_at: (user as any).createdAt,
      updated_at: (user as any).updatedAt,
    };
  }

  async updateUserAsAdmin(userId: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.userModel.findOne({ email: dto.email });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new BadRequestException('Email already in use');
      }
      user.email = dto.email;
    }

    if (dto.first_name !== undefined) user.first_name = dto.first_name;
    if (dto.last_name !== undefined) user.last_name = dto.last_name;
    if (dto.phone_number !== undefined) user.phone_number = dto.phone_number;
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.user_type !== undefined) user.user_type = dto.user_type;
    if (dto.is_email_verified !== undefined) user.is_email_verified = dto.is_email_verified;
    if (dto.is_disabled !== undefined) user.is_disabled = dto.is_disabled;

    await user.save();

    return this.getUserByIdForAdmin(userId);
  }

  async toggleUserStatus(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_disabled = !user.is_disabled;
    await user.save();

    return this.getUserByIdForAdmin(userId);
  }

  async createUserAsAdmin(dto: CreateUserDto) {
    // Check if email already exists
    const existingUser = await this.userModel.findOne({ email: dto.email });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // Check if username already exists (if provided)
    if (dto.username) {
      const existingUsername = await this.userModel.findOne({ username: dto.username });
      if (existingUsername) {
        throw new BadRequestException('Username already in use');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generate username if not provided
    let username = dto.username;
    if (!username) {
      username = await generateUniqueUsername(
        dto.first_name || '',
        dto.last_name || '',
        dto.email,
        this.userModel
      );
    }

    // Create user
    const newUser = new this.userModel({
      email: dto.email,
      password: hashedPassword,
      first_name: dto.first_name || '',
      last_name: dto.last_name || '',
      phone_number: dto.phone_number || '',
      username: username,
      user_type: dto.user_type,
      is_email_verified: dto.is_email_verified !== undefined ? dto.is_email_verified : true,
      is_disabled: dto.is_disabled !== undefined ? dto.is_disabled : false,
      has_demographics: false,
    });

    await newUser.save();

    // Create demographics if provided
    if (dto.demographics) {
      const demographics = new this.demographicsModel({
        user_id: newUser._id,
        age_range: dto.demographics.age_range,
        gender_identity: dto.demographics.gender_identity,
        country_of_residence: dto.demographics.country_of_residence,
        relationship_status: dto.demographics.relationship_status,
        what_brings_you_here: dto.demographics.what_brings_you_here || [],
        other_reason: dto.demographics.other_reason,
        goals_for_using_app: dto.demographics.goals_for_using_app || [],
        mental_health_diagnosis: dto.demographics.mental_health_diagnosis,
        diagnosed_conditions: dto.demographics.diagnosed_conditions || [],
        seeing_professional: dto.demographics.seeing_professional,
        suicidal_thoughts: dto.demographics.suicidal_thoughts,
        exercise_frequency: dto.demographics.exercise_frequency,
        substance_use: dto.demographics.substance_use,
        support_system: dto.demographics.support_system,
        preferred_support_type: dto.demographics.preferred_support_type || [],
        preferred_therapist_gender: dto.demographics.preferred_therapist_gender,
        preferred_language: dto.demographics.preferred_language,
        understands_emergency_disclaimer: dto.demographics.understands_emergency_disclaimer || false,
      });

      await demographics.save();
      newUser.has_demographics = true;
      await newUser.save();
    }

    // Create specialist profile if user is a specialist and profile data is provided
    if (dto.user_type === 'specialist' && dto.specialist_profile) {
      const specialistProfile = new this.specialistModel({
        user_id: newUser._id,
        full_name: dto.specialist_profile.full_name || `${dto.first_name || ''} ${dto.last_name || ''}`.trim() || dto.email,
        designation: dto.specialist_profile.designation || '',
        location: dto.specialist_profile.location || '',
        hourly_rate: dto.specialist_profile.hourly_rate || 0,
        currency: dto.specialist_profile.currency || 'PKR',
        specializations: dto.specialist_profile.specializations || [],
        languages: dto.specialist_profile.languages || [],
        categories: dto.specialist_profile.categories || [],
        experience_years: dto.specialist_profile.experience_years || 0,
        profile_photo: dto.specialist_profile.profile_photo || '',
        education: dto.specialist_profile.education || [],
        certifications: dto.specialist_profile.certifications || [],
        profile_completed: !!(
          dto.specialist_profile.full_name && 
          dto.specialist_profile.designation && 
          dto.specialist_profile.location &&
          dto.specialist_profile.education && 
          dto.specialist_profile.education.length > 0 &&
          dto.specialist_profile.certifications && 
          dto.specialist_profile.certifications.length > 0
        ),
        is_verified: dto.specialist_profile.is_verified !== undefined ? dto.specialist_profile.is_verified : false,
        rating: 0,
        total_reviews: 0,
      });

      await specialistProfile.save();
    }

    return this.getUserByIdForAdmin(newUser._id.toString());
  }

  async deleteUserAsAdmin(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow deleting admin users
    if (user.user_type === 'admin') {
      throw new ForbiddenException('Cannot delete admin users');
    }

    // Delete demographics if exists
    await this.demographicsModel.deleteOne({ user_id: userId });

    // Delete user
    await user.deleteOne();

    return { success: true, message: 'User deleted successfully' };
  }
}

