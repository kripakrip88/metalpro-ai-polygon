export class SendReplyDto {
  messageId!:   string;
  replyBody!:   string;
  sentBy!:      string;
}

export class CreateRfqDto {
  messageId!:    string;
  customerName!: string;
  title!:        string;
  description?:  string;
}
