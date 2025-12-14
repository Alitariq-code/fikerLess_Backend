import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { createReadStream, statSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { Audio, AudioDocument } from '../models/schemas/audio.schema';
import { CreateAudioDto } from './dto/create-audio.dto';
import { UpdateAudioDto } from './dto/update-audio.dto';
import { parseFile } from 'music-metadata';

@Injectable()
export class AudioService {
  private readonly audioDir = join(process.cwd(), 'Audio_Files');

  constructor(
    @InjectModel(Audio.name) private audioModel: Model<AudioDocument>,
  ) {}

  /**
   * List all active audio files with metadata
   */
  async listAudios(filters?: {
    language?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: any[];
    pagination?: any;
  }> {
    const query: any = { is_active: true };

    // Apply filters
    if (filters?.language) {
      query.language = filters.language;
    }

    if (filters?.category) {
      query.category = filters.category;
    }

    if (filters?.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Pagination
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 && filters.limit <= 50 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const [audios, total] = await Promise.all([
      this.audioModel
        .find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.audioModel.countDocuments(query).exec(),
    ]);

    const formattedAudios = audios.map(audio => this.formatAudioResponse(audio));

    return {
      success: true,
      data: formattedAudios,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    };
  }

  /**
   * Get single audio by ID
   */
  async getAudioById(audioId: string): Promise<any> {
    const audio = await this.audioModel.findOne({
      _id: audioId,
      is_active: true,
    }).lean().exec();

    if (!audio) {
      throw new NotFoundException('Audio not found');
    }

    return {
      success: true,
      data: this.formatAudioResponse(audio),
    };
  }


  /**
   * Send complete audio file in single response
   */
  async streamAudio(
    filename: string,
    range: string | undefined, // Ignored - always sends complete file
    res: Response,
  ): Promise<void> {
    // Security: Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename');
    }

    const audioPath = join(this.audioDir, filename);

    if (!existsSync(audioPath)) {
      throw new NotFoundException('Audio file not found');
    }

    // Get file stats
    const stat = statSync(audioPath);
    const fileSize = stat.size;
    const contentType = 'audio/mpeg';

    // Send complete file
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    };

    res.writeHead(200, headers);
    createReadStream(audioPath).pipe(res);
  }


  /**
   * Format audio response - only essential details
   */
  private formatAudioResponse(audio: any): any {
    return {
      id: audio._id.toString(),
      name: audio.title,
      duration: audio.duration,
      stream_url: audio.stream_url,
    };
  }

  // Admin methods
  async getAllAudiosForAdmin(
    search?: string,
    category?: string,
    language?: string,
    isActive?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (language && language !== 'all') {
      query.language = language;
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.is_active = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { filename: { $regex: search, $options: 'i' } },
      ];
    }

    const [audios, total] = await Promise.all([
      this.audioModel
        .find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.audioModel.countDocuments(query),
    ]);

    return {
      data: audios.map((audio) => ({
        _id: audio._id.toString(),
        filename: audio.filename,
        title: audio.title,
        description: audio.description || '',
        language: audio.language,
        category: audio.category,
        duration: audio.duration,
        file_size: audio.file_size,
        stream_url: audio.stream_url,
        thumbnail_url: audio.thumbnail_url,
        bitrate: audio.bitrate,
        sample_rate: audio.sample_rate,
        format: audio.format,
        is_active: audio.is_active,
        play_count: audio.play_count || 0,
        order: audio.order || 0,
        created_at: (audio as any).createdAt,
        updated_at: (audio as any).updatedAt,
      })),
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

  async getAudioByIdForAdmin(audioId: string) {
    const audio = await this.audioModel.findById(audioId).lean();
    if (!audio) {
      throw new NotFoundException('Audio not found');
    }
    return {
      _id: audio._id.toString(),
      filename: audio.filename,
      title: audio.title,
      description: audio.description || '',
      language: audio.language,
      category: audio.category,
      duration: audio.duration,
      file_size: audio.file_size,
      stream_url: audio.stream_url,
      thumbnail_url: audio.thumbnail_url,
      bitrate: audio.bitrate,
      sample_rate: audio.sample_rate,
      format: audio.format,
      is_active: audio.is_active,
      play_count: audio.play_count || 0,
      order: audio.order || 0,
      created_at: (audio as any).createdAt,
      updated_at: (audio as any).updatedAt,
    };
  }

  async extractAudioMetadata(filePath: string): Promise<{
    duration: number;
    bitrate?: number;
    sample_rate?: number;
    format?: string;
  }> {
    try {
      const metadata = await parseFile(filePath);
      const duration = metadata.format.duration || 0;
      const bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : undefined;
      const sampleRate = metadata.format.sampleRate;
      const format = metadata.format.container;
      
      return {
        duration: Math.round(duration),
        bitrate,
        sample_rate: sampleRate,
        format: format || 'mp3',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to extract audio metadata: ${error.message}`);
    }
  }

  async createAudioAsAdmin(dto: CreateAudioDto, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    // Validate file type
    const allowedExtensions = ['.mp3', '.m4a', '.wav', '.ogg'];
    const ext = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
    }

    // Check if filename already exists
    const existing = await this.audioModel.findOne({ filename: file.originalname }).exec();
    if (existing) {
      throw new BadRequestException('An audio with this filename already exists');
    }

    // Ensure audio directory exists
    if (!existsSync(this.audioDir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(this.audioDir, { recursive: true });
    }

    // File is already saved by multer, get the path
    const filename = file.filename || file.originalname;
    const filePath = join(this.audioDir, filename);

    // If file doesn't exist at path, try saving from buffer
    if (!existsSync(filePath) && file.buffer) {
      writeFileSync(filePath, file.buffer);
    }

    if (!existsSync(filePath)) {
      throw new BadRequestException('Failed to save audio file');
    }

    // Extract metadata
    const metadata = await this.extractAudioMetadata(filePath);
    const fileStats = statSync(filePath);

    // Create audio record
    const audio = await this.audioModel.create({
      filename: filename,
      title: dto.title,
      description: dto.description || '',
      language: dto.language,
      category: dto.category,
      duration: metadata.duration,
      file_size: fileStats.size,
      stream_url: `/api/v1/audio/stream/${encodeURIComponent(filename)}`,
      thumbnail_url: dto.thumbnail_url,
      bitrate: metadata.bitrate,
      sample_rate: metadata.sample_rate,
      format: metadata.format,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      order: dto.order || 0,
      play_count: 0,
    });

    return {
      _id: audio._id.toString(),
      filename: audio.filename,
      title: audio.title,
      description: audio.description,
      language: audio.language,
      category: audio.category,
      duration: audio.duration,
      file_size: audio.file_size,
      stream_url: audio.stream_url,
      thumbnail_url: audio.thumbnail_url,
      bitrate: audio.bitrate,
      sample_rate: audio.sample_rate,
      format: audio.format,
      is_active: audio.is_active,
      play_count: audio.play_count,
      order: audio.order,
      created_at: (audio as any).createdAt,
      updated_at: (audio as any).updatedAt,
    };
  }

  async updateAudioAsAdmin(audioId: string, dto: UpdateAudioDto, file?: Express.Multer.File) {
    const audio = await this.audioModel.findById(audioId);
    if (!audio) {
      throw new NotFoundException('Audio not found');
    }

    // If new file is provided, replace the old one
    if (file) {
      const allowedExtensions = ['.mp3', '.m4a', '.wav', '.ogg'];
      const ext = extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        throw new BadRequestException(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
      }

      const newFilename = file.filename || file.originalname;

      // Delete old file if filename changed
      if (newFilename !== audio.filename) {
        const oldFilePath = join(this.audioDir, audio.filename);
        if (existsSync(oldFilePath)) {
          unlinkSync(oldFilePath);
        }
      }

      // File is already saved by multer, get the path
      const filePath = join(this.audioDir, newFilename);

      // If file doesn't exist at path, try saving from buffer
      if (!existsSync(filePath) && file.buffer) {
        writeFileSync(filePath, file.buffer);
      }

      if (!existsSync(filePath)) {
        throw new BadRequestException('Failed to save audio file');
      }

      // Extract metadata from new file
      const metadata = await this.extractAudioMetadata(filePath);
      const fileStats = statSync(filePath);

      audio.filename = newFilename;
      audio.duration = metadata.duration;
      audio.file_size = fileStats.size;
      audio.stream_url = `/api/v1/audio/stream/${encodeURIComponent(newFilename)}`;
      audio.bitrate = metadata.bitrate;
      audio.sample_rate = metadata.sample_rate;
      audio.format = metadata.format;
    }

    // Update other fields
    if (dto.title !== undefined) audio.title = dto.title;
    if (dto.description !== undefined) audio.description = dto.description;
    if (dto.language !== undefined) audio.language = dto.language;
    if (dto.category !== undefined) audio.category = dto.category;
    if (dto.thumbnail_url !== undefined) audio.thumbnail_url = dto.thumbnail_url;
    if (dto.order !== undefined) audio.order = dto.order;
    if (dto.is_active !== undefined) audio.is_active = dto.is_active;

    await audio.save();

    return {
      _id: audio._id.toString(),
      filename: audio.filename,
      title: audio.title,
      description: audio.description,
      language: audio.language,
      category: audio.category,
      duration: audio.duration,
      file_size: audio.file_size,
      stream_url: audio.stream_url,
      thumbnail_url: audio.thumbnail_url,
      bitrate: audio.bitrate,
      sample_rate: audio.sample_rate,
      format: audio.format,
      is_active: audio.is_active,
      play_count: audio.play_count,
      order: audio.order,
      created_at: (audio as any).createdAt,
      updated_at: (audio as any).updatedAt,
    };
  }

  async deleteAudioAsAdmin(audioId: string) {
    const audio = await this.audioModel.findById(audioId);
    if (!audio) {
      throw new NotFoundException('Audio not found');
    }

    // Delete file from filesystem
    const filePath = join(this.audioDir, audio.filename);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        // Log but don't fail if file deletion fails
        console.error(`Failed to delete audio file: ${filePath}`, error);
      }
    }

    // Delete from database
    await audio.deleteOne();
    return { success: true, message: 'Audio deleted successfully' };
  }

  async getAudioStatisticsForAdmin() {
    const [
      total,
      active,
      inactive,
      byCategory,
      byLanguage,
      mostPlayed,
      totalStorage,
      averageDuration,
      recentUploads,
    ] = await Promise.all([
      this.audioModel.countDocuments().exec(),
      this.audioModel.countDocuments({ is_active: true }).exec(),
      this.audioModel.countDocuments({ is_active: false }).exec(),
      this.audioModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),
      this.audioModel.aggregate([
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),
      this.audioModel
        .find()
        .sort({ play_count: -1 })
        .limit(10)
        .select('title play_count category language')
        .lean()
        .exec(),
      this.audioModel.aggregate([
        { $group: { _id: null, total: { $sum: '$file_size' } } },
      ]).exec(),
      this.audioModel.aggregate([
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]).exec(),
      this.audioModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title createdAt category language')
        .lean()
        .exec(),
    ]);

    return {
      total,
      active,
      inactive,
      byCategory: byCategory.map((item) => ({
        category: item._id,
        count: item.count,
      })),
      byLanguage: byLanguage.map((item) => ({
        language: item._id,
        count: item.count,
      })),
      mostPlayed: mostPlayed.map((audio) => ({
        _id: audio._id.toString(),
        title: audio.title,
        play_count: audio.play_count || 0,
        category: audio.category,
        language: audio.language,
      })),
      totalStorage: totalStorage[0]?.total || 0,
      averageDuration: averageDuration[0]?.avg ? Math.round(averageDuration[0].avg) : 0,
      recentUploads: recentUploads.map((audio) => ({
        _id: audio._id.toString(),
        title: audio.title,
        created_at: (audio as any).createdAt,
        category: audio.category,
        language: audio.language,
      })),
    };
  }

  async bulkUpdateAudiosAsAdmin(updates: Array<{ id: string; order?: number; is_active?: boolean }>) {
    const results = [];
    for (const update of updates) {
      const audio = await this.audioModel.findById(update.id);
      if (!audio) {
        results.push({ id: update.id, success: false, error: 'Audio not found' });
        continue;
      }

      if (update.order !== undefined) audio.order = update.order;
      if (update.is_active !== undefined) audio.is_active = update.is_active;

      await audio.save();
      results.push({ id: update.id, success: true });
    }
    return { results };
  }
}

