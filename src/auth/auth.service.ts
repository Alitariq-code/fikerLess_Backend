import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { MailService } from '../mail/mail.service';
import { generateJwtToken, validateEmail, validatePassword, generateRandomToken, findUserByEmail, getUserFromToken } from '../utils/utils';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SpecialistProfile.name) private specialistModel: Model<SpecialistProfileDocument>,
    private mailService: MailService,
  ) {}

  async signup(email: string, password: string, userType: string) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      throw new BadRequestException(emailValidation.error);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new BadRequestException('Email already registered. Please login.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateRandomToken();

    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      otp_token: verificationToken,
      user_type: userType,
    });

    try {
      await newUser.save();

      const subject = 'OTP for Email Verification';
      const verificationUrl = `/verify-email?token=${verificationToken}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify your email</h2>
          <p>Use the code below or click the button to verify your account:</p>
          <div style="text-align: center; margin: 16px 0;">
            <div style="display:inline-block; font-size:24px; letter-spacing:6px; padding:12px 16px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb;">
              ${verificationToken}
            </div>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Verify Email
            </a>
          </div>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      `;

      await this.mailService.sendEmail(email, subject, emailBody);

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        email: email,
        user_id: newUser._id.toString(),
      };
    } catch (error) {
      await this.userModel.deleteOne({ _id: newUser._id }).exec();
      throw new BadRequestException('Internal Server Error');
    }
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('User does not Exist');
    }

    if (!user.is_email_verified) {
      throw new UnauthorizedException('Please verify your email');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.user_type === 'user' && !user.has_demographics) {
      throw new UnauthorizedException('Please Give Your Demographics Data');
    }

    if (user.user_type === 'specialist') {
      const profile = await this.specialistModel.findOne({ user_id: user._id });
      if (!profile) {
        throw new UnauthorizedException('Please complete your specialist profile');
      }
    }

    const tokenResult = generateJwtToken(user);
    if (!tokenResult.success) {
      throw new BadRequestException(tokenResult.error);
    }

    return {
      user_id: user._id.toString(),
      email: user.email,
      phone_number: user.phone_number,
      has_demographics: user.has_demographics,
      is_email_verified: user.is_email_verified,
      user_type: user.user_type,
      token: tokenResult.token,
    };
  }

  async emailVerify(token: string) {
    if (!token) {
      throw new BadRequestException('Please provide the verification code to continue.');
    }

    const user = await this.userModel.findOne({ otp_token: token }).exec();
    if (!user) {
      throw new NotFoundException('Invalid OTP Token');
    }

    user.is_email_verified = true;
    await user.save();

    const tokenResult = generateJwtToken(user);
    if (!tokenResult.success) {
      throw new BadRequestException('Failed to Generate JWT Token');
    }

    return {
      user_id: user._id.toString(),
      message: 'OTP successfully verified!',
      token: tokenResult.token,
    };
  }

  async forgotPassword(email: string) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      throw new BadRequestException(emailValidation.error);
    }

    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('No account found with this email address. Please sign up first.');
    }

    const verificationToken = generateRandomToken();
    user.otp_token = verificationToken;
    await user.save();

    const emailBody = `
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Password Reset Request - Fikrless</h2>
        <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
        <p>Your password reset code is:</p>
        <h1 style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center; font-size: 32px; letter-spacing: 5px;">${verificationToken}</h1>
        <p>This code will expire in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>Best regards,<br>The Fikrless Team</p>
      </body>
      </html>
    `;

    await this.mailService.sendEmail(email, 'Password Reset Code - Fikrless', emailBody);

    return {
      message: 'Password reset code has been sent to your email',
      email: email,
    };
  }

  async changePassword(token: string, newPassword: string) {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature.');
    }

    const result = await getUserFromToken(token, this.userModel);
    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }

    const user = result.user;
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return {
      message: 'Your password has been changed successfully!',
    };
  }
}

