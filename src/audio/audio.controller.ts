import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AudioService } from './audio.service';

@Controller('api/v1/audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  /**
   * List all audio files with metadata
   * GET /api/v1/audio/list
   */
  @Get('list')
  @HttpCode(HttpStatus.OK)
  async listAudios(
    @Query('language') language?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audioService.listAudios({
      language,
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Get single audio by ID
   * GET /api/v1/audio/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAudioById(@Param('id') id: string) {
    return this.audioService.getAudioById(id);
  }

  /**
   * Get audio file - sends complete file
   * GET /api/v1/audio/stream/:filename
   */
  @Get('stream/:filename')
  async streamAudio(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const decodedFilename = decodeURIComponent(filename);
    return this.audioService.streamAudio(decodedFilename, undefined, res);
  }

}

