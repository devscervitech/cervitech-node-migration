export interface PushNotificationModelDTO {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}