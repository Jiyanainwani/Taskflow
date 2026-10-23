
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import argon2 from 'argon2';

import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Task,
  TaskSchema,
  TaskStatus,
  TaskPriority,
} from '../tasks/schemas/task.schema.js';
import { Project, ProjectSchema } from '../projects/schemas/project.schema.js';
import {
  Team,
  TeamSchema,
  TeamRole,
} from '../teams/schemas/team.schema.js';

async function seed() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing from your environment');
  }

  await mongoose.connect(mongoUri);

  try {
    const UserModel = mongoose.model(User.name, UserSchema);
    const TaskModel = mongoose.model(Task.name, TaskSchema);
    const ProjectModel = mongoose.model(Project.name, ProjectSchema);
    const TeamModel = mongoose.model(Team.name, TeamSchema);

    const passwordHash = await argon2.hash(
      process.env.SEED_PASSWORD ?? 'TaskFlowDemo123!',
    );

    const userData = [
      { name: 'TaskFlow Demo Owner', email: 'owner.seed@example.com' },
      { name: 'TaskFlow Demo Member', email: 'member.seed@example.com' },
      { name: 'TaskFlow Demo Viewer', email: 'viewer.seed@example.com' },
    ];

    const users = [];

    for (const data of userData) {
      const user = await UserModel.findOneAndUpdate(
        { email: data.email },
        {
          $setOnInsert: {
            name: data.name,
            email: data.email,
            passwordHash,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      ).exec();

      users.push(user);
    }

    const [owner, member, viewer] = users;

    if (!owner || !member || !viewer) {
      throw new Error('Unable to create or retrieve seed users');
    }

    const project = await ProjectModel.findOneAndUpdate(
      { owner: owner._id, name: 'TaskFlow Demo Project' },
      {
        $setOnInsert: {
          name: 'TaskFlow Demo Project',
          description: 'Sample project created by the seed script',
          owner: owner._id,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).exec();

    const taskData = [
      {
        title: 'Review TaskFlow APIs',
        description: 'Verify Tasks, Projects, and Teams endpoints',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      },
      {
        title: 'Test Swagger documentation',
        description: 'Verify protected API endpoints',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
      },
      {
        title: 'Complete backend testing',
        description: 'Review the backend regression tests',
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
      },
    ];

    for (const data of taskData) {
      await TaskModel.findOneAndUpdate(
        { owner: owner._id, title: data.title },
        {
          $setOnInsert: {
            ...data,
            owner: owner._id,
            dueDate: null,
          },
        },
        { upsert: true, returnDocument: 'after' },
      ).exec();
    }

    const team = await TeamModel.findOneAndUpdate(
      { owner: owner._id, name: 'TaskFlow Demo Team' },
      {
        $setOnInsert: {
          name: 'TaskFlow Demo Team',
          description: 'Sample team created by the seed script',
          owner: owner._id,
          members: [
            {
              user: new Types.ObjectId(owner._id),
              role: TeamRole.OWNER,
              joinedAt: new Date(),
            },
            {
              user: new Types.ObjectId(member._id),
              role: TeamRole.MEMBER,
              joinedAt: new Date(),
            },
            {
              user: new Types.ObjectId(viewer._id),
              role: TeamRole.VIEWER,
              joinedAt: new Date(),
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).exec();

    console.log('Seed completed successfully');
    console.log({
      users: users.length,
      projectId: project._id.toString(),
      teamId: team._id.toString(),
      taskCount: taskData.length,
    });

    console.log('Demo login emails:');
    console.log(userData.map((user) => user.email));
    console.log(
      'Demo password: set SEED_PASSWORD in your local environment to choose it.',
    );
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
