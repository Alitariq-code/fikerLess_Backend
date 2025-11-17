import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DemographicsController } from './demographics.controller';
import { DemographicsService } from './demographics.service';
import { User, UserSchema } from '../models/schemas/user.schema';
import { Demographics, DemographicsSchema } from '../models/schemas/demographics.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Demographics.name, schema: DemographicsSchema },
    ]),
  ],
  controllers: [DemographicsController],
  providers: [DemographicsService],
})
export class DemographicsModule {}

