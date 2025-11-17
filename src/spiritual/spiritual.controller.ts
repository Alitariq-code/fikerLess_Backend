import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { SpiritualService } from './spiritual.service';

@Controller('api/v1/spiritual')
export class SpiritualController {
  constructor(private readonly spiritualService: SpiritualService) {}

  @Get('practitioners')
  @HttpCode(HttpStatus.OK)
  async getPractitioners(
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('specialization') specialization?: string,
    @Query('verified') verified?: string,
    @Query('min_rating') minRating?: string,
    @Query('max_rate') maxRate?: string,
    @Query('min_experience') minExperience?: string,
  ) {
    const result = await this.spiritualService.getPractitioners({
      category,
      location,
      specialization,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      min_rating: minRating ? parseFloat(minRating) : undefined,
      max_rate: maxRate ? parseFloat(maxRate) : undefined,
      min_experience: minExperience ? parseFloat(minExperience) : undefined,
    });

    return {
      success: true,
      data: result,
    };
  }
}

