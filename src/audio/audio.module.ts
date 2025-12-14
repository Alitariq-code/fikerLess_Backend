import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioController } from './audio.controller';
import { AudioAdminController } from './audio-admin.controller';
import { AudioService } from './audio.service';
import { Audio, AudioSchema } from '../models/schemas/audio.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Audio.name, schema: AudioSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AudioController, AudioAdminController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}

