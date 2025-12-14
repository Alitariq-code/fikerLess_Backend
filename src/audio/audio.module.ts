import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { Audio, AudioSchema } from '../models/schemas/audio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Audio.name, schema: AudioSchema },
    ]),
  ],
  controllers: [AudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}

