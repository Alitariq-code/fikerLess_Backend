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

- POST `/signup` - User registration
- POST `/login` - User login
- POST `/email-verify` - Email verification with OTP
- POST `/forgot-password` - Request password reset
- POST `/change-password` - Change password (requires Authorization header)
- POST `/demographics` - Save user demographics

## Environment Variables

See `.env.example` for required environment variables.

