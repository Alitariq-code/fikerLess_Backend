import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetAvailableSlotsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsString()
  @IsNotEmpty()
  doctor_id: string;
}

