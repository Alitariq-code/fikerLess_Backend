import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength } from 'class-validator';

export class ContactDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsNotEmpty({ message: 'Enquiry is required' })
  @IsString()
  @MinLength(10, { message: 'Enquiry must be at least 10 characters long' })
  enquiry: string;
}

