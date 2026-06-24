import { IsOptional, IsString } from 'class-validator';

export class CreateLigaConfigDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsString()
  leagueId: string;

  @IsString()
  leagueName: string;

  @IsString()
  teamId: string;

  @IsString()
  teamName: string;
}
