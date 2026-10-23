import {Prop,Schema,SchemaFactory} from '@nestjs/mongoose'
import { HydratedDocument,Types } from 'mongoose'

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;

@Schema({
    timestamps:true
})
export class RefreshSession{
    @Prop({type:Types.ObjectId,required:true,ref:'User',index:true})
    userId:Types.ObjectId;

    @Prop({required:true,unique:true})
    tokenHash:string;

    @Prop({required:true})
    expiresAt:Date;

    @Prop({type:Date,default:null})
    revokedAt:Date|null;
}

export const RefreshSessionSchema=SchemaFactory.createForClass(RefreshSession);

RefreshSessionSchema.index({expiresAt:1},{expireAfterSeconds:0});
