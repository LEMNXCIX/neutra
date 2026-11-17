import { z } from "zod";
import {
  booleanQuerySchema,
  unknownRecordSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/whatsapp.request.ts`. */

/** Shapes of the `WhatsAppTemplate` / `BotConfig` entity types. */
export const WhatsAppTemplateSchema = z.object({
  name: z.string(),
  language: z.string(),
});

export const BotConfigSchema = z.object({
  welcomeMessage: z.string().optional(),
  awayMessage: z.string().optional(),
  businessHours: z
    .object({ start: z.string(), end: z.string() })
    .optional(),
});

export const ConfigureWhatsAppDtoSchema = z.object({
  phoneNumberId: z.string().min(1),
  businessAccountId: z.string().optional(),
  accessToken: z.string().min(10).optional(),
  webhookVerifyToken: z.string().optional(),
  enabled: booleanQuerySchema.optional(),
  notificationsEnabled: booleanQuerySchema.optional(),
  botEnabled: booleanQuerySchema.optional(),
  templates: z.array(WhatsAppTemplateSchema).optional(),
  botConfig: BotConfigSchema.optional(),
});
export type ConfigureWhatsAppDto = z.infer<typeof ConfigureWhatsAppDtoSchema>;

export const WhatsAppComponentDtoSchema = z.object({
  type: z.string(),
  parameters: z.array(unknownRecordSchema).optional(),
});
export type WhatsAppComponentDto = z.infer<typeof WhatsAppComponentDtoSchema>;

/**
 * `@ValidateNested({ each: true })` plus
 * `@Transform(({ value }) => value.map((entry) => plainToInstance(…)))` is
 * expressed by nesting `WhatsAppComponentDtoSchema` in an array.
 */
export const SendNotificationDtoSchema = z.object({
  to: z.string(),
  templateName: z.string(),
  languageCode: z.string().optional(),
  components: z.array(WhatsAppComponentDtoSchema).optional(),
});
export type SendNotificationDto = z.infer<typeof SendNotificationDtoSchema>;
