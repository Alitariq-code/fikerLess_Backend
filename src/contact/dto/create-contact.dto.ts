import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  @IsString({ message: 'Number must be a string' })
  @MaxLength(20, { message: 'Number must not exceed 20 characters' })
  number?: string;

  @IsNotEmpty({ message: 'Enquiry is required' })
  @IsString({ message: 'Enquiry must be a string' })
  @MinLength(10, { message: 'Enquiry must be at least 10 characters long' })
  @MaxLength(2000, { message: 'Enquiry must not exceed 2000 characters' })
  enquiry: string;
}



