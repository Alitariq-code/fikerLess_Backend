# Fikrless Backend - NestJS

NestJS backend application for Fikrless.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start MongoDB container:
```bash
docker-compose up -d
```

3. Create `.env` file (copy from `.env.example` and update values)

4. Run the application:
```bash
npm run start:dev
```

The API will be available at `http://localhost:5002`

## API Routes

### Authentication
- POST `/api/v1/auth/signup` - User registration
- POST `/api/v1/auth/login` - User login
- POST `/api/v1/auth/email-verify` - Email verification with OTP
- POST `/api/v1/auth/forgot-password` - Request password reset
- POST `/api/v1/auth/change-password` - Change password (requires Authorization header)

### Demographics
- POST `/api/v1/demographics` - Save user demographics

### Articles (Specialist & Public)
- POST `/api/v1/articles` - Create article (Specialist only)
- GET `/api/v1/articles/my-articles` - Get specialist's own articles (Specialist only)
- GET `/api/v1/articles` - List published articles (Public)
- GET `/api/v1/articles/featured` - Get featured articles (Public)
- GET `/api/v1/articles/categories` - Get all categories (Public)
- GET `/api/v1/articles/search` - Search articles (Public)
- GET `/api/v1/articles/:id` - Get article detail (Public)
- PUT `/api/v1/articles/:id` - Update article (Specialist only, own articles)
- DELETE `/api/v1/articles/:id` - Delete article (Specialist only, own articles)
- PATCH `/api/v1/articles/:id/publish` - Publish draft article (Specialist only)

## Environment Variables

See `.env.example` for required environment variables.

