export class SendAverageNeckAnglePushNotificationViewModel {
  userId: number;
  averageNeckAngle: number;

  constructor(data: { userId: number; averageNeckAngle: number }) {
    this.userId = data.userId;
    this.averageNeckAngle = data.averageNeckAngle;
  }
}