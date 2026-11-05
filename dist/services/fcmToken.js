// services/appUserService.ts
import AppUser from '../models/AppUser';
import CustomException from '../exceptions/customException';
import { logger } from '../utils/logger';
import { CerviTechDbContext } from '../config/CerviTechDbContext';
import { ApplicationConstant } from '../utils/applicationConstants';
export class AppUserService {
    constructor(logger, cerviTechDbContext = CerviTechDbContext, tokenGenerator, mailService, mailSender, pushNotificationDriver, configuration, sendGridEmailSender) {
        this.db = CerviTechDbContext;
        this.logger = logger;
        this.db = cerviTechDbContext;
        this.config = configuration;
        this.tokenGenerator = tokenGenerator;
        this.mailService = mailService;
        this.mailSender = mailSender;
        this.pushNotificationDriver = pushNotificationDriver;
        this.sendGridEmailSender = sendGridEmailSender;
        this.numberOfRecordPostBeforeSendingAverageNeckAngle = parseInt(ApplicationConstant.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE || '0', 10);
        this.defaultPrompt = parseInt(ApplicationConstant.ENV_DEFAULT_PROMPT || '0', 10);
    }
}
const updateFCMTokenAsync = async (update) => {
    try {
        if (!update || typeof update.userId !== 'number' || update.userId < 1) {
            throw new CustomException('UserId is not provided');
        }
        const user = await AppUser.findOne({ id: update.userId });
        if (!user) {
            throw new CustomException('This user cannot be retrieved at the moment, please contact support.');
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
    }
    catch (ex) {
        const error = ex instanceof Error ? ex : new Error('Unhandled exception');
        logger.error(error.message);
        throw error;
    }
};
export default {
    updateFCMTokenAsync,
    // Add other service functions here as needed
};
