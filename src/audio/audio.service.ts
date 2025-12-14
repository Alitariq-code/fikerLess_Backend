import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { Audio, AudioDocument } from '../models/schemas/audio.schema';

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
}

