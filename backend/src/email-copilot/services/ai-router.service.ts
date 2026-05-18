import { Injectable } from "@nestjs/common";
import { ParsedEmail, AiModel } from "../types/email.types";

const COMPLEX_KEYWORDS = [
  "кп", "коммерческ", "тендер", "rfq", "котировк",
  "чертёж", "чертеж", "dwg", "dxf", "спецификац",
  "металлопрокат", "прокат", "металл", "труб", "лист",
  "уголок", "швеллер", "балк", "партия", "объём", "заявка",
  "запрос", "поставк", "contract", "quote", "quotation", "request for",
];

@Injectable()
export class AiRouterService {
  route(email: ParsedEmail): AiModel {
    if (email.attachments.length > 0) return "claude";
    if (email.bodyText.length > 400) return "claude";
    const text = `${email.subject} ${email.bodyText}`.toLowerCase();
    for (const kw of COMPLEX_KEYWORDS) {
      if (text.includes(kw)) return "claude";
    }
    return "llama";
  }
}
