import { Injectable, Logger } from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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
            const parsed = await simpleParser(msg.source);

            let raw: string;
            if (parsed.text) {
              raw = parsed.text;
            } else {
              raw = (parsed.html ?? "").toString()
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<\/p>/gi, "\n\n")
                .replace(/<[^>]+>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">");
            }
            const text = raw
              .replace(/\r\n/g, "\n")
              .replace(/[ \t]+/g, " ")
              .replace(/\n[ \t]+/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim()
              .slice(0, 5000);

            const from = parsed.from?.value?.[0]?.address
              ?? msg.envelope?.from?.[0]?.address ?? "";
            const to = parsed.to
              ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
                  .flatMap((a: any) => a.value ?? [])
                  .map((a: any) => a.address)
                  .filter(Boolean)[0] ?? ""
              : msg.envelope?.to?.[0]?.address ?? "";

            emails.push({
              messageId: (parsed.messageId ?? msg.envelope?.messageId ?? `uid-${msg.uid}`).replace(/[<>]/g, ""),
              fromAddress: from,
              toAddress: to,
              subject: parsed.subject ?? msg.envelope?.subject ?? "(без темы)",
              bodyText: text || "(пустое письмо)",
              receivedAt: parsed.date ?? msg.envelope?.date ?? new Date(),
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
}
