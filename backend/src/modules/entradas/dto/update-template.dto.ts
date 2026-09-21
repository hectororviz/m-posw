import { IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(48)
  widthCols?: number;

  @IsArray()
  elements!: Array<Record<string, unknown>>;
}
