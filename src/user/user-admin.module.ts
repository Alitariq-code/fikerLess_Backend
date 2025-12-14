import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';
import { User, UserSchema } from '../models/schemas/user.schema';
import { Demographics, DemographicsSchema } from '../models/schemas/demographics.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Demographics.name, schema: DemographicsSchema },
    ]),
  ],
  controllers: [UserAdminController],
  providers: [UserAdminService],
  exports: [UserAdminService],
})
export class UserAdminModule {}

