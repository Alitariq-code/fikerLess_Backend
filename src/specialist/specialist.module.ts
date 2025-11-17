import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpecialistController } from './specialist.controller';
import { SpecialistService } from './specialist.service';
import { SpecialistProfile, SpecialistProfileSchema } from '../models/schemas/specialist-profile.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpecialistProfile.name, schema: SpecialistProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SpecialistController],
  providers: [SpecialistService],
})
export class SpecialistModule {}

