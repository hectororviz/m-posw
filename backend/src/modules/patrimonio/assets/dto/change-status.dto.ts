import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @IsInt()
  statusId: number;

  @IsOptional()
  @IsString()
  description?: string;
}
