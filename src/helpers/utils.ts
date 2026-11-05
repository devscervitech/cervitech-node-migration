// utils.ts
import { ApplicationConstant } from '../utils/applicationConstants';
export class Utils {
  static getColorTag(complianceInPercentage: number): string {
    try {
      if (complianceInPercentage >= 85) {
        return ApplicationConstant.ENV_COLOR_GREEN;
      } else if (complianceInPercentage >= 70) {
        return ApplicationConstant.ENV_COLOR_BLUE;
      } else if (complianceInPercentage >= 50) {
        return ApplicationConstant.ENV_COLOR_YELLOW;
      } else if (complianceInPercentage >= 30) {
        return ApplicationConstant.ENV_COLOR_ORANGE;
      } else {
        return ApplicationConstant.ENV_COLOR_RED;
      }
    } catch (error) {
      return "";
    }
  }

  static async compareAverageNeckAngle(averageNeckAngle: number): Promise<[string, string]> {
    const convertedAverageNeckAngle = Math.round(averageNeckAngle * 10) / 10;

    if (averageNeckAngle >= 50) {
      return [
        "Your Neck Angle is Great! 😃👍",
        `You have maintained an outstanding average neck angle position of ${convertedAverageNeckAngle}°. Great work! Well done. 🙌🏅`
      ];
    } else if (averageNeckAngle >= 40) {
      return [
        "Your Neck Angle is Good! 🙂👏",
        `You have maintained an average neck angle position of ${convertedAverageNeckAngle}°. Keep it up! You're almost there. ☺️🧨`
      ];
    } else if (averageNeckAngle >= 30) {
      return [
        "Your Neck Angle is Fair! 😓👌",
        `You have maintained an average neck angle position of ${convertedAverageNeckAngle}°. Let's work on this, you're almost there. 😉💪`
      ];
    } else if (averageNeckAngle >= 15) {
      return [
        "Your Neck Angle is Poor! 😟👎",
        `You have maintained an average neck angle position of ${convertedAverageNeckAngle}°. Tap to see our recommended various exercises.`
      ];
    } else {
      return [
        "Your Neck Angle is Very Poor! 😞👎",
        `You have maintained an average neck angle position of ${convertedAverageNeckAngle}°. Tap to see our recommended various exercises.`
      ];
    }
  }
}
