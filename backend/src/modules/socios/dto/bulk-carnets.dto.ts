import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class BulkCarnetsDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  ids: number[];
}
