import { Controller, Post, Body, Headers, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  async signup(@Body() body: { email: string; password: string; user_type: string }) {
    if (!body || !body.email || !body.password || !body.user_type) {
      throw new BadRequestException('email, password, and user_type are required');
    }
    return this.authService.signup(body.email, body.password, body.user_type);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    if (!body || !body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.authService.login(body.email, body.password);
  }

  @Post('email-verify')
  @HttpCode(HttpStatus.OK)
  async emailVerify(@Body() body: { token: string }) {
    return this.authService.emailVerify(body.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    if (!body || !body.email) {
      throw new BadRequestException('Please provide your email address to reset your password.');
    }
    return this.authService.forgotPassword(body.email);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Headers('authorization') token: string,
    @Body() dto: ChangePasswordDto,
  ) {
    if (!dto || !dto.old_password || !dto.new_password) {
      throw new BadRequestException('Both old password and new password are required.');
    }
    return this.authService.changePassword(token, dto.old_password, dto.new_password);
  }
}

