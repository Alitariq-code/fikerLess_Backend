import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { Article, ArticleSchema } from '../models/schemas/article.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../models/schemas/specialist-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: User.name, schema: UserSchema },
      { name: SpecialistProfile.name, schema: SpecialistProfileSchema },
    ]),
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}

