
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TeamsService } from './teams.service.js';
import { TeamRole } from './schemas/team.schema.js';

describe('TeamsService', () => {
  let service: TeamsService;
  let teamModel: any;
  let userModel: any;
  let taskListCache: { invalidate: ReturnType<typeof vi.fn> };
  let team: any;

  const ownerId = '507f1f77bcf86cd799439013';
  const memberId = '507f1f77bcf86cd799439014';
  const teamId = '507f1f77bcf86cd799439011';
  const otherUserId = '507f1f77bcf86cd799439015';

  beforeEach(() => {
    teamModel = vi.fn(function (this: any, data: any) {
      Object.assign(this, data);
      this.save = vi.fn().mockImplementation(async function (this: any) {
        return this;
      });
    });

    teamModel.find = vi.fn();
    teamModel.findOne = vi.fn();
    teamModel.deleteOne = vi.fn();

    userModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(otherUserId) }),
        }),
      }),
    };

    team = {
      _id: new Types.ObjectId(teamId),
      name: 'Development Team',
      description: 'Test team',
      owner: new Types.ObjectId(ownerId),
      members: [
        {
          user: new Types.ObjectId(ownerId),
          role: TeamRole.OWNER,
        },
        {
          user: new Types.ObjectId(memberId),
          role: TeamRole.MEMBER,
        },
      ],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    taskListCache = { invalidate: vi.fn().mockResolvedValue(undefined) };
    service = new TeamsService(teamModel, userModel, taskListCache as any);
  });

  const mockFindOne = (result: any) => {
    const query = {
      populate: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(result),
    };
    teamModel.findOne.mockReturnValue({
      ...query,
    });
  };

  describe('create', () => {
    it('should create a team with the requesting user as owner', async () => {
      const result = await service.create(ownerId, {
        name: 'Development Team',
        description: 'Test team',
      });

      expect(teamModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Development Team',
          owner: expect.any(Types.ObjectId),
          members: [
            expect.objectContaining({
              user: expect.any(Types.ObjectId),
              role: TeamRole.OWNER,
            }),
          ],
        }),
      );

      expect(result.name).toBe('Development Team');
      expect(result.members[0].role).toBe(TeamRole.OWNER);
      expect(taskListCache.invalidate).toHaveBeenCalledOnce();
    });
  });

  describe('findAll', () => {
    it('should return teams owned by or joined by the user', async () => {
      const query = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([team]),
      };
      teamModel.find.mockReturnValue(query);

      const result = await service.findAll(ownerId);

      expect(teamModel.find).toHaveBeenCalledWith({
        $or: [
          { owner: expect.any(Types.ObjectId) },
          { 'members.user': expect.any(Types.ObjectId) },
        ],
      });

      expect(result).toEqual([team]);
      expect(query.sort).toHaveBeenCalledWith({
        createdAt: -1,
        _id: -1,
      });
    });
  });

  describe('findOne', () => {
    it('should return a team accessible to the user', async () => {
      mockFindOne(team);

      const result = await service.findOne(ownerId, teamId);

      expect(result).toBe(team);
    });

    it('should reject an invalid team ID', async () => {
      await expect(
        service.findOne(ownerId, 'invalid-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject access to a team the user does not belong to', async () => {
      mockFindOne(null);

      await expect(
        service.findOne(otherUserId, teamId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('inviteMember', () => {
    it('should add a member when requested by the owner', async () => {
      mockFindOne(team);

      const result = await service.inviteMember(ownerId, teamId, {
        email: 'new.member@example.com',
        role: TeamRole.MEMBER,
      });

      expect(team.members).toHaveLength(3);
      expect(team.members[2].user.toString()).toBe(otherUserId);
      expect(team.members[2].role).toBe(TeamRole.MEMBER);

      expect(result).toBeDefined();
      expect(result.members).toHaveLength(3);
      expect(result.members[2].user.toString()).toBe(otherUserId);
      expect(team.save).toHaveBeenCalled();
      expect(taskListCache.invalidate).toHaveBeenCalledOnce();

      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'new.member@example.com' });
    });

    it('should reject invitations from a non-owner', async () => {
      mockFindOne(team);

      await expect(
        service.inviteMember(memberId, teamId, {
          email: 'new.member@example.com',
          role: TeamRole.MEMBER,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(userModel.findOne).not.toHaveBeenCalled();
    });

    it('should reject an existing member', async () => {
      mockFindOne(team);
      userModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(memberId) }),
        }),
      });

      await expect(
        service.inviteMember(ownerId, teamId, {
          email: 'member@example.com',
          role: TeamRole.MEMBER,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'member@example.com' });
    });

    it('should reject inviting a user who does not exist', async () => {
      mockFindOne(team);

      userModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) }),
      });

      await expect(
        service.inviteMember(ownerId, teamId, {
          email: 'missing@example.com',
          role: TeamRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(team.save).not.toHaveBeenCalled();
    });

  });

  describe('updateMemberRole', () => {
    it('should update a member role when requested by the owner', async () => {
      mockFindOne(team);

      const result = await service.updateMemberRole(
        ownerId,
        teamId,
        memberId,
        { role: TeamRole.VIEWER },
      );

      expect(team.members[1].role).toBe(TeamRole.VIEWER);
      expect(result).toBe(team);
      expect(team.save).toHaveBeenCalled();
      expect(taskListCache.invalidate).toHaveBeenCalledOnce();
    });

    it('should reject role changes from a non-owner', async () => {
      mockFindOne(team);

      await expect(
        service.updateMemberRole(memberId, teamId, otherUserId, {
          role: TeamRole.VIEWER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject an invalid member ID', async () => {
      mockFindOne(team);

      await expect(
        service.updateMemberRole(ownerId, teamId, 'invalid-id', {
          role: TeamRole.VIEWER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject changing the owner role', async () => {
      mockFindOne(team);

      await expect(
        service.updateMemberRole(ownerId, teamId, ownerId, {
          role: TeamRole.VIEWER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a user who is not a team member', async () => {
      mockFindOne(team);

      await expect(
        service.updateMemberRole(ownerId, teamId, otherUserId, {
          role: TeamRole.VIEWER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('should remove a member when requested by the owner', async () => {
      mockFindOne(team);

      const result = await service.removeMember(
        ownerId,
        teamId,
        memberId,
      );

      expect(
        team.members.some(
          (item: any) => item.user.toString() === memberId,
        ),
      ).toBe(false);

      expect(result).toBe(team);
      expect(team.save).toHaveBeenCalled();
      expect(taskListCache.invalidate).toHaveBeenCalledOnce();
    });

    it('should reject removal by a non-owner', async () => {
      mockFindOne(team);

      await expect(
        service.removeMember(memberId, teamId, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject an invalid member ID', async () => {
      mockFindOne(team);

      await expect(
        service.removeMember(ownerId, teamId, 'invalid-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removing the owner', async () => {
      mockFindOne(team);

      await expect(
        service.removeMember(ownerId, teamId, ownerId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removing a user who is not a member', async () => {
      mockFindOne(team);

      await expect(
        service.removeMember(ownerId, teamId, otherUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a team when requested by its owner', async () => {
      mockFindOne(team);

      teamModel.deleteOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      const result = await service.remove(ownerId, teamId);

      expect(teamModel.deleteOne).toHaveBeenCalledWith({
        _id: team._id,
        owner: expect.any(Types.ObjectId),
      });

      expect(result).toEqual({
        message: 'Team deleted successfully',
      });
      expect(taskListCache.invalidate).toHaveBeenCalledOnce();
    });

    it('should reject deletion by a non-owner', async () => {
      mockFindOne(team);

      await expect(
        service.remove(memberId, teamId),
      ).rejects.toThrow(ForbiddenException);

      expect(teamModel.deleteOne).not.toHaveBeenCalled();
    });
  });
});
