import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StepsController } from './steps.controller';
import { StepsService } from './steps.service';
import { Steps, StepsSchema } from '../models/schemas/steps.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Steps.name, schema: StepsSchema },
      { name: User.name, schema: UserSchema }
    ])
  ],
  controllers: [StepsController],
  providers: [StepsService]
})
export class ActivityModule {}

