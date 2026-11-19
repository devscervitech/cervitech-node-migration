// src/utils/EmailService/emailutils.ts
import { EmailClient } from "@azure/communication-email";
import * as dotenv from "dotenv";
import { EmailTemplates } from "./emailtemplates";
import { TokenUtil } from "../token.util";

dotenv.config();

export class EmailUtils {
  private static connectionString = process.env.ACS_CONNECTION_STRING!;
  private static sender = process.env.SENDER_EMAIL!;
  private static client = new EmailClient(EmailUtils.connectionString);

  private static async sendEmail(to: string, subject: string, html: string) {
    try {
      const message = {
        senderAddress: EmailUtils.sender,
        content: { subject, html },
        recipients: { to: [{ address: to }] },
      };

      const poller = await EmailUtils.client.beginSend(message);
      const response = await poller.pollUntilDone();

      console.log(`Email sent successfully to ${to}`);
      return response;
    } catch (error: any) {
      console.error(`Failed to send email to ${to}:`, error.message);
      throw error;
    }
  }

  static async sendSignupEmail(to: string, username: string) {
    const html = EmailTemplates.signUp(username);
    return await EmailUtils.sendEmail(to, "Welcome to CerviTech!", html);
  }

  static async sendPasswordResetOtpEmail(to: string, username: string, otpCode: string) {
    const html = EmailTemplates.passwordResetOtp(username, otpCode);
    return await EmailUtils.sendEmail(to, "Your CerviTech Password Reset Code", html);
  }

  static async sendReminderEmail(to: string, username: string) {
    const html = EmailTemplates.reminder(username);
    return await EmailUtils.sendEmail(to, "We Miss You at CerviTech!", html);
  }

  static async sendAccountDeletionRequest(to: string, username: string, token: string) {
      console.log("Token received in EmailUtils:", token);
      const html = EmailTemplates.accountDeletionRequest(username, to, token);
      return await EmailUtils.sendEmail(to, "Account Deletion Request", html);
  }


  static async sendAccountDeletionConfirmation(to: string, username: string) {
    const html = EmailTemplates.accountDeletion(username);
    return await EmailUtils.sendEmail(to, "Account Deletion Confirmed", html);
  }
}
