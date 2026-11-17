import {
    ActiveOnlyQueryDtoSchema,
    AddToCartDtoSchema,
    AssignRoleDtoSchema,
    AttentionAppointmentsQueryDtoSchema,
    AvailabilityQueryDtoSchema,
    CategoryListQueryDtoSchema,
    ChangeOrderStatusDtoSchema,
    ConfigureWhatsAppDtoSchema,
    CouponListQueryDtoSchema,
    CreateAppointmentDtoSchema,
    CreateBannerDtoSchema,
    CreateCategoryDtoSchema,
    CreateCouponDtoSchema,
    CreateFeatureDtoSchema,
    CreatePermissionDtoSchema,
    CreateProductDtoSchema,
    CreateRoleDtoSchema,
    CreateServiceDtoSchema,
    CreateSlideshowDtoSchema,
    CreateStaffDtoSchema,
    CreateTenantDtoSchema,
    DatedQueryDtoSchema,
    type ErrorDetail,
    ForgotPasswordDtoSchema,
    ListAppointmentsQueryDtoSchema,
    LogListQueryDtoSchema,
    LoyaltyRewardDefinitionDtoSchema,
    OrderListQueryDtoSchema,
    OrderStatusQueryDtoSchema,
    PagedQueryDtoSchema,
    PagedSearchQueryDtoSchema,
    SimpleQueryDtoSchema,
    ValidationErrorCodes,
} from "@neutra/commons";
import type { NextFunction, Request, Response } from "express";
import type { ZodIssue, ZodType } from "zod";

/*
 * The public 400 wire format is frozen by `test/golden/validation.snapshot.json`.
 * The ported Zod schemas reproduce the *validation rules* but, being Zod, carry
 * Zod's English default messages and declaration order instead of the original
 * legacy decorator messages / derived-class-first field order. This compatibility
 * layer restores that wire contract at the API edge; the middleware still maps
 * every issue to the documented ErrorDetail shape (code + field + domain), only
 * the human-readable message is reconstructed from the legacy vocabulary.
 */
const LEGACY_MESSAGES = new Map<ZodType, Record<string, string>>([
    [
        AvailabilityQueryDtoSchema,
        {
            staffId: "staffId should not be empty",
            serviceId: "serviceId should not be empty",
            date: "date must be a valid ISO 8601 date string",
        },
    ],
    [
        ListAppointmentsQueryDtoSchema,
        {
            startDate: "startDate must be a valid ISO 8601 date string",
            endDate: "endDate must be a valid ISO 8601 date string",
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
        },
    ],
    [
        AttentionAppointmentsQueryDtoSchema,
        {
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
        },
    ],
    [
        CategoryListQueryDtoSchema,
        {
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
        },
    ],
    [
        CouponListQueryDtoSchema,
        {
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
            search: "search must be a string",
        },
    ],
    [
        LogListQueryDtoSchema,
        {
            skip: "skip must match /^[1-9]\\d*$/ regular expression",
            take: "take must match /^[1-9]\\d*$/ regular expression",
            startDate: "startDate must be a valid ISO 8601 date string",
            endDate: "endDate must be a valid ISO 8601 date string",
        },
    ],
    [SimpleQueryDtoSchema, { timeframe: "timeframe must be a string" }],
    [OrderStatusQueryDtoSchema, { status: "status must be a string" }],
    [
        DatedQueryDtoSchema,
        {
            startDate: "startDate must be a valid ISO 8601 date string",
            endDate: "endDate must be a valid ISO 8601 date string",
        },
    ],
    [
        OrderListQueryDtoSchema,
        {
            status: "status must be a string",
            startDate: "startDate must be a valid ISO 8601 date string",
            endDate: "endDate must be a valid ISO 8601 date string",
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
            search: "search must be a string",
        },
    ],
    [
        PagedSearchQueryDtoSchema,
        {
            search: "search must be a string",
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
        },
    ],
    [
        PagedQueryDtoSchema,
        {
            page: "page must match /^[1-9]\\d*$/ regular expression",
            limit: "limit must match /^[1-9]\\d*$/ regular expression",
        },
    ],
    [
        ActiveOnlyQueryDtoSchema,
        {
            activeOnly:
                "activeOnly must be one of the following values: true, false",
        },
    ],
    [
        CreateAppointmentDtoSchema,
        {
            serviceId: "serviceId should not be empty",
            staffId: "staffId should not be empty",
            startTime: "startTime must be a valid ISO 8601 date string",
        },
    ],
    [ForgotPasswordDtoSchema, { email: "email must be an email" }],
    [
        CreateBannerDtoSchema,
        {
            title: "title should not be empty",
            startsAt: "startsAt must be a valid ISO 8601 date string",
            endsAt: "endsAt must be a valid ISO 8601 date string",
        },
    ],
    [
        AddToCartDtoSchema,
        {
            productId: "productId should not be empty",
            amount: "amount must not be less than 1",
        },
    ],
    [CreateCategoryDtoSchema, { name: "name should not be empty" }],
    [
        CreateCouponDtoSchema,
        {
            code: "code should not be empty",
            type: "type must be one of the following values: PERCENT, FIXED",
            value: "value must not be less than 0",
            expiresAt: "expiresAt must be a valid ISO 8601 date string",
        },
    ],
    [
        CreateFeatureDtoSchema,
        {
            key: "key must be a string",
            name: "name must be a string",
        },
    ],
    [
        LoyaltyRewardDefinitionDtoSchema,
        {
            type: "type must be one of the following values: PERCENT, FIXED",
            value: "value must not be less than 0",
        },
    ],
    [
        ChangeOrderStatusDtoSchema,
        {
            status: "status must be one of the following values: PENDIENTE, PAGADO, ENVIADO, ENTREGADO",
        },
    ],
    [CreatePermissionDtoSchema, { name: "name should not be empty" }],
    [
        CreateProductDtoSchema,
        {
            name: "name must be a string",
            description: "description must be a string",
            price: "price must not be less than 0",
        },
    ],
    [CreateRoleDtoSchema, { name: "name should not be empty" }],
    [
        CreateServiceDtoSchema,
        {
            name: "name should not be empty",
            duration: "duration must not be less than 1",
            price: "price must not be less than 0",
        },
    ],
    [
        CreateSlideshowDtoSchema,
        {
            title: "title should not be empty",
            img: "img should not be empty",
        },
    ],
    [
        CreateStaffDtoSchema,
        {
            name: "name should not be empty",
            email: "email must be an email",
        },
    ],
    [
        CreateTenantDtoSchema,
        {
            name: "name must be shorter than or equal to 100 characters",
            slug: "slug must be shorter than or equal to 63 characters",
            type: "type must be one of the following values: STORE, BOOKING, HYBRID",
        },
    ],
    [AssignRoleDtoSchema, { roleId: "roleId should not be empty" }],
    [
        ConfigureWhatsAppDtoSchema,
        { phoneNumberId: "phoneNumberId is required" },
    ],
]);

