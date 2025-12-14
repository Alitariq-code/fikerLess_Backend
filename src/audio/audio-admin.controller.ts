import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AudioService } from './audio.service';
import { CreateAudioDto } from './dto/create-audio.dto';
import { UpdateAudioDto } from './dto/update-audio.dto';
import { getUserFromToken } from '../utils/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Model } from 'mongoose';

@Controller('api/v1/audio/admin')
export class AudioAdminController {
  private readonly audioDir = join(process.cwd(), 'Audio_Files');
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav', 'audio/ogg'];

  constructor(
    private readonly audioService: AudioService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    // Ensure audio directory exists
    if (!existsSync(this.audioDir)) {
      mkdirSync(this.audioDir, { recursive: true });
    }
  }

  private async ensureAdmin(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    if (result.user.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }
    return result.user._id.toString();
  }

  private getStorageConfig() {
    return diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.audioDir);
      },
      filename: (req, file, cb) => {
        // Keep original filename but sanitize it
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, sanitized);
      },
    });
  }

  private fileFilter(req: any, file: any, cb: any) {
    const ext = extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.mp3', '.m4a', '.wav', '.ogg'];
    
    if (allowedExtensions.includes(ext) || this.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ForbiddenException(
          `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
        ),
        false
      );
    }
  }

  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllAudiosForAdmin(
    @Headers('authorization') token: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('language') language?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.audioService.getAllAudiosForAdmin(
      search,
      category,
      language,
      isActive,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  async getAudioStatisticsForAdmin(
    @Headers('authorization') token: string,
  ) {
    await this.ensureAdmin(token);
    const stats = await this.audioService.getAudioStatisticsForAdmin();
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAudioByIdForAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const audio = await this.audioService.getAudioByIdForAdmin(id);
    return {
      success: true,
      data: audio,
    };
  }

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio_file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const audioDir = join(process.cwd(), 'Audio_Files');
          if (!existsSync(audioDir)) {
            mkdirSync(audioDir, { recursive: true });
          }
          cb(null, audioDir);
        },
        filename: (req, file, cb) => {
          const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, sanitized);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.mp3', '.m4a', '.wav', '.ogg'];
        if (allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new ForbiddenException(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    })
  )
  async createAudioAsAdmin(
    @Headers('authorization') token: string,
    @Body() dto: CreateAudioDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.ensureAdmin(token);
    
    if (!file) {
      throw new ForbiddenException('Audio file is required');
    }

    const audio = await this.audioService.createAudioAsAdmin(dto, file);
    return {
      success: true,
      message: 'Audio created successfully',
      data: audio,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio_file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const audioDir = join(process.cwd(), 'Audio_Files');
          if (!existsSync(audioDir)) {
            mkdirSync(audioDir, { recursive: true });
          }
          cb(null, audioDir);
        },
        filename: (req, file, cb) => {
          const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, sanitized);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.mp3', '.m4a', '.wav', '.ogg'];
        if (allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new ForbiddenException(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    })
  )
  async updateAudioAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateAudioDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.ensureAdmin(token);

    const audio = await this.audioService.updateAudioAsAdmin(id, dto, file);
    return {
      success: true,
      message: 'Audio updated successfully',
      data: audio,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAudioAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.audioService.deleteAudioAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateAudiosAsAdmin(
    @Headers('authorization') token: string,
    @Body() body: { updates: Array<{ id: string; order?: number; is_active?: boolean }> },
  ) {
    await this.ensureAdmin(token);
    const result = await this.audioService.bulkUpdateAudiosAsAdmin(body.updates);
    return {
      success: true,
      ...result,
    };
  }
}

