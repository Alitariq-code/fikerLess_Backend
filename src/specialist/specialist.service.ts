import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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

    // Validate required fields for creation
    if (!dto.basic_info?.full_name || !dto.basic_info?.designation || !dto.basic_info?.location || 
        dto.basic_info?.hourly_rate === undefined || !dto.basic_info?.currency) {
      throw new BadRequestException('Missing required fields: full_name, designation, location, hourly_rate, and currency are required');
    }

    const profile = await this.specialistModel.create({
      user_id: userId,
      full_name: dto.basic_info.full_name,
      designation: dto.basic_info.designation,
      location: dto.basic_info.location,
      hourly_rate: dto.basic_info.hourly_rate,
      currency: dto.basic_info.currency,
      specializations: dto.basic_info.specializations || [],
      languages: dto.basic_info.languages || [],
      categories: dto.basic_info.categories || [],
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
      // Only update fields that are actually provided (not undefined)
      if (dto.basic_info.full_name !== undefined) {
        profile.full_name = dto.basic_info.full_name;
      }
      if (dto.basic_info.designation !== undefined) {
        profile.designation = dto.basic_info.designation;
      }
      if (dto.basic_info.location !== undefined) {
        profile.location = dto.basic_info.location;
      }
      if (dto.basic_info.hourly_rate !== undefined) {
        profile.hourly_rate = dto.basic_info.hourly_rate;
      }
      if (dto.basic_info.currency !== undefined) {
        profile.currency = dto.basic_info.currency;
      }
      if (dto.basic_info.specializations !== undefined) {
        profile.specializations = dto.basic_info.specializations;
      }
      if (dto.basic_info.languages !== undefined) {
        profile.languages = dto.basic_info.languages;
      }
      if (dto.basic_info.categories !== undefined) {
        profile.categories = dto.basic_info.categories;
      }
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

  async getAllSpecialists(filters: {
    verified?: boolean;
    location?: string;
    specialization?: string;
    category?: string;
    search?: string;
    min_experience?: number;
    min_rating?: number;
    page?: number;
    limit?: number;
  }) {
    const query: FilterQuery<SpecialistProfileDocument> = {};

    if (filters.verified !== undefined) {
      query.is_verified = filters.verified;
    }

    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    if (filters.specialization) {
      query.specializations = { $in: [filters.specialization] };
    }

    if (filters.category) {
      query.categories = { $in: [filters.category] };
    }

    if (filters.min_experience !== undefined) {
      query.experience_years = { $gte: filters.min_experience };
    }

    if (filters.min_rating !== undefined) {
      query.rating = { $gte: filters.min_rating };
    }

    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { full_name: searchRegex },
        { designation: searchRegex },
        { specializations: searchRegex },
      ];
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 && filters.limit <= 50 ? filters.limit : 10;
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.specialistModel
        .find(query)
        .sort({ rating: -1, total_reviews: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.specialistModel.countDocuments(query),
    ]);

    return {
      results: results.map((profile) => this.formatProfile(profile)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getSpecialistById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid specialist ID format');
    }

    // Try to find by profile _id first
    let profile = await this.specialistModel.findById(id);
    
    // If not found, try to find by user_id (in case frontend passes user ID)
    if (!profile) {
      profile = await this.specialistModel.findOne({ user_id: new Types.ObjectId(id) });
      
      // If still not found, check if user exists (for better error message)
      if (!profile) {
        const user = await this.userModel.findById(id);
        if (user) {
          if (user.user_type !== 'specialist') {
            throw new NotFoundException('User is not a specialist');
          }
          // Return a special result indicating profile doesn't exist yet
          return {
            profile: null,
            profile_exists: false,
            user_exists: true,
            message: 'Specialist profile not found. Please complete your specialist profile first.',
          };
        }
      }
    }
    
    if (!profile) {
      throw new NotFoundException('Specialist not found');
    }

    return {
      profile: this.formatProfile(profile),
      profile_exists: true,
    };
  }

  async getHighlights(limit: number = 3, location?: string) {
    const query: FilterQuery<SpecialistProfileDocument> = {};
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const specialists = await this.specialistModel
      .find(query)
      .sort({ rating: -1, total_reviews: -1, createdAt: -1 })
      .limit(limit);

    return specialists.map((profile) => this.formatProfile(profile));
  }

  async getSuggestions(term: string) {
    if (!term) {
      return { names: [], specializations: [], categories: [] };
    }

    const regexQuery = { $regex: term, $options: 'i' };
    const regex = new RegExp(term, 'i');
    const results = await this.specialistModel
      .find({
        $or: [
          { full_name: regexQuery },
          { designation: regexQuery },
          { specializations: regexQuery },
          { categories: regexQuery },
        ],
      })
      .limit(10)
      .select('full_name specializations categories -_id');

    const names = new Set<string>();
    const specializations = new Set<string>();
    const categories = new Set<string>();

    results.forEach((result) => {
      if (regex.test(result.full_name)) {
        names.add(result.full_name);
      }
      result.specializations.forEach((spec) => {
        if (regex.test(spec)) {
          specializations.add(spec);
        }
      });
      result.categories.forEach((cat) => {
        if (regex.test(cat)) {
          categories.add(cat);
        }
      });
    });

    return {
      names: Array.from(names),
      specializations: Array.from(specializations),
      categories: Array.from(categories),
    };
  }

  private formatProfile(profile: SpecialistProfileDocument) {
    const base = {
      id: profile._id.toString(),
      user_id: profile.user_id.toString(),
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
      education: profile.education,
      certifications: profile.certifications,
      profile_completed: profile.profile_completed,
      is_verified: profile.is_verified,
      created_at: (profile as any).createdAt,
      updated_at: (profile as any).updatedAt,
    };

    return {
      ...base,
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
    };
  }
}

