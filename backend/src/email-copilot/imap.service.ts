import { Injectable, Logger } from "@nestjs/common";
import { ImapFlow } from "imapflow";

export interface RawEmail {
  messageId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
}

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);

  private createClient() {
    return new ImapFlow({
      host: process.env.IMAP_HOST ?? "imap.mail.ru",
      port: 993,
      secure: true,
      auth: {
        user: process.env.IMAP_USER ?? "",
        pass: process.env.IMAP_PASS ?? "",
      },
      logger: false,
    });
  }

  async fetchNewEmails(sinceDate?: Date): Promise<RawEmail[]> {
    const client = this.createClient();
    const emails: RawEmail[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const since = sinceDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
          try {
            const source = msg.source?.toString("utf-8") ?? "";
            emails.push({
              messageId: msg.envelope?.messageId ?? `uid-${msg.uid}`,
              fromAddress: msg.envelope?.from?.[0]?.address ?? "",
              toAddress: msg.envelope?.to?.[0]?.address ?? "",
              subject: msg.envelope?.subject ?? "(без темы)",
              bodyText: this.extractBody(source),
              receivedAt: msg.envelope?.date ?? new Date(),
            });
          } catch (e: any) {
            this.logger.warn(`Skip msg ${msg.uid}: ${e.message}`);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
    this.logger.log(`Fetched ${emails.length} emails`);
    return emails;
  }

  private extractBody(raw: string): string {
    const bodyStart = raw.indexOf("\r\n\r\n");
    const body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
    return body
      .replace(/=\r\n/g, "")
      .replace(/=[0-9A-Fa-f]{2}/g, (m) => String.fromCharCode(parseInt(m.slice(1), 16)))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  }
}