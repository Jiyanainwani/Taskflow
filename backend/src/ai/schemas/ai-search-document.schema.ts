import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiSearchDocumentDocument = HydratedDocument<AiSearchDocument>;

@Schema({ timestamps: true })
export class AiSearchDocument {
  @Prop({ type: String, required: true, unique: true, index: true })
  sourceKey: string;

  @Prop({ type: String, required: true, enum: ['task', 'comment'], index: true })
  sourceType: 'task' | 'comment';

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  ownerId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Team', default: null, index: true })
  teamId: Types.ObjectId | null;

  @Prop({ type: String, required: true, maxlength: 4000 })
  text: string;

  @Prop({ type: String, required: true })
  contentHash: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  createdAt: Date;
  updatedAt: Date;
}

export const AiSearchDocumentSchema = SchemaFactory.createForClass(AiSearchDocument);
AiSearchDocumentSchema.index({ taskId: 1, sourceType: 1 });
