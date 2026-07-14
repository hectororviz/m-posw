import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class NotificarDeudaBatchDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  acreedorIds: number[];
}
