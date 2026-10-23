import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema.js';

describe('UsersService', () => {
  let service: UsersService;
  const userModel = {
    create: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a user with a normalized email when it is not already registered', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(null),
    };
    userModel.findOne.mockReturnValue(query);
    userModel.create.mockResolvedValue({ _id: 'new-user-id' });

    await expect(
      service.create('New User', '  NEW@Example.com  ', 'hashed-password'),
    ).resolves.toEqual({ _id: 'new-user-id' });

    expect(userModel.findOne).toHaveBeenCalledWith({ email: 'new@example.com' });
    expect(query.select).toHaveBeenCalledWith('+passwordHash');
    expect(userModel.create).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      passwordHash: 'hashed-password',
    });
  });

  it('rejects creating a user when the email already exists', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue({ _id: 'existing-user-id' }),
    };
    userModel.findOne.mockReturnValue(query);

    await expect(
      service.create('Another User', 'user@example.com', 'hashed-password'),
    ).rejects.toThrow('Email already exists');
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('normalizes the email and selects the password hash when finding a user', async () => {
    const foundUser = { _id: 'user-id', passwordHash: 'stored-hash' };
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(foundUser),
    };
    userModel.findOne.mockReturnValue(query);

    await expect(service.findByEmail('  USER@Example.com ')).resolves.toBe(
      foundUser,
    );
    expect(userModel.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(query.select).toHaveBeenCalledWith('+passwordHash');
    expect(query.exec).toHaveBeenCalledOnce();
  });
});
