
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
@UseGuards(AccessTokenGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get teams accessible to the authenticated user' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.teamsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.teamsService.findOne(req.user.id, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to a team' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid member data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the team owner can add members' })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  inviteMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(req.user.id, id, dto);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Update a team member role' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid member ID or role' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the team owner can update roles' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  updateMemberRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(
      req.user.id,
      id,
      memberId,
      dto,
    );
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from a team' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the team owner can remove members' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.removeMember(req.user.id, id, memberId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the team owner can delete the team' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.teamsService.remove(req.user.id, id);
  }
}
