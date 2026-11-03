import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';

import { S3StorageService } from '../storage/s3-storage.service.js';
import { CreateTaskAttachmentDto, TASK_ATTACHMENT_TYPES } from './dto/create-task-attachment.dto.js';
import { TaskAttachment, TaskAttachmentDocument } from './schemas/task-attachment.schema.js';
import { TasksService } from './tasks.service.js';

const FILE_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': (bytes) =>
    bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-',
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) =>
    bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
  'image/webp': (bytes) =>
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
};

@Injectable()
export class TaskAttachmentsService {
  constructor(
    @InjectModel(TaskAttachment.name)
    private readonly attachmentModel: Model<TaskAttachmentDocument>,
    private readonly tasksService: TasksService,
    private readonly storage: S3StorageService,
  ) {}

  async list(userId: string, taskId: string) {
    const task = await this.tasksService.findOne(userId, taskId);
    const items = await this.attachmentModel
      .find({ taskId: task._id, status: 'ready' })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id filename contentType size uploadedBy createdAt')
      .populate('uploadedBy', 'name email')
      .exec();
    return items;
  }

  async createUpload(userId: string, taskId: string, dto: CreateTaskAttachmentDto) {
    const task = await this.tasksService.findOne(userId, taskId);
    await this.tasksService.assertCanWriteTask(userId, task);
    if (!TASK_ATTACHMENT_TYPES.includes(dto.contentType)) {
      throw new BadRequestException('This file type is not allowed');
    }

    const filename = dto.filename.replace(/[\\/\p{Cc}]/gu, '_').trim();
    if (!filename) throw new BadRequestException('A filename is required');
    const objectKey = `tasks/${task._id.toString()}/${randomUUID()}`;
    const attachment = await this.attachmentModel.create({
      taskId: task._id,
      uploadedBy: new Types.ObjectId(userId),
      filename,
      contentType: dto.contentType,
      size: dto.size,
      objectKey,
      status: 'pending',
    });

    try {
      const uploadUrl = await this.storage.createUploadUrl(objectKey, dto.contentType);
      return { attachmentId: attachment._id.toString(), uploadUrl };
    } catch (error) {
      await attachment.deleteOne();
      throw error;
    }
  }

  async confirmUpload(userId: string, taskId: string, attachmentId: string) {
    const { task, attachment } = await this.getAttachment(userId, taskId, attachmentId);
    await this.tasksService.assertCanWriteTask(userId, task);
    if (attachment.uploadedBy.toString() !== userId) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.status === 'ready') return this.toPublicAttachment(attachment);

    const object = await this.storage.inspectObject(attachment.objectKey);
    const signatureMatches = FILE_SIGNATURES[attachment.contentType]?.(object.signature);
    if (
      object.size !== attachment.size ||
      object.contentType !== attachment.contentType ||
      !signatureMatches
    ) {
      await this.storage.deleteObject(attachment.objectKey);
      await attachment.deleteOne();
      throw new BadRequestException('Uploaded file did not match its declared type or size');
    }

    attachment.status = 'ready';
    await attachment.save();
    return this.toPublicAttachment(attachment);
  }

  async createDownloadUrl(userId: string, taskId: string, attachmentId: string) {
    const { attachment } = await this.getAttachment(userId, taskId, attachmentId);
    if (attachment.status !== 'ready') throw new NotFoundException('Attachment not found');
    const url = await this.storage.createDownloadUrl(attachment.objectKey, attachment.filename);
    return { url };
  }

  async remove(userId: string, taskId: string, attachmentId: string) {
    const { task, attachment } = await this.getAttachment(userId, taskId, attachmentId);
    await this.tasksService.assertCanWriteTask(userId, task);
    await this.storage.deleteObject(attachment.objectKey);
    await attachment.deleteOne();
    return { message: 'Attachment deleted successfully' };
  }

  private async getAttachment(userId: string, taskId: string, attachmentId: string) {
    const task = await this.tasksService.findOne(userId, taskId);
    if (!Types.ObjectId.isValid(attachmentId)) {
      throw new NotFoundException('Attachment not found');
    }
    const attachment = await this.attachmentModel
      .findOne({ _id: new Types.ObjectId(attachmentId), taskId: task._id })
      .exec();
    if (!attachment) throw new NotFoundException('Attachment not found');
    return { task, attachment };
  }

  private toPublicAttachment(attachment: TaskAttachmentDocument) {
    return {
      _id: attachment._id.toString(),
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      uploadedBy: attachment.uploadedBy,
      createdAt: attachment.createdAt,
    };
  }
}
