import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { getCraniumVertebralAngleFromNeckAngle } from '../helpers/computations';
import AppUser from '../models/AppUser';
import CustomException from '../exceptions/customException';
import { logger } from '../utils/logger';
import ResponseRate from '../models/ResponseRate';
import { PushNotificationDriver } from './pushNotificationDriver';
import { CerviTechDbContext } from '../config/CerviTechDbContext';
import { ApplicationConstant } from '../utils/applicationConstants';
import { Utils } from '../helpers/utils';
import { Calculator } from '../helpers/calculator';
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
export const postBatchNeckAngleRecordAsync = async (neckAngleModel) => {
    try {
        const neckAngleRecords = [];
        for (const record of neckAngleModel.neckAngleRecords) {
            const appUser = await AppUser.findOne({ id: record.appUserId });
            if (!appUser) {
                logger.warn(`AppUser ${record.appUserId} not found, skipping.`);
                continue;
            }
            const alreadyExists = await NeckAngleRecordModel.exists({ appUserId: record.appUserId });
            let counter = 1;
            if (alreadyExists) {
                const last = await NeckAngleRecordModel
                    .findOne({ appUserId: record.appUserId })
                    .sort({ counter: -1 });
                counter = (last?.counter ?? 0) + 1;
            }
            const craniumVertebralAngle = getCraniumVertebralAngleFromNeckAngle(record.angle);
            const neckAngleRecord = new NeckAngleRecordModel({
                appUserId: record.appUserId,
                craniumVertebralAngle,
                counter,
                dateTimeRecorded: new Date(record.dateTimeRecorded),
                angle: record.angle,
            });
            await neckAngleRecord.save();
            if (appUser.prompt && counter % appUser.prompt === 0) {
                const averageNeckAngle = await calculateAverageOfLastSetNeckAngles(record.appUserId);
                const notificationPayload = {
                    userId: 123,
                    averageNeckAngle: 75.2,
                };
                await sendPushNotificationMessageForAverageNeckAngle(notificationPayload);
            }
        }
        return true;
    }
    catch (ex) {
        const error = ex instanceof Error ? ex : new Error('Unhandled exception');
        logger.error(error.message);
        throw error;
    }
};
const numberOfRecordPostBeforeSendingAverageNeckAngle = parseInt(process.env.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE || '0', 10);
async function calculateAverageOfLastSetNeckAngles(userId) {
    try {
        const records = await NeckAngleRecordModel.find({ appUserId: userId })
            .sort({ _id: -1 })
            .limit(numberOfRecordPostBeforeSendingAverageNeckAngle);
        if (!records || records.length === 0) {
            throw new Error("No records found for this user");
        }
        const sumOfAngles = records.reduce((sum, record) => sum + record.angle, 0);
        let averageAngle = Math.round((sumOfAngles / numberOfRecordPostBeforeSendingAverageNeckAngle) * 10) / 10;
        if (isNaN(averageAngle)) {
            averageAngle = 0;
        }
        const user = await AppUser.findById(userId);
        if (user) {
            user.responseRate = 100 - (100 * (90 - averageAngle) / 90);
            await user.save();
        }
        return averageAngle;
    }
    catch (error) {
        console.error(error.message);
        throw error;
    }
}
export async function sendPushNotificationMessageForAverageNeckAngle(notificationPayload) {
    try {
        const appUsers = await AppUser.find();
        for (const appUser of appUsers) {
            if (!appUser.fcmToken)
                continue;
            let averageNeckAngle;
            try {
                averageNeckAngle = await calculateAverageOfLastSetNeckAngles(appUser._id.toString());
            }
            catch (error) {
                logger.info(error.message);
                continue;
            }
            appUser.notificationCount ?? (appUser.notificationCount = 0);
            appUser.prompt ?? (appUser.prompt = this.defaultPrompt);
            if (appUser.notificationCount > appUser.prompt) {
                // You can use node-cron or agenda for scheduling in Node.js
                scheduleResetNotificationCount(appUser._id.toString());
            }
            const pushNotificationModel = {
                to: appUser.fcmToken,
                title: '',
                body: ''
            };
            const utils = new Utils();
            const [title, body] = await Utils.compareAverageNeckAngle(averageNeckAngle);
            pushNotificationModel.title = title;
            pushNotificationModel.body = body;
            const sent = await PushNotificationDriver.sendPushNotification(pushNotificationModel);
            if (sent) {
                appUser.notificationCount++;
                const responseRate = new ResponseRate({
                    appUserId: appUser._id,
                    dateCreated: new Date(),
                    prompt: 1,
                    response: 0
                });
                await responseRate.save();
            }
            await appUser.save();
        }
        return true;
    }
    catch (error) {
        logger.error(error.message);
        throw error;
    }
}
export async function postRandomBatchNeckAngleRecordForTestAsync(model) {
    try {
        if (model.numberOfRecords > 30) {
            throw new CustomException('The maximum number of records allowed is 30 per request');
        }
        const neckAngleRecords = [];
        const random = () => Math.floor(Math.random() * (90 - 10 + 1)) + 10;
        for (let i = 0; i < model.numberOfRecords; i++) {
            const angle = random();
            const timeSpanMinutes = (model.endDate.getTime() - model.startDate.getTime()) / (1000 * 60);
            const randomMinutes = Math.floor(Math.random() * timeSpanMinutes);
            const randomDate = new Date(model.startDate.getTime() + randomMinutes * 60 * 1000);
            const record = {
                appUserId: model.appUserId,
                angle: angle,
                dateTimeRecorded: randomDate,
                craniumVertebralAngle: Calculator.getCraniumVertebralAngleFromNeckAngle(angle),
            };
            neckAngleRecords.push(record);
        }
        await NeckAngleRecordModel.insertMany({ data: neckAngleRecords }); // Adjust based on your ORM
        return true;
    }
    catch (error) {
        if (error instanceof CustomException) {
            logger.error(error.message);
            throw error;
        }
        throw error;
    }
}
export default {
    postBatchNeckAngleRecordAsync,
    postRandomBatchNeckAngleRecordForTestAsync,
    // Add other service functions here as needed
};
function scheduleResetNotificationCount(arg0) {
    throw new Error('Function not implemented.');
}
