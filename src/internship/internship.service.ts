import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Internship, InternshipDocument } from '../models/schemas/internship.schema';
import { CreateInternshipDto } from './dto/create-internship.dto';

@Injectable()
export class InternshipService {
  constructor(
    @InjectModel(Internship.name) private internshipModel: Model<InternshipDocument>,
  ) {}

  async createInternship(createDto: CreateInternshipDto): Promise<any> {
    if (!createDto.programs || createDto.programs.length === 0) {
      throw new BadRequestException('At least one program is required');
    }

    const internship = new this.internshipModel({
      ...createDto,
      is_active: createDto.is_active !== undefined ? createDto.is_active : true,
    });

    const saved = await internship.save();
    return this.formatInternshipResponse(saved);
  }

  async getAllInternships(
    search?: string,
    city?: string,
    page: number = 1,
    limit: number = 20,
    includeInactive: boolean = false,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};
    
    // Only filter by is_active if we don't want to include inactive ones
    if (!includeInactive) {
      query.is_active = true;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    const [internships, total] = await Promise.all([
      this.internshipModel
        .find(query)
        .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.internshipModel.countDocuments(query),
    ]);

    return {
      data: internships.map((internship) => this.formatInternshipResponse(internship)),
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

  async getInternshipById(id: string): Promise<any> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid internship ID format');
    }

    const internship = await this.internshipModel.findById(id).lean();

    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    // Increment view count
    await this.internshipModel.findByIdAndUpdate(id, { $inc: { view_count: 1 } });

    return this.formatInternshipResponse(internship);
  }

  async searchInternships(searchTerm: string): Promise<{ data: any[]; count: number }> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      const all = await this.getAllInternships();
      return { data: all.data, count: all.data.length };
    }

    const query = {
      is_active: true,
      $text: { $search: searchTerm },
    };

    const internships = await this.internshipModel
      .find(query)
      .sort({ score: { $meta: 'textScore' } })
      .lean();

    return {
      data: internships.map((internship) => this.formatInternshipResponse(internship)),
      count: internships.length,
    };
  }

  async updateInternship(id: string, updateDto: Partial<CreateInternshipDto>): Promise<any> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid internship ID format');
    }

    const internship = await this.internshipModel.findById(id);
    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    if (updateDto.programs && updateDto.programs.length === 0) {
      throw new BadRequestException('At least one program is required');
    }

    Object.assign(internship, updateDto);
    const saved = await internship.save();
    return this.formatInternshipResponse(saved);
  }

  async deleteInternship(id: string): Promise<void> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid internship ID format');
    }

    const result = await this.internshipModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Internship not found');
    }
  }

  private formatInternshipResponse(internship: any): any {
    return {
      _id: internship._id.toString(),
      mentorName: internship.mentorName,
      profession: internship.profession,
      specialization: internship.specialization || null,
      programs: internship.programs || [],
      includes: internship.includes || [],
      city: internship.city,
      cityNote: internship.cityNote || null,
      additionalInfo: internship.additionalInfo || null,
      is_active: internship.is_active,
      view_count: internship.view_count || 0,
      application_count: internship.application_count || 0,
      created_at: internship.createdAt,
      updated_at: internship.updatedAt,
    };
  }
}

