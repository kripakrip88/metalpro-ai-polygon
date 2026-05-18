export type EmailIntent   = 'RFQ' | 'ORDER' | 'QUESTION' | 'COMPLAINT' | 'CLARIFICATION' | 'SPAM' | 'OTHER';
export type EmailPriority = 'critical' | 'urgent' | 'normal' | 'low';
export type AiModel       = 'claude' | 'llama';

export interface ParsedEmail {
  messageId:   string;
  from:        string;
  to:          string;
  subject:     string;
  bodyText:    string;
  bodyHtml?:   string;
  receivedAt:  Date;
  attachments: ParsedAttachment[];
}

export interface ParsedAttachment {
  filename:  string;
  mimeType:  string;
  sizeBytes: number;
  content:   Buffer;
}

export interface EmailAnalysis {
  intent:     EmailIntent;
  priority:   EmailPriority;
  confidence: number;
  summary:    string;
  extracted:  ExtractedEntities;
  drafts:     DraftReply[];
  suggestRfq: boolean;
  modelUsed:  AiModel;
}

export interface ExtractedEntities {
  company?:       string;
  contact?:       string;
  phone?:         string;
  email?:         string;
  items?:         ExtractedItem[];
  deadline?:      string;
  currency?:      string;
  deliveryTerms?: string;
}

export interface ExtractedItem {
  name:      string;
  quantity?: number;
  unit?:     string;
  material?: string;
  notes?:    string;
}

export interface DraftReply {
  strategy: string;
  body:     string;
}

export interface CrmCustomer {
  id:     string;
  name:   string;
  email?: string;
  phone?: string;
}

export interface CrmContact {
  id:         string;
  customerId: string;
  name:       string;
  email?:     string;
  phone?:     string;
}

export interface InteractionPayload {
  customerId:     string;
  contactId?:     string;
  orderId?:       string;
  type:           'EMAIL' | 'CALL' | 'MEETING' | 'NOTE';
  direction:      'INBOUND' | 'OUTBOUND';
  subject?:       string;
  body?:          string;
  emailMessageId?: string;
}
