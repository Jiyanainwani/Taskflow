
import { IsIn } from 'class-validator';
import { TeamRole } from '../schemas/team.schema.js';

export class UpdateMemberRoleDto {
  @IsIn([TeamRole.MEMBER, TeamRole.VIEWER])
  role: TeamRole.MEMBER | TeamRole.VIEWER;
}
