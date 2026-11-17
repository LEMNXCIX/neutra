import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import {
  BotConfigSchema,
  WhatsAppTemplateSchema,
} from "../schemas/whatsapp.js";

/** Ported from `responses/whatsapp/whatsapp-config.response.ts`. */

export const IWhatsAppConfigResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  accessToken: z.string(),
  webhookVerifyToken: z.string(),
  enabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  botEnabled: z.boolean(),
  templates: z.array(WhatsAppTemplateSchema).nullable().optional(),
  botConfig: BotConfigSchema.nullable().optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type IWhatsAppConfigResponse = z.infer<
  typeof IWhatsAppConfigResponseSchema
>;
