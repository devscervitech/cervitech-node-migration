// src/helpers/MailSender.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface ILogger {
  logError(message: string): void;
  logInfo?(message: string): void;
}

export class MailSender {
  private cerviTechEmail: string;
  private cerviTechEmailPassword: string;
  private port: number;
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
    this.cerviTechEmail = process.env.CERVITECH_EMAIL || '';
    this.cerviTechEmailPassword = process.env.CERVITECH_EMAIL_PASSWORD || '';
    this.port = parseInt(process.env.EMAIL_SERVER_PORT || '587');
  }

  async sendEmail(emailAddress: string, subject: string, message: string): Promise<string> {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.live.com', // or smtp.gmail.com
        port: this.port,
        secure: false,
        auth: {
          user: this.cerviTechEmail,
          pass: this.cerviTechEmailPassword,
        },
      });

      const mailOptions = {
        from: `"CerviTech" <${this.cerviTechEmail}>`,
        to: emailAddress,
        subject: subject || 'Test Email Subject',
        text: message || 'Example Plain Text Message Body',
      };

      await transporter.sendMail(mailOptions);

      this.logger.logError('Email sent successfully');
      return 'The mail has been sent successfully !!';
    } catch (error: any) {
      this.logger.logError('Error in sending mail');
      this.logger.logError(error.message);
      return 'sorry cannot send mail';
    }
  }
}
