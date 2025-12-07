import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { Journal, JournalSchema } from '../models/schemas/journal.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Journal.name, schema: JournalSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [JournalController],
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}

