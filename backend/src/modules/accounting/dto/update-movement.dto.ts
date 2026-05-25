import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateMovementDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'refMovementId debe ser un UUID válido' })
  refMovementId?: string;
}
