import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { SessionStatus } from '../../models/schemas/session.schema';

export class GetSessionsByDateDto {
  @IsOptional()
  @ValidateIf((o) => o.date !== undefined && o.date !== null && o.date !== '')
  @IsString({ message: 'Date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString({ message: 'Status must be a string' })
  status?: SessionStatus;
}

