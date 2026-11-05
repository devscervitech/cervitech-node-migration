import axios from 'axios';
import { Logger } from 'winston';
import { CerviTechDbContext } from '../config/CerviTechDbContext';
import { ApplicationConstant } from '../utils/applicationConstants';
import { PushNotificationModelDTO } from '../dtos/PushNotificationModelDTO';
import { FCMPushNotificationDTO } from '../dtos/FCMPushNotificationDTO';
import { DataSource } from 'typeorm';
import AppUser from '../models/AppUser';

export class PushNotificationDriver {
  private config: NodeJS.ProcessEnv;
  private logger: Logger;
  private db: DataSource = CerviTechDbContext;
  private FCMApiUrl: string;
  private FCMServerKey: string;
  static sendPushNotification: any;

  constructor(
    logger: Logger,
    configuration: NodeJS.ProcessEnv,
    cerviTechDbContext: DataSource = CerviTechDbContext,
  ) {
    this.logger = logger;
    this.config = configuration;
    this.FCMApiUrl = ApplicationConstant.ENV_FCM_API_URL;
    this.FCMServerKey = ApplicationConstant.ENV_FCM_SERVER_KEY;
    this.db = cerviTechDbContext;
  }

  public async sendPushNotification(model: PushNotificationModelDTO): Promise<boolean> {
    try {
      const appUserRepo = CerviTechDbContext.getRepository(AppUser);
      const user = await appUserRepo.findOne({ where: { fcmToken: model.to } });

      if (user && !user.allowPushNotifications) {
        return true;
      }

      const senderId = 'xxx';
      const deviceId = model.to;

      const pushNotificationDTO: FCMPushNotificationDTO = {
        to: deviceId,
        priority: 'high',
        notification: {
          sound: 'default',
          title: model.title,
          body: model.body,
        },
        data: {
          sound: 'default',
          title: model.title,
          body: model.body,
        },
      };

      const response = await axios.post(`${this.FCMApiUrl}/fcm/send`, pushNotificationDTO, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.FCMServerKey}`,
          'Sender': `id=${senderId}`,
        },
      });

      return true;
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  }
}