/**
 * The legacy validator reported a derived DTO's own properties before its inherited
 * ones; Zod's `.extend()` puts inherited keys first. These three query schemas
 * are the only ones whose issue order differed in the golden matrix.
 */
const LEGACY_FIELD_ORDER = new Map<ZodType, string[]>([
    [
        LogListQueryDtoSchema,
        ["level", "tenantId", "skip", "take", "startDate", "endDate"],
    ],
    [
        OrderListQueryDtoSchema,
        ["status", "startDate", "endDate", "search", "page", "limit"],
    ],
    [PagedSearchQueryDtoSchema, ["search", "page", "limit"]],
]);

function legacyMessage(schema: ZodType, issue: ZodIssue): string {
    const field = issue.path.join(".");
    const known = LEGACY_MESSAGES.get(schema)?.[field];
    if (known) return known;

    switch (issue.code) {
        case "custom":
            return issue.message === "Invalid ISO 8601 date string"
                ? `${field} must be a valid ISO 8601 date string`
                : issue.message;
        case "invalid_union":
            return `${field} must be a valid ISO 8601 date string`;
        case "invalid_format":
            return `${field} must be an email`;
        case "invalid_value": {
            const values = (issue as { values?: unknown[] }).values ?? [];
            return `${field} must be one of the following values: ${values.join(", ")}`;
        }
        case "too_small": {
            const min = (issue as { minimum?: number }).minimum;
            return issue.origin === "string"
                ? `${field} should not be empty`
                : `${field} must not be less than ${min}`;
        }
        case "too_big": {
            const max = (issue as { maximum?: number }).maximum;
            return `${field} must be shorter than or equal to ${max} characters`;
        }
        case "invalid_type":
            if (issue.expected === "string") return `${field} must be a string`;
            if (issue.expected === "number")
                return `${field} must match /^[1-9]\\d*$/ regular expression`;
            if (issue.expected === "boolean")
                return `${field} must be one of the following values: true, false`;
            return issue.message;
        default:
            return issue.message;
    }
}

function orderIssues(schema: ZodType, issues: ZodIssue[]): ZodIssue[] {
    const order = LEGACY_FIELD_ORDER.get(schema);
    if (!order) return issues;
    const rank = (issue: ZodIssue) => {
        const index = order.indexOf(issue.path.join("."));
        return index === -1 ? order.length : index;
    };
    return [...issues].sort((a, b) => rank(a) - rank(b));
}

function toErrorDetails(schema: ZodType, issues: ZodIssue[]): ErrorDetail[] {
    return orderIssues(schema, issues).map((issue) => ({
        code: ValidationErrorCodes.INVALID_FORMAT,
        message: legacyMessage(schema, issue),
        field: issue.path.join("."),
        domain: "validation",
    }));
}

/** Parse a body against a Zod schema, or answer a frozen 400 on failure. */
export const validateDto = (schema: ZodType) => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.apiError(
                toErrorDetails(schema, result.error.issues),
                "Validación fallida",
                400,
            );
            return;
        }
        req.validatedBody = result.data;
        next();
    };
};

/** Same contract as `validateDto`, but for query strings instead of a body. */
export const validateQueryDto = (schema: ZodType) => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            res.apiError(
                toErrorDetails(schema, result.error.issues),
                "Validación fallida",
                400,
            );
            return;
        }
        req.validatedQuery = result.data;
        next();
    };
};

/** Compose several schemas into one intersection (all must pass). */
export const composeValidators = (...schemas: ZodType[]): ZodType =>
    schemas.reduce((combined, schema) => combined.and(schema));
