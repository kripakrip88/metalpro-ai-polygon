import { Injectable, Logger } from "@nestjs/common";
import { ParsedEmail } from "../types/email.types";

@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  async fetchNew(): Promise<ParsedEmail[]> {
    const host = process.env.IMAP_HOST;
    const user = process.env.IMAP_USER;
    const pass = process.env.IMAP_PASS;
    const port = parseInt(process.env.IMAP_PORT ?? "993", 10);

    if (!host || !user || !pass) {
      this.logger.warn("IMAP credentials not configured (IMAP_HOST, IMAP_USER, IMAP_PASS)");
      return [];
    }

    let ImapFlow: any, simpleParser: any;
    try {
      ImapFlow = require("imapflow").ImapFlow;
      simpleParser = require("mailparser").simpleParser;
    } catch {
      this.logger.error("Required packages not installed. Run: npm install imapflow mailparser");
      return [];
    }

    const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
    const results: ParsedEmail[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        for await (const msg of client.fetch("1:*", { uid: true, flags: true, source: true }, { uid: true })) {
          if (msg.flags.has("\\Seen")) continue;
          try {
            const parsed = await simpleParser(msg.source);
            results.push({
              messageId:  parsed.messageId ?? `fallback-${Date.now()}-${Math.random()}`,
              from:       parsed.from?.value?.[0]?.address ?? "",
              to:         parsed.to?.value?.[0]?.address ?? "",
              subject:    this.sanitize(parsed.subject ?? "(без темы)"),
              bodyText:   parsed.text ?? "",
              bodyHtml:   parsed.html || undefined,
              receivedAt: parsed.date ?? new Date(),
              attachments: (parsed.attachments ?? []).map((a: any) => ({
                filename:  a.filename ?? "attachment",
                mimeType:  a.contentType ?? "application/octet-stream",
                sizeBytes: a.size ?? 0,
                content:   a.content,
              })),
            });
            await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
          } catch (e) {
            this.logger.warn(`Parse error for one message: ${(e as Error).message}`);
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      this.logger.error(`IMAP connection error: ${(err as Error).message}`);
      try { client.close(); } catch {}
    }

    return results;
  }

  // Strip potential prompt injection patterns
  private sanitize(text: string): string {
    return text
      .replace(/ignore\s+(previous|all)\s+instructions?/gi, "[filtered]")
      .replace(/\[INST\]|\[\/INST\]|<\|.*?\|>/g, "[filtered]")
      .trim()
      .slice(0, 500);
  }
}
