
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { TeamRole } from '../schemas/team.schema.js';

export class InviteMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn([TeamRole.MEMBER, TeamRole.VIEWER])
  role?: TeamRole.MEMBER | TeamRole.VIEWER;
}
