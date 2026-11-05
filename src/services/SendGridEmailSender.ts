// src/helpers/SendGridEmailSender.ts
import * as sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

interface IEmailTemplates {
  getSignUpEmail(): string;
}

export class SendGridEmailSender {
  private apiKey: string;
  private emailTemplates: IEmailTemplates;

  constructor(emailTemplates: IEmailTemplates) {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.emailTemplates = emailTemplates;
    sgMail.setApiKey(this.apiKey);
  }

  async sendBulkEmailAsync(emails: string[], subject: string, message: string): Promise<void> {
    const msg = {
      to: emails,
      from: {
        email: 'devs.cervitech@gmail.com',
        name: 'CerviTech Mobile',
      },
      subject,
      text: message,
      html: message,
    };

    await sgMail.sendMultiple(msg);
  }

  async sendEmailAsync(email: string, subject: string, message: string): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: 'devs.cervitech@gmail.com',
        name: 'CerviTech Mobile',
      },
      subject,
      text: message,
      html: message,
    };

    await sgMail.send(msg);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const subject = 'Welcome to Cervitech';
    let body = this.emailTemplates.getSignUpEmail();
    body = body.replace('[NAME]', name).replace('[EMAILHOLDER]', email);

    const msg = {
      to: email,
      from: {
        email: 'devs.cervitech@gmail.com',
        name: 'CerviTech Mobile',
      },
      subject,
      text: body,
      html: body,
    };

    await sgMail.send(msg);
  }

  async sendTestEmail(): Promise<void> {
    const msg = {
      to: {
        email: 'ogunderoayodeji@gmail.com',
        name: 'Micheal',
      },
      from: {
        email: 'devs.cervitech@gmail.com',
        name: 'CerviTech Mobile',
      },
      subject: 'Sending with SendGrid is Fun',
      text: 'and easy to do anywhere, even with TypeScript',
      html: '<strong>and easy to do anywhere, even with TypeScript</strong>',
    };

    await sgMail.send(msg);
  }
}
