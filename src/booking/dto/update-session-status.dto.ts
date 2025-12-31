import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SessionStatus } from '../../models/schemas/session.schema';

export class UpdateSessionStatusDto {
  @IsEnum(SessionStatus, { message: 'Invalid session status' })
  status: SessionStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  cancellation_reason?: string;
}

