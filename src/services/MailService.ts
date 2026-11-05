// src/helpers/MailService.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface IEmailTemplates {
  getSignUpEmail(): string;
  getPasswordResetEmail(): string;
  getAccountDeletionRequestEmail(): string;
  getReminderEmail(): string;
  getAccountDeletionEmail(): string;
}
interface IMailSender {
  sendEmail(to: string, subject: string, message: string): Promise<void>;
}

interface ISendGridEmailSender {
  sendEmailAsync(email: string, name: string): Promise<void>;
}

interface ILogger {
  logError(message: string): void;
}

export class MailService {
  private fromMail: string;
  private password: string;
  private port: number;
  private baseUrl: string;
  private logger: ILogger;
  private emailTemplates: IEmailTemplates;

  constructor(
    logger: ILogger,
    emailTemplates: IEmailTemplates,
    private mailSender: IMailSender,
    private sendGridMailSender: ISendGridEmailSender,
  ) {
    this.logger = logger;
    this.emailTemplates = emailTemplates;
    this.fromMail = process.env.CERVITECH_EMAIL || '';
    this.password = process.env.CERVITECH_EMAIL_PASSWORD || '';
    this.port = parseInt(process.env.EMAIL_SERVER_PORT || '465');
    this.baseUrl = process.env.BASE_URL || '';
  }

  async sendSignUpMail(toMail: string, toName: string): Promise<string> {
    try {
      const subject = 'Welcome to CerviTech';
      let body = this.emailTemplates.getSignUpEmail();
      body = body.replace('[NAME]', toName).replace('[EMAILHOLDER]', toMail);
      return await this.sendMail(toMail, subject, body);
    } catch (error: any) {
      this.logger.logError(`${error.message} ---From sendSignUpMail`);
      return error.message;
    }
  }

  async sendPasswordResetMail(toMail: string, username: string, token: string): Promise<string> {
    try {
      const subject = 'CerviTech Password Reset Token';
      let body = this.emailTemplates.getPasswordResetEmail();
      body = body.replace('[Username]', username).replace('[Token]', token);
      return await this.sendMail(toMail, subject, body);
    } catch (error: any) {
      this.logger.logError(error.message);
      return error.message;
    }
  }

  async sendAccountDeletionMail(toMail: string, username: string, token: string): Promise<string> {
    try {
      const subject = 'Account Deletion Request';
      let body = this.emailTemplates.getAccountDeletionRequestEmail();
      body = body
        .replace('[Username]', username)
        .replace('[Token]', token)
        .replace('[ConfirmationLink]', `${this.baseUrl}/api/user/confirmdeletemyaccount`)
        .replace('[email]', toMail);
      return await this.sendMail(toMail, subject, body);
    } catch (error: any) {
      this.logger.logError(error.message);
      return error.message;
    }
  }

  async sendMail(toMail: string, subject: string, body: string): Promise<string> {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: this.port,
        secure: true,
        auth: {
          user: this.fromMail,
          pass: this.password,
        },
      });

      await transporter.sendMail({
        from: `"CerviTech" <${this.fromMail}>`,
        to: toMail,
        subject,
        html: body,
      });

      return 'success';
    } catch (error: any) {
      this.logger.logError(`${error.message} ---From sendMail`);
      throw error;
    }
  }
    async sendLastLoginDateMail(toMail: string, toName: string): Promise<boolean> {
    try {
      const subject = "It's been a while";
      let body = this.emailTemplates.getReminderEmail();
      body = body.replace('[NAME]', toName).replace('[EMAILHOLDER]', toMail);
      await this.sendMail(toMail, subject, body);
      return true;
    } catch (error: any) {
      this.logger.logError(`Could not send last login mail to ${toMail}: ${error.message}`);
      return false;
    }
  }

  async mailKitTestMail(toMail: string, toName: string): Promise<boolean> {
    try {
      const subject = 'Welcome to CerviTech';
      const message = 'a test message';
      await this.mailSender.sendEmail(toMail, subject, message);
      return true;
    } catch (error: any) {
      this.logger.logError(error.message);
      return false;
    }
  }

  async sendGridTestMail(toMail: string, toName: string): Promise<boolean> {
    try {
      let body = this.emailTemplates.getSignUpEmail();
      body = body.replace('[NAME]', toName).replace('[EMAILHOLDER]', toMail);
      await this.sendGridMailSender.sendEmailAsync(toMail, toName);
      return true;
    } catch (error: any) {
      this.logger.logError(error.message);
      return false;
    }
  }

  async sendAccountDeletionConfirmationMail(toMail: string, username: string): Promise<string> {
    try {
      const subject = 'CerviTech Account Deletion Confirmation';
      let body = this.emailTemplates.getAccountDeletionEmail();
      body = body.replace('[Username]', username);
      return await this.sendMail(toMail, subject, body);
    } catch (error: any) {
      this.logger.logError(error.message);
      return error.message;
    }
  }

}
