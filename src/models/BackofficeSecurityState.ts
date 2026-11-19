import mongoose, { Model, Schema } from 'mongoose';

export const ACTIVE_BACKOFFICE_ADMIN_STATE_ID = 'active-backoffice-admins';

interface IBackofficeSecurityState {
  _id: string;
  activeAdminCount: number;
  adminMutationLocked: boolean;
}

const BackofficeSecurityStateSchema = new Schema<IBackofficeSecurityState>(
  {
    _id: { type: String, required: true },
    activeAdminCount: { type: Number, required: true, min: 0, default: 0 },
    adminMutationLocked: { type: Boolean, required: true, default: false },
  },
  { versionKey: false }
);

const BackofficeSecurityState: Model<IBackofficeSecurityState> =
  (mongoose.models.BackofficeSecurityState as Model<IBackofficeSecurityState> | undefined) ||
  mongoose.model<IBackofficeSecurityState>(
    'BackofficeSecurityState',
    BackofficeSecurityStateSchema
  );

export default BackofficeSecurityState;
