import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class BaseDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @IsOptional()
  @IsDateString()
  updatedAt?: Date;
} 