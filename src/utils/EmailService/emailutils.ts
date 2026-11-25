import { logger } from '../logger';
// src/utils/EmailService/emailutils.ts
import { EmailClient } from "@azure/communication-email";
import * as dotenv from "dotenv";
import { EmailTemplates } from "./emailtemplates";
import { TokenUtil } from "../token.util";

dotenv.config();

/** Email was attempted without usable ACS settings. Never contains the connection string. */
export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
    Object.setPrototypeOf(this, EmailConfigurationError.prototype);
  }
}

export class EmailUtils {
  private static client: EmailClient | null = null;
  private static clientConnectionString: string | null = null;

  // Built on first send rather than at import, so missing or malformed email
  // settings disable email instead of preventing the API from starting.
  private static getClient(): EmailClient {
    const connectionString = process.env.ACS_CONNECTION_STRING?.trim();
    if (!connectionString) {
      throw new EmailConfigurationError("Email delivery is not configured: ACS_CONNECTION_STRING is not set.");
    }
    if (EmailUtils.client && EmailUtils.clientConnectionString === connectionString) {
      return EmailUtils.client;
    }

    try {
      EmailUtils.client = new EmailClient(connectionString);
    } catch {
      // The SDK's message echoes the connection string (a secret), so drop it.
      throw new EmailConfigurationError(
        "Email delivery is misconfigured: ACS_CONNECTION_STRING is not a valid Azure Communication Services connection string."
      );
    }
    EmailUtils.clientConnectionString = connectionString;
    return EmailUtils.client;
  }

  private static getSender(): string {
    const sender = process.env.SENDER_EMAIL?.trim();
    if (!sender) {
      throw new EmailConfigurationError("Email delivery is not configured: SENDER_EMAIL is not set.");
    }
    return sender;
  }

  private static async sendEmail(to: string, subject: string, html: string) {
    try {
      const message = {
        senderAddress: EmailUtils.getSender(),
        content: { subject, html },
        recipients: { to: [{ address: to }] },
      };

      const poller = await EmailUtils.getClient().beginSend(message);
      const response = await poller.pollUntilDone();

      return response;
    } catch (error: any) {
      logger.error('Email delivery failed', error);
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
      const html = EmailTemplates.accountDeletionRequest(username, to, token);
      return await EmailUtils.sendEmail(to, "Account Deletion Request", html);
  }


  static async sendAccountDeletionConfirmation(to: string, username: string) {
    const html = EmailTemplates.accountDeletion(username);
    return await EmailUtils.sendEmail(to, "Account Deletion Confirmed", html);
  }
}
