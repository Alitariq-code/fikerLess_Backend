import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async ensureAdmin(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    if (result.user.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can upload images');
    }
    return result.user._id.toString();
  }

  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: (() => {
        const service = new UploadService();
        return service.getStorageConfig();
      })(),
      fileFilter: (req, file, cb) => {
        const service = new UploadService();
        service.fileFilter(req, file, cb);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  async uploadImages(
    @Headers('authorization') token: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    await this.ensureAdmin(token);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadedFiles = files.map((file) => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: this.uploadService.getFileUrl(file.filename),
    }));

    return {
      success: true,
      message: `${files.length} image(s) uploaded successfully`,
      files: uploadedFiles,
    };
  }
}

