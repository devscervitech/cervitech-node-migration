import axios from 'axios';
import { CerviTechDbContext } from '../config/CerviTechDbContext';
import { ApplicationConstant } from '../utils/applicationConstants';
import AppUser from '../models/AppUser';
export class PushNotificationDriver {
    constructor(logger, configuration, cerviTechDbContext = CerviTechDbContext) {
        this.db = CerviTechDbContext;
        this.logger = logger;
        this.config = configuration;
        this.FCMApiUrl = ApplicationConstant.ENV_FCM_API_URL;
        this.FCMServerKey = ApplicationConstant.ENV_FCM_SERVER_KEY;
        this.db = cerviTechDbContext;
    }
    async sendPushNotification(model) {
        try {
            const appUserRepo = CerviTechDbContext.getRepository(AppUser);
            const user = await appUserRepo.findOne({ where: { fcmToken: model.to } });
            if (user && !user.allowPushNotifications) {
                return true;
            }
            const senderId = 'xxx';
            const deviceId = model.to;
            const pushNotificationDTO = {
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
        }
        catch (error) {
            this.logger.error(error.message);
            throw error;
        }
    }
}
