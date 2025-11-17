import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpiritualController } from './spiritual.controller';
import { SpiritualService } from './spiritual.service';
import { SpecialistProfile, SpecialistProfileSchema } from '../models/schemas/specialist-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SpecialistProfile.name, schema: SpecialistProfileSchema }]),
  ],
  controllers: [SpiritualController],
  providers: [SpiritualService],
})
export class SpiritualModule {}

