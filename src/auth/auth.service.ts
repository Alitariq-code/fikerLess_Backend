import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { MailService } from '../mail/mail.service';
import { generateJwtToken, validateEmail, validatePassword, generateRandomToken, findUserByEmail, getUserFromToken, generateUniqueUsername } from '../utils/utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    // Generate initial username from email
    const initialUsername = await generateUniqueUsername('', '', email, this.userModel);

    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      otp_token: verificationToken,
      user_type: userType,
      username: initialUsername,
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
      // Clean up the user if creation failed
      try {
        await this.userModel.deleteOne({ _id: newUser._id }).exec();
      } catch (deleteError) {
        this.logger.error(`Failed to cleanup user ${newUser._id} after signup error:`, deleteError);
      }
      
      // Log the actual error for debugging
      this.logger.error(`Signup failed for ${email}:`, error);
      
      // Return a more helpful error message
      const errorMessage = error?.message || 'Failed to create account. Please try again.';
      throw new BadRequestException(errorMessage);
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
      username: user.username || '',
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
      email: user.email,
      username: user.username || '',
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

  async changePassword(token: string, oldPassword: string, newPassword: string) {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature.');
    }

    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Invalid session. Please log in again.');
    }

    const user = result.user;

    // Validate old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Old password is incorrect. Please try again.');
    }

    // Check if new password is the same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from your current password.');
    }

    // Validate new password strength (same as signup)
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    this.logger.log(`Password changed successfully for user ${user.email}`);

    return {
      message: 'Your password has been changed successfully!',
    };
  }
}

