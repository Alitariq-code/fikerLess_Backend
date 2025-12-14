import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { InternshipService } from './internship.service';
import { CreateInternshipDto } from './dto/create-internship.dto';

@Controller('api/v1/internships')
export class InternshipController {
  constructor(private readonly internshipService: InternshipService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInternship(@Body() createDto: CreateInternshipDto) {
    const internship = await this.internshipService.createInternship(createDto);
    return {
      success: true,
      message: 'Internship created successfully',
      data: internship,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllInternships(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const includeInactiveFlag = includeInactive === 'true';

    if (pageNum < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }
    
    // Allow higher limits for admin requests (when includeInactive is true)
    const maxLimit = includeInactiveFlag ? 1000 : 100;
    if (limitNum < 1 || limitNum > maxLimit) {
      throw new BadRequestException(`Limit must be between 1 and ${maxLimit}`);
    }

    const result = await this.internshipService.getAllInternships(search, city, pageNum, limitNum, includeInactiveFlag);
    return {
      success: true,
      ...result,
    };
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchInternships(@Query('q') searchTerm?: string) {
    if (!searchTerm) {
      throw new BadRequestException('Search term (q) is required');
    }
    const result = await this.internshipService.searchInternships(searchTerm);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getInternshipById(@Param('id') id: string) {
    const internship = await this.internshipService.getInternshipById(id);
    return {
      success: true,
      data: internship,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateInternship(
    @Param('id') id: string,
    @Body() updateDto: CreateInternshipDto,
  ) {
    const internship = await this.internshipService.updateInternship(id, updateDto);
    return {
      success: true,
      message: 'Internship updated successfully',
      data: internship,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteInternship(@Param('id') id: string) {
    await this.internshipService.deleteInternship(id);
    return {
      success: true,
      message: 'Internship deleted successfully',
    };
  }
}

