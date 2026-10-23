
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { TeamRolesGuard } from './guards/team-roles.guard.js';
import { TeamRole } from './schemas/team.schema.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';

describe('TeamsController', () => {
  let controller: TeamsController;

  const teamsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    remove: vi.fn(),
  };

  const req = {
    user: { id: '507f1f77bcf86cd799439013' },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        {
          provide: TeamsService,
          useValue: teamsService,
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .overrideGuard(TeamRolesGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a team', async () => {
    const dto = { name: 'Development Team', description: 'Test team' };
    teamsService.create.mockResolvedValue({ name: dto.name });

    await controller.create(req as any, dto);

    expect(teamsService.create).toHaveBeenCalledWith(req.user.id, dto);
  });

  it('should list teams for the authenticated user', async () => {
    teamsService.findAll.mockResolvedValue([]);

    await controller.findAll(req as any);

    expect(teamsService.findAll).toHaveBeenCalledWith(req.user.id);
  });

  it('should return one team', async () => {
    teamsService.findOne.mockResolvedValue({ name: 'Development Team' });

    await controller.findOne(req as any, 'team-id');

    expect(teamsService.findOne).toHaveBeenCalledWith(
      req.user.id,
      'team-id',
    );
  });

  it('should invite a member', async () => {
    const dto: InviteMemberDto = {
      email: 'member@example.com',
      role: TeamRole.MEMBER,
    };

    teamsService.inviteMember.mockResolvedValue({});

    await controller.inviteMember(req as any, 'team-id', dto);

    expect(teamsService.inviteMember).toHaveBeenCalledWith(
      req.user.id,
      'team-id',
      dto,
    );
  });

  it('should update a member role', async () => {
    const dto: UpdateMemberRoleDto = {
      role: TeamRole.VIEWER,
    };

    teamsService.updateMemberRole.mockResolvedValue({});

    await controller.updateMemberRole(
      req as any,
      'team-id',
      'member-id',
      dto,
    );

    expect(teamsService.updateMemberRole).toHaveBeenCalledWith(
      req.user.id,
      'team-id',
      'member-id',
      dto,
    );
  });

  it('should remove a member', async () => {
    teamsService.removeMember.mockResolvedValue({});

    await controller.removeMember(req as any, 'team-id', 'member-id');

    expect(teamsService.removeMember).toHaveBeenCalledWith(
      req.user.id,
      'team-id',
      'member-id',
    );
  });

  it('should delete a team', async () => {
    teamsService.remove.mockResolvedValue({
      message: 'Team deleted successfully',
    });

    await controller.remove(req as any, 'team-id');

    expect(teamsService.remove).toHaveBeenCalledWith(
      req.user.id,
      'team-id',
    );
  });
});
