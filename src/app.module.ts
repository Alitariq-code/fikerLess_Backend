import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { DemographicsModule } from './demographics/demographics.module';
import { MailModule } from './mail/mail.module';
import { ActivityModule } from './activity/activity.module';
import { SpecialistModule } from './specialist/specialist.module';
import { MoodModule } from './mood/mood.module';
import { SpiritualModule } from './spiritual/spiritual.module';
import { NotificationModule } from './notification/notification.module';
import { ArticleModule } from './article/article.module';
import { ForumModule } from './forum/forum.module';
import { JournalModule } from './journal/journal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const host = process.env.MONGODB_HOST || 'localhost';
        const port = process.env.MONGODB_PORT || 27017;
        const db = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'fikrless_db';
        const username = process.env.MONGODB_USERNAME;
        const password = process.env.MONGODB_PASSWORD;

        let uri = `mongodb://${host}:${port}/${db}`;

        if (username && password) {
          uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=admin`;
        } else {
          uri = `mongodb://${host}:${port}/${db}`;
        }

        console.log(`Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
        return {
          uri,
        };
      },
    }),
    AuthModule,
    DemographicsModule,
    MailModule,
    ActivityModule,
    SpecialistModule,
    MoodModule,
    SpiritualModule,
    NotificationModule,
        ArticleModule,
        ForumModule,
        JournalModule,
      ],
    })
    export class AppModule {}

