import { IsOptional, IsString, Matches } from 'class-validator';
import { SessionStatus } from '../../models/schemas/session.schema';

export class GetSessionsDto {
  @IsOptional()
  @IsString({ message: 'Start date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' })
  start_date?: string;

  @IsOptional()
  @IsString({ message: 'End date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' })
  end_date?: string;

  @IsOptional()
  @IsString({ message: 'Status must be a string' })
  status?: SessionStatus;

  @IsOptional()
  @IsString({ message: 'Doctor ID must be a string' })
  doctor_id?: string;

  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  user_id?: string;
}

