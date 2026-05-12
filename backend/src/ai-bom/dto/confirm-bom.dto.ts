import { z } from "zod";

export const ConfirmBomItemSchema = z.object({
  extractionResultId: z.string().uuid(),
  correctedName:  z.string().optional(),
  correctedQty:   z.number().positive().optional(),
  correctedUnit:  z.string().optional(),
  notes:          z.string().optional(),
  rejected:       z.boolean().optional().default(false),
});

export const ConfirmBomSchema = z.object({
  items:       z.array(ConfirmBomItemSchema).min(1),
  confirmedBy: z.string().optional(),
});

export type ConfirmBomDto     = z.infer<typeof ConfirmBomSchema>;
export type ConfirmBomItemDto = z.infer<typeof ConfirmBomItemSchema>;
