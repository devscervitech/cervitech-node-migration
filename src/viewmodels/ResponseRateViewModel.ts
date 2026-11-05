import { Activity } from "./Activity";
import { MobileChannel } from "./AppUser";
import mongoose from "mongoose";

export interface ResponseRateViewModel {
  appUserId: string;
  responseRate: number;
  totalPrompts: number;
  totalResponses: number;
  activity: Activity[];
}

export interface AppUserResponse {
  id: string;
  username: string;
  email: string;
  FCMToken: string;
  hasPaid: boolean;
  firstName?: string;
  lastName?: string;
  pictureUrl?: string;
  salt: string;
  hash: string;
  isGoalOn: boolean;
  allowPushNotifications: boolean;
  mobileChannel: MobileChannel;
  dateRegistered?: string;
  responseRate: number;
  lastLoginDateTime?: Date;
};


const ResponseRateSchema = new mongoose.Schema({
  appUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  prompt: { type: Number, default: 0 },
  response: { type: Number, default: 0 },
  dateCreated: { type: Date, default: Date.now }
});

const ResponseRate = mongoose.models.ResponseRate || mongoose.model("ResponseRate", ResponseRateSchema);
export default ResponseRate;
