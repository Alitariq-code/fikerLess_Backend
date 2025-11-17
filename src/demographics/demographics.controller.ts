import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DemographicsService } from './demographics.service';

@Controller()
export class DemographicsController {
  constructor(private readonly demographicsService: DemographicsService) {}

  @Post('demographics')
  @HttpCode(HttpStatus.OK)
  async saveDemographics(@Body() body: { user_id: string; demographics: any }) {
    return this.demographicsService.saveDemographics(body.user_id, body.demographics);
  }
}

