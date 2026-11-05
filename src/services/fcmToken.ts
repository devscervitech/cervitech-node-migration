// services/appUserService.ts
import  AppUser  from '../models/AppUser';
import { appUserViewModel } from '../viewmodels/AppUserViewModel';
import { FCMTokenUpdateViewModel } from '../viewmodels/FCMTokenUpdateViewModel';
import CustomException from '../exceptions/customException';
import { logger } from '../utils/logger';
import { Logger } from 'winston'; // or your preferred logger
import { TokenGeneratorService } from './TokenGenerator';
import { MailService } from '../services/MailService';
import { MailSender } from '../services/MailSender';
import { PushNotificationDriver } from './pushNotificationDriver';
import { SendGridEmailSender } from './SendGridEmailSender';
import { CerviTechDbContext } from '../config/CerviTechDbContext';
import { ApplicationConstant } from '../utils/applicationConstants';
import { DataSource } from 'typeorm';

export class AppUserService {
  private logger: Logger;
  private db: DataSource = CerviTechDbContext;
  private config: NodeJS.ProcessEnv;
  private tokenGenerator: TokenGeneratorService;
  private mailService: MailService;
  private mailSender: MailSender;
  private pushNotificationDriver: PushNotificationDriver;
  private sendGridEmailSender: SendGridEmailSender;
  private numberOfRecordPostBeforeSendingAverageNeckAngle: number;
  private defaultPrompt: number;

  constructor(
    logger: Logger,
    cerviTechDbContext: DataSource = CerviTechDbContext,
    tokenGenerator: TokenGeneratorService,
    mailService: MailService,
    mailSender: MailSender,
    pushNotificationDriver: PushNotificationDriver,
    configuration: NodeJS.ProcessEnv,
    sendGridEmailSender: SendGridEmailSender
  ) {
    this.logger = logger;
    this.db = cerviTechDbContext;
    this.config = configuration;
    this.tokenGenerator = tokenGenerator;
    this.mailService = mailService;
    this.mailSender = mailSender;
    this.pushNotificationDriver = pushNotificationDriver;
    this.sendGridEmailSender = sendGridEmailSender;

    this.numberOfRecordPostBeforeSendingAverageNeckAngle = parseInt(
      ApplicationConstant.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE || '0',
      10
    );

    this.defaultPrompt = parseInt(
      ApplicationConstant.ENV_DEFAULT_PROMPT || '0',
      10
    );
  }
}

const updateFCMTokenAsync = async (
  update: FCMTokenUpdateViewModel
): Promise<appUserViewModel> => {
  try {
    if (!update || typeof update.userId !== 'number' || update.userId < 1) {
      throw new CustomException('UserId is not provided');
    }

    const user = await AppUser.findOne({ id: update.userId });
    if (!user) {
      throw new CustomException(
        'This user cannot be retrieved at the moment, please contact support.'
      );
    }

    user.fcmToken = update.fcmToken ?? user.fcmToken;

    await user.save();

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      pictureUrl: user.pictureUrl,
      fcmToken: user.fcmToken,
      prompt: user.prompt,
      hash: user.hash,
      salt: user.salt,
      currentTargetedAverageNeckAngle: user.currentTargetedAverageNeckAngle,
      isGoalOn: user.isGoalOn,
      hasPaid: user.hasPaid,
      allowPushNotifications: user.allowPushNotifications,
      responseRate: user.responseRate,
      dateRegistered: user.dateRegistered.toISOString(),
      lastLoginDateTime: user.lastLoginDateTime,
      neckAngleRecords: user.neckAngleRecords,
      mobileChannel: user.mobileChannel,
      notificationCount: user.notificationCount,
      notificationResponse: user.notificationResponse,
    };
  } catch (ex: unknown) {
    const error = ex instanceof Error ? ex : new Error('Unhandled exception');
    logger.error(error.message);
    throw error;
  }
};

export default {
  updateFCMTokenAsync,
  // Add other service functions here as needed
};

