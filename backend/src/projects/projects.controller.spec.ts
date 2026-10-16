import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const userId = '507f1f77bcf86cd799439013';
  const projectId = '507f1f77bcf86cd799439011';

  const req = {
    user: { id: userId },
  } as any;

beforeEach(async () => {
  projectsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const moduleBuilder = Test.createTestingModule({
    controllers: [ProjectsController],
    providers: [
      {
        provide: ProjectsService,
        useValue: projectsService,
      },
    ],
  }).overrideGuard(AccessTokenGuard).useValue({
    canActivate: vi.fn(() => true),
  });

  const module: TestingModule = await moduleBuilder.compile();

  controller = module.get<ProjectsController>(ProjectsController);
});

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a project for the authenticated user', async () => {
    const dto = {
      name: 'TaskFlow',
      description: 'Backend project',
    };
    const project = { _id: projectId, ...dto, owner: userId };

    projectsService.create.mockResolvedValue(project);

    await expect(controller.create(req, dto)).resolves.toEqual(project);
    expect(projectsService.create).toHaveBeenCalledWith(userId, dto);
  });

  it('should list the authenticated user’s projects', async () => {
    const projects = [{ _id: projectId, name: 'TaskFlow' }];
    projectsService.findAll.mockResolvedValue(projects);

    await expect(controller.findAll(req)).resolves.toEqual(projects);
    expect(projectsService.findAll).toHaveBeenCalledWith(userId);
  });

  it('should get a project by ID', async () => {
    const project = { _id: projectId, name: 'TaskFlow' };
    projectsService.findOne.mockResolvedValue(project);

    await expect(controller.findOne(req, projectId)).resolves.toEqual(project);
    expect(projectsService.findOne).toHaveBeenCalledWith(userId, projectId);
  });

  it('should update a project', async () => {
    const dto = { name: 'Updated TaskFlow' };
    const project = { _id: projectId, ...dto };
    projectsService.update.mockResolvedValue(project);

    await expect(
      controller.update(req, projectId, dto),
    ).resolves.toEqual(project);

    expect(projectsService.update).toHaveBeenCalledWith(
      userId,
      projectId,
      dto,
    );
  });

  it('should delete a project', async () => {
    const result = { message: 'Project deleted successfully' };
    projectsService.remove.mockResolvedValue(result);

    await expect(controller.remove(req, projectId)).resolves.toEqual(result);
    expect(projectsService.remove).toHaveBeenCalledWith(userId, projectId);
  });
});
