// src/helpers/SendGridEmailSender.ts
import * as sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();
export class SendGridEmailSender {
    constructor(emailTemplates) {
        this.apiKey = process.env.SENDGRID_API_KEY || '';
        this.emailTemplates = emailTemplates;
        sgMail.setApiKey(this.apiKey);
    }
    async sendBulkEmailAsync(emails, subject, message) {
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
    async sendEmailAsync(email, subject, message) {
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
    async sendWelcomeEmail(email, name) {
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
    async sendTestEmail() {
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
