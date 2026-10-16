import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import {
  Task,
  TaskDocument,
  TaskPriority,
  TaskStatus,
} from './schemas/task.schema.js';
describe('TasksService', () => {
  let service: TasksService;
  let module: TestingModule;
  let taskModel: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
  };

  const userId = '507f1f77bcf86cd799439013';
  const taskId = '507f1f77bcf86cd799439011';

  beforeEach(async () => {
    taskModel = {
      find: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    };

    const mockConstructor = vi.fn(function (
      this: Record<string, unknown>,
      data,
    ) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    });

    Object.assign(mockConstructor, taskModel);

    module = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: mockConstructor,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should assign the owner and save a task', async () => {
      const result = await service.create(userId, {
        title: 'Test task',
        description: 'Testing create',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueDate: undefined,
      });

      expect(result.title).toBe('Test task');
      expect(result.owner).toEqual(new Types.ObjectId(userId));
      expect(result.save).toBeDefined();
    });

    it('should default description and dueDate when omitted', async () => {
      const result = await service.create(userId, {
        title: 'Minimal task',
      });

      expect(result.description).toBe('');
      expect(result.dueDate).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return a page and a next cursor when more tasks exist', async () => {
      const tasks = [
        {
          _id: { toString: () => '507f1f77bcf86cd799439011' },
          createdAt: new Date('2026-10-15T10:00:00.000Z'),
        },
        {
          _id: { toString: () => '507f1f77bcf86cd799439012' },
          createdAt: new Date('2026-10-14T10:00:00.000Z'),
        },
      ];

      const query = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(tasks),
      };

      taskModel.find.mockReturnValue(query);

      const result = await service.findAll(userId, { limit: 1 });

      expect(query.sort).toHaveBeenCalledWith({
        createdAt: -1,
        _id: -1,
      });
      expect(query.limit).toHaveBeenCalledWith(2);
      expect(result.data).toHaveLength(1);
      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should return no next cursor when there are no more tasks', async () => {
      const query = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      taskModel.find.mockReturnValue(query);

      const result = await service.findAll(userId, { limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should reject an invalid cursor', async () => {
      await expect(
        service.findAll(userId, {
          limit: 10,
          cursor: 'invalid-cursor',
        }),
      ).rejects.toThrow('Invalid pagination cursor');
    });

    it('should apply status and priority filters', async () => {
      const query = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      taskModel.find.mockReturnValue(query);

      await service.findAll(userId, {
        limit: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      });

      expect(taskModel.find).toHaveBeenCalledWith({
        owner: new Types.ObjectId(userId),
        status: 'todo',
        priority: 'high',
      });
    });
  });

  describe('findOne', () => {
    it('should return a task owned by the user', async () => {
      const task = { _id: taskId, title: 'My task' };
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(task),
      });

      await expect(service.findOne(userId, taskId)).resolves.toEqual(task);
      expect(taskModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(taskId),
        owner: new Types.ObjectId(userId),
      });
    });

    it('should reject an invalid task ID', async () => {
      await expect(service.findOne(userId, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return not found when the task is not owned by the user', async () => {
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(userId, taskId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a task owned by the user', async () => {
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: taskId }),
      });

      const updatedTask = { _id: taskId, title: 'Updated task' };
      taskModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedTask),
      });

      await expect(
        service.update(userId, taskId, { title: 'Updated task' }),
      ).resolves.toEqual(updatedTask);

      expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(taskId),
          owner: new Types.ObjectId(userId),
        },
        { $set: { title: 'Updated task' } },
        { new: true, runValidators: true },
      );
    });

    it('should reject updating a task not owned by the user', async () => {
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(userId, taskId, { title: 'Unauthorized change' }),
      ).rejects.toThrow(NotFoundException);

      expect(taskModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a task owned by the user', async () => {
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: taskId }),
      });
      taskModel.deleteOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await expect(service.remove(userId, taskId)).resolves.toEqual({
        message: 'Task deleted successfully',
      });

      expect(taskModel.deleteOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(taskId),
        owner: new Types.ObjectId(userId),
      });
    });

    it('should reject deleting a task not owned by the user', async () => {
      taskModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.remove(userId, taskId)).rejects.toThrow(
        NotFoundException,
      );

      expect(taskModel.deleteOne).not.toHaveBeenCalled();
    });
  });
});
