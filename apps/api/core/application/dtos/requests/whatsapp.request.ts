/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
import type {
    BotConfig,
    WhatsAppTemplate,
} from "@/core/entities/whatsapp-config.entity";

export interface ConfigureWhatsAppDTO {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
    webhookVerifyToken?: string;
    enabled?: boolean;
    notificationsEnabled?: boolean;
    botEnabled?: boolean;
    templates?: WhatsAppTemplate[];
    botConfig?: BotConfig;
}

export interface SendNotificationDTO {
    tenantId: string;
    to: string;
    templateName: string;
    languageCode?: string;
    components?: Array<{
        type: string;
        parameters?: Array<Record<string, unknown>>;
    }>;
}

export type ConfigureWhatsAppDto =
    import("@neutra/commons").ConfigureWhatsAppDto;

/**
 * One element of a template's `components`, validated through the same
 * nested-class shape `CreateLoyaltyCampaignDto` uses for its reward: without
 * it a `components` array of strings would reach
 * `IWhatsAppService.sendTemplateMessage` and fail at the provider.
 */
export type WhatsAppComponentDto =
    import("@neutra/commons").WhatsAppComponentDto;

/**
 * The body of `POST /api/whatsapp/send-template`.
 *
 * `tenantId` is absent because `WhatsAppController.sendTemplate` sets it from
 * `req.tenantId` after the spread: the tenant is the authenticated context,
 * and a body naming another one is not what the message is sent as. The class
 * therefore does not implement `SendNotificationDTO`, which still requires
 * `tenantId` because that is what the use case takes.
 */
export type SendNotificationDto = import("@neutra/commons").SendNotificationDto;
