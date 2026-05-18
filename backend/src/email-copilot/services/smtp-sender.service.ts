import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class SmtpSenderService {
  private readonly logger = new Logger(SmtpSenderService.name);
  private transporter: any = null;

  private getTransporter() {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST ?? "smtp.mail.ru";
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    const user = process.env.SMTP_USER ?? process.env.IMAP_USER;
    const pass = process.env.SMTP_PASS ?? process.env.IMAP_PASS;

    if (!user || !pass) throw new Error("SMTP credentials not configured (SMTP_USER, SMTP_PASS)");

    let nodemailer: any;
    try {
      nodemailer = require("nodemailer");
    } catch {
      throw new Error("nodemailer not installed. Run: npm install nodemailer");
    }

    this.transporter = nodemailer.createTransport({ host, port, secure: true, auth: { user, pass } });
    return this.transporter;
  }

  async send(to: string, subject: string, text: string, inReplyTo?: string): Promise<void> {
    const from = process.env.SMTP_USER ?? process.env.IMAP_USER;
    const mailer = this.getTransporter();

    const mailOptions: any = { from, to, subject, text };
    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo;
      mailOptions.references = inReplyTo;
    }

    await mailer.sendMail(mailOptions);
    this.logger.log(`Email sent to ${to}: "${subject}"`);
  }
}
