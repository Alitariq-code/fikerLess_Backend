import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';

interface PractitionerFilters {
  category?: string;
  location?: string;
  specialization?: string;
  verified?: boolean;
  min_rating?: number;
  max_rate?: number;
  min_experience?: number;
}

@Injectable()
export class SpiritualService {
  constructor(
    @InjectModel(SpecialistProfile.name) private specialistModel: Model<SpecialistProfileDocument>,
  ) {}

  async getPractitioners(filters: PractitionerFilters) {
    const query: any = {};

    if (filters.category) {
      query.categories = { $in: [filters.category] };
    }

    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    if (filters.specialization) {
      query.specializations = { $in: [filters.specialization] };
    }

    if (filters.verified !== undefined) {
      query.is_verified = filters.verified;
    }

    if (filters.min_rating !== undefined) {
      query.rating = { $gte: filters.min_rating };
    }

    if (filters.max_rate !== undefined) {
      query.hourly_rate = { ...(query.hourly_rate || {}), $lte: filters.max_rate };
    }

    if (filters.min_experience !== undefined) {
      query.experience_years = { $gte: filters.min_experience };
    }

    const practitioners = await this.specialistModel
      .find(query)
      .sort({ rating: -1, total_reviews: -1, createdAt: -1 });

    return practitioners.map((profile) => ({
      id: profile._id.toString(),
      user_id: profile.user_id.toString(),
      full_name: profile.full_name,
      designation: profile.designation,
      location: profile.location,
      categories: profile.categories,
      rating: profile.rating,
      total_reviews: profile.total_reviews,
      experience_years: profile.experience_years,
      hourly_rate: profile.hourly_rate,
      currency: profile.currency,
      profile_photo: profile.profile_photo || null,
      specializations: profile.specializations,
      languages: profile.languages,
      is_verified: profile.is_verified,
    }));
  }
}

