import { IsString, MaxLength } from 'class-validator';

export class MagicAddDto {
  @IsString()
  @MaxLength(12_000)
  notes: string;
}
