import { Redis } from 'ioredis';
import { RedisTaskListCache } from './redis-task-list.cache.js';
import { TaskStatus } from '../tasks/schemas/task.schema.js';

describe('RedisTaskListCache', () => {
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
    mget: ReturnType<typeof vi.fn>;
  };
  let cache: RedisTaskListCache;

  beforeEach(() => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      mget: vi.fn().mockResolvedValue([null, null]),
    };
    cache = new RedisTaskListCache(redis as unknown as Redis);
  });

  it('returns and parses an entry for the current cache generation', async () => {
    redis.get
      .mockResolvedValueOnce('4')
      .mockResolvedValueOnce('{"data":[],"hasNextPage":false,"nextCursor":null}');

    await expect(cache.get('user-a', { limit: 20 })).resolves.toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });
    expect(redis.get).toHaveBeenCalledTimes(2);
    expect(redis.get.mock.calls[1][0]).toContain('v4:user:user-a:');
  });

  it('uses distinct keys for different users and query filters', async () => {
    await cache.get('user-a', { status: TaskStatus.TODO, limit: 10 });
    await cache.get('user-b', { status: TaskStatus.TODO, limit: 10 });
    await cache.get('user-a', { status: TaskStatus.DONE, limit: 10 });

    const keys = redis.get.mock.calls
      .map((call) => call[0])
      .filter((key) => key.includes(':user:'));
    expect(new Set(keys).size).toBe(3);
  });

  it('sets a short TTL on cached pages', async () => {
    const page = { data: [], hasNextPage: false, nextCursor: null };
    await cache.set('user-a', { limit: 20 }, page);

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('user:user-a:'),
      JSON.stringify(page),
      'EX',
      30,
    );
  });

  it('invalidates all task-list pages by advancing the generation', async () => {
    await cache.invalidate();

    expect(redis.incr).toHaveBeenCalledWith('taskflow:cache:task-list:version');
  });

  it('reports cache hit and miss counters', async () => {
    redis.mget.mockResolvedValue(['3', '2']);

    await expect(cache.getReadStats()).resolves.toEqual({ hits: 3, misses: 2 });
    expect(redis.mget).toHaveBeenCalledWith(
      'taskflow:metrics:task-list:hits',
      'taskflow:metrics:task-list:misses',
    );
  });

  it('falls back to a cache miss when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('connection refused'));

    await expect(cache.get('user-a', { limit: 20 })).resolves.toBeNull();
  });
});
