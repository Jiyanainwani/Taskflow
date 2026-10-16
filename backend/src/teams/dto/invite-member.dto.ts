
import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { TeamRole } from '../schemas/team.schema.js';

export class InviteMemberDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsIn([TeamRole.MEMBER, TeamRole.VIEWER])
  role?: TeamRole.MEMBER | TeamRole.VIEWER;
}
