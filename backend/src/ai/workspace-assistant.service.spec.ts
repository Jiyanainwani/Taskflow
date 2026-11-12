import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceAssistantService } from './workspace-assistant.service.js';

describe('WorkspaceAssistantService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const approvalId = '9c10fd95-9f88-4ee9-bf13-86ec4729a48d';
  let tasksService: { findAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let aiService: { consumeQuota: ReturnType<typeof vi.fn>; recordTextGenerationUsage: ReturnType<typeof vi.fn> };
  let model: { isConfigured: ReturnType<typeof vi.fn>; runWorkspaceAssistant: ReturnType<typeof vi.fn> };
  let redis: { eval: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let service: WorkspaceAssistantService;

  beforeEach(() => {
    tasksService = {
      findAll: vi.fn().mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null }),
      create: vi.fn().mockResolvedValue({ _id: { toString: () => '507f1f77bcf86cd799439012' }, title: 'Release notes', status: 'todo', priority: 'high' }),
      update: vi.fn(),
    };
    aiService = {
      consumeQuota: vi.fn().mockResolvedValue({ used: 1 }),
      recordTextGenerationUsage: vi.fn().mockResolvedValue(0.001),
    };
    model = {
      isConfigured: vi.fn().mockReturnValue(true),
      runWorkspaceAssistant: vi.fn().mockResolvedValue({
        answer: 'I prepared a task proposal for your review.',
        action: { type: 'create_task', input: { title: 'Release notes', priority: 'high' } },
        inputTokens: 100,
        outputTokens: 20,
      }),
    };
    redis = {
      eval: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
    };
    service = new WorkspaceAssistantService(
      tasksService as never,
      aiService as never,
      model as never,
      { info: vi.fn(), error: vi.fn() } as never,
      redis as never,
    );
  });

  it('returns a stored proposal without writing a task', async () => {
    const result = await service.ask(userId, { question: 'Create a high-priority task for release notes.' });

    expect(result.pendingAction?.action).toEqual({
      type: 'create_task',
      input: { title: 'Release notes', priority: 'high' },
    });
    expect(redis.set).toHaveBeenCalledWith(
      `taskflow:ai:v1:assistant-approval:${userId}:${result.pendingAction?.approvalId}`,
      expect.any(String),
      'EX',
      600,
      'NX',
    );
    expect(tasksService.create).not.toHaveBeenCalled();
    expect(tasksService.update).not.toHaveBeenCalled();
  });

  it('discards a rejected proposal without writing a task', async () => {
    redis.eval.mockResolvedValueOnce(JSON.stringify({
      type: 'create_task',
      input: { title: 'Release notes', priority: 'high' },
    }));

    await expect(service.confirm(userId, { approvalId, approved: false })).resolves.toMatchObject({ approved: false });
    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('writes only after explicit approval and consumes the approval once', async () => {
    redis.eval
      .mockResolvedValueOnce(JSON.stringify({
        type: 'create_task',
        input: { title: 'Release notes', priority: 'high' },
      }))
      .mockResolvedValueOnce(null);

    await expect(service.confirm(userId, { approvalId, approved: true })).resolves.toMatchObject({
      approved: true,
      task: { title: 'Release notes' },
    });
    expect(tasksService.create).toHaveBeenCalledWith(userId, { title: 'Release notes', priority: 'high' });
    await expect(service.confirm(userId, { approvalId, approved: true })).rejects.toThrow('expired or has already been handled');
    expect(tasksService.create).toHaveBeenCalledTimes(1);
  });
});
