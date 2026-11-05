import { DataSource } from 'typeorm';
import BackOfficeUser from '../models/BackOfficeUser';
import AppUser from '../models/AppUser';
import PasswordResetToken from '../models/PasswordResetToken';
import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { Goal } from '../models/goal';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';
import TransactionRecord from '../models/TransactionRecord';
import ResponseRate from '../models/ResponseRate';

export const CerviTechDbContext = new DataSource({
  type: 'mongodb', // or 'mysql', 'sqlite', etc.
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true, // set to false in production
  entities: [
    BackOfficeUser,
    AppUser,
    PasswordResetToken,
    NeckAngleRecordModel,
    Goal,
    GoalCycleCompletionReport,
    TransactionRecord,
    ResponseRate,
  ],
});