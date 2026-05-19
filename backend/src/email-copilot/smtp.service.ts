import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  private createTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.mail.ru",
      port: 465,
      secure: true,
      auth: {
        user: process.env.IMAP_USER ?? "",
        pass: process.env.IMAP_PASS ?? "",
      },
    });
  }

  async sendReply(to: string, subject: string, body: string, inReplyTo?: string) {
    const transport = this.createTransport();
    const result = await transport.sendMail({
      from: process.env.IMAP_USER,
      to,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      text: body,
      ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
    });
    this.logger.log(`Reply sent to ${to}: ${result.messageId}`);
    return result.messageId;
  }
}