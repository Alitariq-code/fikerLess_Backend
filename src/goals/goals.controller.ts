import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token?: string): Promise<string | undefined> {
    if (!token) return undefined;
    
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      return undefined;
    }
    return result.user._id.toString();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGoal(
    @Headers('authorization') token: string,
    @Body() dto: CreateGoalDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to create a goal');
    }
    
    const goal = await this.goalsService.createGoal(userId, dto);
    return {
      success: true,
      message: 'Goal created successfully',
      data: goal,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getGoals(
    @Headers('authorization') token: string,
    @Query('status') status?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your goals');
    }
    
    const result = await this.goalsService.getGoals(userId, status);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getGoalById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your goals');
    }
    
    const goal = await this.goalsService.getGoalById(userId, id);
    return {
      success: true,
      data: goal,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateGoal(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to update a goal');
    }
    
    const goal = await this.goalsService.updateGoal(userId, id, dto);
    return {
      success: true,
      message: 'Goal updated successfully',
      data: goal,
    };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeGoal(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to complete a goal');
    }
    
    const goal = await this.goalsService.completeGoal(userId, id);
    return {
      success: true,
      message: 'Goal marked as completed successfully',
      data: goal,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteGoal(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to delete a goal');
    }
    
    const result = await this.goalsService.deleteGoal(userId, id);
    return {
      success: true,
      ...result,
    };
  }
}


