import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(48)
  widthCols?: number;

  @IsArray()
  elements!: Array<Record<string, unknown>>;
}
