import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserAdminService } from './user-admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/users/admin')
export class UserAdminController {
  constructor(
    private readonly userAdminService: UserAdminService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    return result.user._id.toString();
  }

  private async ensureAdmin(token: string): Promise<string> {
    const userId = await this.getUserIdFromToken(token);
    const result = await getUserFromToken(token, this.userModel);
    if (result.user?.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }
    return userId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUserAsAdmin(
    @Headers('authorization') token: string,
    @Body() dto: CreateUserDto,
  ) {
    await this.ensureAdmin(token);
    const user = await this.userAdminService.createUserAsAdmin(dto);
    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllUsersForAdmin(
    @Headers('authorization') token: string,
    @Query('search') search?: string,
    @Query('user_type') userType?: string,
    @Query('is_disabled') isDisabled?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const result = await this.userAdminService.getAllUsersForAdmin(
      search,
      userType,
      isDisabled,
      pageNum,
      limitNum,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserByIdForAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const user = await this.userAdminService.getUserByIdForAdmin(id);
    return {
      success: true,
      data: user,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateUserAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    await this.ensureAdmin(token);
    const user = await this.userAdminService.updateUserAsAdmin(id, dto);
    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  @Patch(':id/toggle-status')
  @HttpCode(HttpStatus.OK)
  async toggleUserStatus(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const user = await this.userAdminService.toggleUserStatus(id);
    return {
      success: true,
      message: `User ${user.is_disabled ? 'disabled' : 'enabled'} successfully`,
      data: user,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUserAsAdmin(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.userAdminService.deleteUserAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }
}

