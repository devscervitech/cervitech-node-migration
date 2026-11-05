//1. Import AppUser from the actual MongoDB model
import AppUser from "../viewmodels/AppUser";
import { CustomException } from "../helpers/CustomException";
import ResponseRate from "../viewmodels/ResponseRateViewModel";
export class AppUserService {
    static async updateSubscriptionAsync(userId) {
        try {
            if (!userId || userId.trim() === "") {
                throw new Error("UserId not provided");
            }
            const user = await AppUser.findById(userId);
            if (!user) {
                throw new Error("This user cannot be retrieved at the moment. Please contact support.");
            }
            user.hasPaid = true;
            await user.save(); // saves updated document
            // Build and return AppUserViewModel-like object
            return {
                id: user._id,
                username: user.username,
                email: user.email,
                FCMToken: user.fcmToken,
                hasPaid: user.hasPaid,
                firstName: user.firstName,
                lastName: user.lastName,
                pictureUrl: user.pictureUrl,
                salt: user.salt,
                hash: user.hash,
                isGoalOn: user.isGoalOn,
                allowPushNotifications: user.allowPushNotifications,
                mobileChannel: user.mobileChannel,
                dateRegistered: user.dateRegistered?.toString(),
                responseRate: user.responseRate,
                lastLoginDateTime: user.lastLoginDateTime
            };
        }
        catch (error) {
            console.error("Error in updateSubscriptionAsync:", error);
            throw new CustomException("Error updating subscription.");
        }
    }
    static async updatePictureUrlAsync(update) {
        if (!update || update.userId < 1) {
            throw new Error("UserId not provided");
        }
        const user = await AppUser.findById(update.userId);
        if (!user) {
            throw new Error("This user cannot be retrieved at the moment. Please contact support.");
        }
        user.pictureUrl = update.pictureUrl ?? user.pictureUrl;
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    }
    ;
    static async getResponseRateAsync(userId, day) {
        try {
            // Set time boundaries for the day
            const startOfDay = new Date(day);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(day);
            endOfDay.setHours(23, 59, 59, 999);
            // Query response rates for that user on that day
            const responseRates = await ResponseRate.find({
                appUserId: userId,
                dateCreated: { $gte: startOfDay, $lte: endOfDay }
            });
            const totalPrompts = responseRates.reduce((sum, r) => sum + (r.prompt || 0), 0);
            const totalResponses = responseRates.reduce((sum, r) => sum + (r.response || 0), 0);
            // Group by hour
            const groupedByHour = {};
            responseRates.forEach((entry) => {
                const hour = new Date(entry.dateCreated).getHours();
                if (!groupedByHour[hour]) {
                    groupedByHour[hour] = { prompts: 0, responses: 0 };
                }
                groupedByHour[hour].prompts += entry.prompt || 0;
                groupedByHour[hour].responses += entry.response || 0;
            });
            const activity = Object.entries(groupedByHour).map(([hourStr, group]) => {
                const hour = parseInt(hourStr);
                const { prompts, responses } = group;
                const activityPercentage = prompts === 0 ? 0 : (responses / prompts) * 100;
                return { hour, prompts, responses, activityPercentage };
            });
            const responseRate = totalPrompts === 0 ? 0 : (totalResponses / totalPrompts) * 100;
            const rrvm = {
                appUserId: userId,
                responseRate,
                totalPrompts,
                totalResponses,
                activity
            };
            return rrvm;
        }
        catch (err) {
            console.error("Error in getResponseRateAsync:", err.message);
            throw new CustomException("Error retrieving response rate.");
        }
    }
    ;
}
