import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoodController } from './mood.controller';
import { MoodService } from './mood.service';
import { Mood, MoodSchema } from '../models/schemas/mood.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mood.name, schema: MoodSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MoodController],
  providers: [MoodService],
  exports: [MoodService],
})
export class MoodModule {}

