import { z } from "zod";

/** Formerly TS string unions in `whatsapp-message.entity.ts`. */
export const WhatsAppMessageTypeSchema = z.enum({
  text: "text",
  image: "image",
  document: "document",
  audio: "audio",
  video: "video",
  template: "template",
  interactive: "interactive",
  location: "location",
  sticker: "sticker",
  contacts: "contacts",
});
export const WhatsAppMessageType = WhatsAppMessageTypeSchema.enum;
export type WhatsAppMessageType = z.infer<typeof WhatsAppMessageTypeSchema>;

export const WhatsAppMessageStatusSchema = z.enum({
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  pending: "pending",
});
export const WhatsAppMessageStatus = WhatsAppMessageStatusSchema.enum;
export type WhatsAppMessageStatus = z.infer<typeof WhatsAppMessageStatusSchema>;

export const WhatsAppMessageDirectionSchema = z.enum({
  inbound: "inbound",
  outbound: "outbound",
});
export const WhatsAppMessageDirection = WhatsAppMessageDirectionSchema.enum;
export type WhatsAppMessageDirection = z.infer<
  typeof WhatsAppMessageDirectionSchema
>;
