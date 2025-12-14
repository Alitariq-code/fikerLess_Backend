import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternshipController } from './internship.controller';
import { InternshipService } from './internship.service';
import { Internship, InternshipSchema } from '../models/schemas/internship.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Internship.name, schema: InternshipSchema }]),
  ],
  controllers: [InternshipController],
  providers: [InternshipService],
  exports: [InternshipService],
})
export class InternshipModule {}

