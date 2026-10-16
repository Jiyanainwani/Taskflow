import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProjectsService } from './projects.service.js';
import { Project } from './schemas/project.schema.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let module: TestingModule;
  let projectModel: any;

  const userId = '507f1f77bcf86cd799439013';
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(async () => {
    projectModel = vi.fn(function (this: any, data: any) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    });

    projectModel.find = vi.fn();
    projectModel.findOne = vi.fn();
    projectModel.findOneAndUpdate = vi.fn();
    projectModel.deleteOne = vi.fn();

    module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getModelToken(Project.name),
          useValue: projectModel,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a project with the authenticated user as owner', async () => {
    const result = await service.create(userId, {
      name: 'TaskFlow',
      description: 'Backend project',
    });

    expect(result.name).toBe('TaskFlow');
    expect(result.owner).toEqual(new Types.ObjectId(userId));
    expect(result.save).toHaveBeenCalled();
  });

  it('should list only the authenticated user’s projects', async () => {
    const projects = [{ _id: projectId, name: 'TaskFlow' }];
    const query = {
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(projects),
    };

    projectModel.find.mockReturnValue(query);

    await expect(service.findAll(userId)).resolves.toEqual(projects);

    expect(projectModel.find).toHaveBeenCalledWith({
      owner: new Types.ObjectId(userId),
    });
    expect(query.sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1,
    });
  });

  it('should return a project owned by the user', async () => {
    const project = { _id: projectId, name: 'TaskFlow' };

    projectModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(project),
    });

    await expect(service.findOne(userId, projectId)).resolves.toEqual(project);
  });

  it('should reject an invalid project ID', async () => {
    await expect(service.findOne(userId, 'invalid-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject a project not owned by the user', async () => {
    projectModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    await expect(service.findOne(userId, projectId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update an owned project', async () => {
    projectModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: projectId }),
    });

    const updatedProject = { _id: projectId, name: 'Updated' };

    projectModel.findOneAndUpdate.mockReturnValue({
      exec: vi.fn().mockResolvedValue(updatedProject),
    });

    await expect(
      service.update(userId, projectId, { name: 'Updated' }),
    ).resolves.toEqual(updatedProject);

    expect(projectModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(projectId),
        owner: new Types.ObjectId(userId),
      },
      { $set: { name: 'Updated' } },
      { new: true, runValidators: true },
    );
  });

  it('should delete an owned project', async () => {
    projectModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: projectId }),
    });

    projectModel.deleteOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    await expect(service.remove(userId, projectId)).resolves.toEqual({
      message: 'Project deleted successfully',
    });
  });
});
