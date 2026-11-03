import { ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import { TaskActivityAction } from './schemas/task-activity.schema.js';
import { TaskCommentDocument } from './schemas/task-comment.schema.js';
import { TaskActivityService } from './task-activity.service.js';
import { TaskCollaborationService } from './task-collaboration.service.js';
import { TasksService } from './tasks.service.js';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service.js';

describe('TaskCollaborationService', () => {
  const taskId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const userId = '507f1f77bcf86cd799439013';
  let service: TaskCollaborationService;
  let commentModel: ReturnType<typeof vi.fn> & {
    find: ReturnType<typeof vi.fn>;
  };
  let tasksService: {
    findOne: ReturnType<typeof vi.fn>;
    assertCanWriteTask: ReturnType<typeof vi.fn>;
  };
  let taskActivityService: {
    record: ReturnType<typeof vi.fn>;
    listForTask: ReturnType<typeof vi.fn>;
  };
  let realtimePublisher: { publishTaskEvent: ReturnType<typeof vi.fn> };
  let commentQuery: {
    sort: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    populate: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    commentQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };

    const commentDocument = {
      populate: vi
        .fn()
        .mockResolvedValue({ _id: 'comment-id', body: 'Looks good' }),
    };
    commentModel = vi.fn(function (this: Record<string, unknown>, data) {
      Object.assign(this, data);
      this.save = vi.fn().mockImplementation(function (
        this: Record<string, unknown>,
      ) {
        return Promise.resolve(this);
      });
      this.populate = commentDocument.populate;
    }) as unknown as typeof commentModel;
    commentModel.find = vi.fn().mockReturnValue(commentQuery);

    tasksService = {
      findOne: vi.fn().mockResolvedValue({ _id: taskId }),
      assertCanWriteTask: vi.fn().mockResolvedValue(undefined),
    };
    taskActivityService = {
      record: vi.fn().mockResolvedValue(undefined),
      listForTask: vi.fn().mockResolvedValue([]),
    };
    realtimePublisher = {
      publishTaskEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new TaskCollaborationService(
      commentModel as unknown as Model<TaskCommentDocument>,
      tasksService as unknown as TasksService,
      taskActivityService as unknown as TaskActivityService,
      realtimePublisher as unknown as RealtimePublisherService,
    );
  });

  it('checks task access and returns comments oldest first', async () => {
    await expect(
      service.listComments(userId, taskId.toString()),
    ).resolves.toEqual([]);

    expect(tasksService.findOne).toHaveBeenCalledWith(
      userId,
      taskId.toString(),
    );
    expect(commentModel.find).toHaveBeenCalledWith({ taskId });
    expect(commentQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(commentQuery.limit).toHaveBeenCalledWith(100);
    expect(commentQuery.populate).toHaveBeenCalledWith('author', 'name email');
  });

  it('saves a comment and records a matching activity event', async () => {
    await expect(
      service.createComment(userId, taskId.toString(), { body: 'Looks good' }),
    ).resolves.toEqual({ _id: 'comment-id', body: 'Looks good' });

    expect(tasksService.assertCanWriteTask).toHaveBeenCalledWith(userId, {
      _id: taskId,
    });
    expect(commentModel).toHaveBeenCalledWith({
      taskId,
      author: new Types.ObjectId(userId),
      body: 'Looks good',
    });
    expect(taskActivityService.record).toHaveBeenCalledWith(
      taskId,
      userId,
      TaskActivityAction.COMMENT_ADDED,
      'Added a comment',
    );
    expect(realtimePublisher.publishTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task.comment.added',
        taskId: taskId.toString(),
      }),
      { _id: taskId },
    );
  });

  it('does not create comments when the task role is read-only', async () => {
    tasksService.assertCanWriteTask.mockRejectedValue(
      new ForbiddenException('Viewers can only read team tasks'),
    );

    await expect(
      service.createComment(userId, taskId.toString(), { body: 'Not allowed' }),
    ).rejects.toThrow(ForbiddenException);

    expect(commentModel).not.toHaveBeenCalled();
    expect(taskActivityService.record).not.toHaveBeenCalled();
    expect(realtimePublisher.publishTaskEvent).not.toHaveBeenCalled();
  });

  it('checks task access before returning activity', async () => {
    await expect(
      service.listActivity(userId, taskId.toString()),
    ).resolves.toEqual([]);

    expect(tasksService.findOne).toHaveBeenCalledWith(
      userId,
      taskId.toString(),
    );
    expect(taskActivityService.listForTask).toHaveBeenCalledWith(taskId);
  });
});
