import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Serve static files from public directory
  // Use process.cwd() to get project root (works in both dev and prod)
  const publicPath = join(process.cwd(), 'public');
  app.useStaticAssets(publicPath, {
    prefix: '/',
  });
  logger.log(`📁 Serving static files from: ${publicPath}`);
  
  // Serve uploads/images directory via /api/uploads/images path
  const uploadsImagesPath = join(process.cwd(), 'public', 'uploads', 'images');
  app.useStaticAssets(uploadsImagesPath, {
    prefix: '/api/uploads/images',
  });
  logger.log(`📁 Serving uploaded images from: ${uploadsImagesPath} at /api/uploads/images`);
  
  // Serve Quotes directory as static files
  const quotesPath = join(process.cwd(), 'Quotes');
  app.useStaticAssets(quotesPath, {
    prefix: '/api/quotes',
  });
  logger.log(`📁 Serving quote images from: ${quotesPath} at /api/quotes`);
  
  // CORS configuration - allow all origins in development
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin)
      if (!origin) return callback(null, true);
      
      // List of allowed origins
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'https://fikrless.com',
      ];
      
      // In development, allow all localhost origins
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 5002;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📝 API logging is enabled`);
  logger.log(`🌐 Test page available at: http://localhost:${port}/audio-test.html`);
}

bootstrap();

