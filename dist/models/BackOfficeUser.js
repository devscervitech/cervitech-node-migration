import mongoose, { Schema } from 'mongoose';
import { UserSchema } from './User';
const BackOfficeUserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    verified: { type: Boolean, default: false },
    accessLevel: { type: String, required: true },
    readOnly: { type: String, required: true },
});
BackOfficeUserSchema.add({ ...UserSchema.obj });
const BackOfficeUser = mongoose.model('BackOfficeUser', BackOfficeUserSchema);
export default BackOfficeUser;
