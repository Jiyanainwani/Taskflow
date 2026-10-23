import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { TeamTaskWriteGuard } from './guards/team-task-write.guard.js';

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const testingModule = Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          },
        },
        AccessTokenGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    });

    const module: TestingModule = await testingModule
      .overrideGuard(TeamTaskWriteGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
