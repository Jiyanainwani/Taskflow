import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    const project = new this.projectModel({
      ...dto,
      owner: new Types.ObjectId(userId),
    });

    return project.save();
  }

  async findAll(userId: string) {
    return this.projectModel
      .find({ owner: new Types.ObjectId(userId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  async findOne(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid project ID');
    }

    const project = await this.projectModel
      .findOne({
        _id: new Types.ObjectId(id),
        owner: new Types.ObjectId(userId),
      })
      .exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateProjectDto,
  ) {
    await this.findOne(userId, id);

    const updatedProject = await this.projectModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          owner: new Types.ObjectId(userId),
        },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedProject) {
      throw new NotFoundException('Project not found');
    }

    return updatedProject;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    const result = await this.projectModel
      .deleteOne({
        _id: new Types.ObjectId(id),
        owner: new Types.ObjectId(userId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Project not found');
    }

    return { message: 'Project deleted successfully' };
  }
}
