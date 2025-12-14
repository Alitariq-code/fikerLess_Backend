import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Demographics, DemographicsDocument } from '../models/schemas/demographics.schema';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserAdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Demographics.name) private demographicsModel: Model<DemographicsDocument>,
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

